const { pool } = require('../config/database');

const colunas = 'id, nome, telefone, email, observacoes, ativo, criado_em, atualizado_em';

async function listar(busca, incluirInativos = false) {
    const values = [];
    const filtros = [];
    if (!incluirInativos) filtros.push('ativo = TRUE');
    if (busca) {
        values.push(`%${busca}%`);
        filtros.push(`(nome ILIKE $${values.length} OR telefone LIKE $${values.length})`);
    }
    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const result = await pool.query(`SELECT ${colunas} FROM clientes ${where} ORDER BY nome`, values);
    return result.rows;
}

async function buscarPorId(id) {
    const result = await pool.query(`SELECT ${colunas} FROM clientes WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

async function buscarPorTelefone(telefone) {
    const result = await pool.query(`SELECT ${colunas} FROM clientes WHERE telefone = $1 AND ativo = TRUE`, [telefone]);
    return result.rows[0] || null;
}

async function criar({ nome, telefone, email, observacoes }) {
    const result = await pool.query(
        `INSERT INTO clientes (nome, telefone, email, observacoes)
         VALUES ($1, $2, $3, $4) RETURNING ${colunas}`,
        [nome, telefone, email, observacoes]
    );
    return result.rows[0];
}

async function atualizar(id, campos) {
    const entries = Object.entries(campos);
    const sets = entries.map(([chave], index) => `${chave} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const result = await pool.query(
        `UPDATE clientes SET ${sets.join(', ')}, atualizado_em = NOW()
         WHERE id = $${values.length} RETURNING ${colunas}`,
        values
    );
    return result.rows[0] || null;
}

module.exports = { listar, buscarPorId, buscarPorTelefone, criar, atualizar };
