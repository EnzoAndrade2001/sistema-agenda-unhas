const { pool } = require('../config/database');
const { HttpError } = require('../utils/httpError');

const selectCompleto = `
    SELECT a.id, a.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone,
           a.servico_id, s.nome AS servico_nome, a.inicio, a.fim,
           a.preco::float AS preco, a.status, a.pagamento_status, a.forma_pagamento,
           a.valor_pago::float AS valor_pago, a.confirmado_em, a.pago_em,
           a.encaixe, a.motivo_encaixe,
           a.observacoes, a.criado_em, a.atualizado_em
    FROM agendamentos a
    JOIN clientes c ON c.id = a.cliente_id
    JOIN servicos s ON s.id = a.servico_id`;

async function listar({ inicio, fim, status, clienteId }) {
    const values = [];
    const filtros = [];
    for (const [coluna, operador, value] of [
        ['a.inicio', '>=', inicio],
        ['a.inicio', '<', fim],
        ['a.status', '=', status],
        ['a.cliente_id', '=', clienteId]
    ]) {
        if (value !== undefined && value !== null) {
            values.push(value);
            filtros.push(`${coluna} ${operador} $${values.length}`);
        }
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const result = await pool.query(`${selectCompleto} ${where} ORDER BY a.inicio`, values);
    return result.rows;
}

async function buscarPorId(id, db = pool) {
    const result = await db.query(`${selectCompleto} WHERE a.id = $1`, [id]);
    return result.rows[0] || null;
}

async function obterServicoEValidarCliente(db, clienteId, servicoId) {
    const result = await db.query(
        `SELECT
            EXISTS(SELECT 1 FROM clientes WHERE id = $1 AND ativo) AS cliente_existe,
            (SELECT json_build_object('duracao', duracao_minutos, 'preco', preco::float)
             FROM servicos WHERE id = $2 AND ativo) AS servico`,
        [clienteId, servicoId]
    );
    if (!result.rows[0].cliente_existe) throw new HttpError(404, 'Cliente ativo nao encontrado.');
    if (!result.rows[0].servico) throw new HttpError(404, 'Servico ativo nao encontrado.');
    return result.rows[0].servico;
}

async function validarConflito(db, inicio, fim, ignorarId = null, permitirConflito = false) {
    await db.query('SELECT pg_advisory_xact_lock(1)');
    const result = await db.query(
        `SELECT
            (
                SELECT json_build_object(
                    'id', id,
                    'cliente_nome', cliente_nome,
                    'servico_nome', servico_nome,
                    'inicio', inicio,
                    'fim', fim
                )
                FROM (
                    SELECT a.id, c.nome AS cliente_nome, s.nome AS servico_nome, a.inicio, a.fim
                    FROM agendamentos a
                    JOIN clientes c ON c.id = a.cliente_id
                    JOIN servicos s ON s.id = a.servico_id
                    WHERE a.status NOT IN ('cancelado', 'faltou')
                      AND ($3::bigint IS NULL OR a.id <> $3)
                      AND a.inicio < $2 AND a.fim > $1
                    ORDER BY a.inicio
                    LIMIT 1
                ) conflito
            ) AS agendamento,
            (
                SELECT json_build_object('id', id, 'inicio', inicio, 'fim', fim, 'motivo', motivo)
                FROM bloqueios
                WHERE inicio < $2 AND fim > $1
                LIMIT 1
            ) AS bloqueio`,
        [inicio, fim, ignorarId]
    );
    if (result.rows[0].bloqueio) {
        throw new HttpError(409, 'Esse horario esta bloqueado.', { bloqueio: result.rows[0].bloqueio });
    }
    if (result.rows[0].agendamento && !permitirConflito) {
        throw new HttpError(409, 'Esse horario conflita com outro agendamento.', {
            conflito: result.rows[0].agendamento,
            pode_confirmar_encaixe: true
        });
    }
    return result.rows[0].agendamento || null;
}

async function criar({ cliente_id, servico_id, inicio, observacoes, permitir_conflito, motivo_encaixe }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const servico = await obterServicoEValidarCliente(client, cliente_id, servico_id);
        const fim = new Date(inicio.getTime() + servico.duracao * 60000);
        const conflito = await validarConflito(client, inicio, fim, null, permitir_conflito);
        const result = await client.query(
            `INSERT INTO agendamentos
             (cliente_id, servico_id, inicio, fim, preco, observacoes, encaixe, motivo_encaixe)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [cliente_id, servico_id, inicio, fim, servico.preco, observacoes, Boolean(conflito), motivo_encaixe]
        );
        await client.query('COMMIT');
        return buscarPorId(result.rows[0].id);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function atualizar(id, campos) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const atual = await buscarPorId(id, client);
        if (!atual) throw new HttpError(404, 'Agendamento nao encontrado.');
        const clienteId = campos.cliente_id ?? atual.cliente_id;
        const servicoId = campos.servico_id ?? atual.servico_id;
        const inicio = campos.inicio ?? new Date(atual.inicio);
        const status = campos.status ?? atual.status;
        const pagamentoStatus = campos.pagamento_status ?? atual.pagamento_status;
        const valorPago = campos.valor_pago ?? atual.valor_pago;
        const servico = await obterServicoEValidarCliente(client, clienteId, servicoId);
        const fim = new Date(inicio.getTime() + servico.duracao * 60000);
        let conflito = null;
        if (!['cancelado', 'faltou'].includes(status)) {
            conflito = await validarConflito(client, inicio, fim, id, campos.permitir_conflito);
        }
        await client.query(
            `UPDATE agendamentos SET cliente_id=$1, servico_id=$2, inicio=$3, fim=$4,
             preco=$5, status=$6, observacoes=$7, pagamento_status=$8, forma_pagamento=$9,
             valor_pago=$10, confirmado_em=$11, pago_em=$12, encaixe=$13, motivo_encaixe=$14,
             atualizado_em=NOW() WHERE id=$15`,
            [
                clienteId, servicoId, inicio, fim, servico.preco, status,
                campos.observacoes !== undefined ? campos.observacoes : atual.observacoes,
                pagamentoStatus,
                campos.forma_pagamento !== undefined ? campos.forma_pagamento : atual.forma_pagamento,
                valorPago,
                campos.confirmado_em !== undefined
                    ? campos.confirmado_em
                    : (status === 'confirmado' && !atual.confirmado_em ? new Date() : atual.confirmado_em),
                campos.pago_em !== undefined
                    ? campos.pago_em
                    : (pagamentoStatus === 'pago' && !atual.pago_em ? new Date() : atual.pago_em),
                campos.encaixe !== undefined ? campos.encaixe : (Boolean(conflito) || atual.encaixe),
                campos.motivo_encaixe !== undefined ? campos.motivo_encaixe : atual.motivo_encaixe,
                id
            ]
        );
        await client.query('COMMIT');
        return buscarPorId(id);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function remover(id) {
    const result = await pool.query('DELETE FROM agendamentos WHERE id = $1 RETURNING id', [id]);
    return Boolean(result.rowCount);
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
