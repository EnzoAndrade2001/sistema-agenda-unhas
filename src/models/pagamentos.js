const { pool } = require('../config/database');
const agendamentos = require('./agendamentos');
const { HttpError } = require('../utils/httpError');

const colunas = `
    id, agendamento_id, provedor, metodo, status, valor::float AS valor,
    mercado_pago_preference_id, mercado_pago_payment_id, checkout_url,
    sandbox_checkout_url, payload, criado_em, atualizado_em`;

async function listar({ agendamentoId } = {}) {
    const values = [];
    const filtros = [];
    if (agendamentoId) {
        values.push(agendamentoId);
        filtros.push(`agendamento_id = $${values.length}`);
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const result = await pool.query(`SELECT ${colunas} FROM pagamentos ${where} ORDER BY criado_em DESC`, values);
    return result.rows;
}

async function buscarPorId(id, db = pool) {
    const result = await db.query(`SELECT ${colunas} FROM pagamentos WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

async function criarPendente({ agendamento_id, valor, provedor = 'manual', metodo = null }) {
    const result = await pool.query(
        `INSERT INTO pagamentos (agendamento_id, valor, provedor, metodo)
         VALUES ($1, $2, $3, $4) RETURNING ${colunas}`,
        [agendamento_id, valor, provedor, metodo]
    );
    return result.rows[0];
}

async function atualizar(id, campos, db = pool) {
    const entries = Object.entries(campos).filter(([, value]) => value !== undefined);
    if (!entries.length) return buscarPorId(id, db);
    const sets = entries.map(([chave], index) => `${chave} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const result = await db.query(
        `UPDATE pagamentos SET ${sets.join(', ')}, atualizado_em = NOW()
         WHERE id = $${values.length} RETURNING ${colunas}`,
        values
    );
    return result.rows[0] || null;
}

async function sincronizarAgendamento(db, agendamentoId) {
    const result = await db.query(
        `SELECT
            COALESCE(SUM(valor) FILTER (WHERE status = 'pago'), 0)::float AS pago,
            COALESCE(SUM(valor) FILTER (WHERE status IN ('pendente', 'parcial')), 0)::float AS pendente,
            EXISTS(SELECT 1 FROM pagamentos WHERE agendamento_id = $1 AND status = 'reembolsado') AS reembolsado
         FROM pagamentos WHERE agendamento_id = $1`,
        [agendamentoId]
    );
    const agendamento = await agendamentos.buscarPorId(agendamentoId, db);
    if (!agendamento) throw new HttpError(404, 'Agendamento nao encontrado.');

    const pago = Number(result.rows[0].pago || 0);
    let status = 'pendente';
    if (result.rows[0].reembolsado) status = 'reembolsado';
    else if (pago >= Number(agendamento.preco)) status = 'pago';
    else if (pago > 0) status = 'parcial';

    await db.query(
        `UPDATE agendamentos
         SET pagamento_status=$1, valor_pago=$2, pago_em=$3, atualizado_em=NOW()
         WHERE id=$4`,
        [status, pago, status === 'pago' ? new Date() : null, agendamentoId]
    );
}

async function registrarManual({ agendamento_id, valor, metodo }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const agendamento = await agendamentos.buscarPorId(agendamento_id, client);
        if (!agendamento) throw new HttpError(404, 'Agendamento nao encontrado.');
        const result = await client.query(
            `INSERT INTO pagamentos (agendamento_id, provedor, metodo, status, valor)
             VALUES ($1, 'manual', $2, 'pago', $3) RETURNING ${colunas}`,
            [agendamento_id, metodo, valor]
        );
        await sincronizarAgendamento(client, agendamento_id);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function atualizarPorMercadoPago({ paymentId, status, valor, metodo, preferenceId, payload, externalReference }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let pagamento = null;
        if (paymentId) {
            const result = await client.query(`SELECT ${colunas} FROM pagamentos WHERE mercado_pago_payment_id = $1`, [paymentId]);
            pagamento = result.rows[0] || null;
        }
        if (!pagamento && preferenceId) {
            const result = await client.query(`SELECT ${colunas} FROM pagamentos WHERE mercado_pago_preference_id = $1`, [preferenceId]);
            pagamento = result.rows[0] || null;
        }
        if (!pagamento && externalReference) {
            const match = String(externalReference).match(/pagamento:(\d+)/);
            if (match) pagamento = await buscarPorId(Number(match[1]), client);
        }
        if (!pagamento) throw new HttpError(404, 'Pagamento Mercado Pago nao encontrado no sistema.');

        pagamento = await atualizar(pagamento.id, {
            status,
            valor: valor ?? pagamento.valor,
            metodo: metodo || pagamento.metodo,
            mercado_pago_payment_id: paymentId || pagamento.mercado_pago_payment_id,
            mercado_pago_preference_id: preferenceId || pagamento.mercado_pago_preference_id,
            payload
        }, client);
        await sincronizarAgendamento(client, pagamento.agendamento_id);
        await client.query('COMMIT');
        return pagamento;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    listar,
    buscarPorId,
    criarPendente,
    atualizar,
    registrarManual,
    atualizarPorMercadoPago,
    sincronizarAgendamento
};
