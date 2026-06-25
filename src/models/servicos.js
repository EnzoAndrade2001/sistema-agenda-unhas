const { pool } = require('../config/database');

const colunas = `id, nome, descricao, categoria, duracao_minutos,
    preco::float AS preco, ativo, criado_em, atualizado_em`;

async function listar(incluirInativos = false) {
    const where = incluirInativos ? '' : 'WHERE ativo = TRUE';
    const result = await pool.query(`SELECT ${colunas} FROM servicos ${where} ORDER BY nome`);
    return result.rows;
}

async function buscarPorId(id) {
    const result = await pool.query(`SELECT ${colunas} FROM servicos WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

async function criar({ nome, descricao, categoria, duracao_minutos, preco }) {
    const result = await pool.query(
        `INSERT INTO servicos (nome, descricao, categoria, duracao_minutos, preco)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${colunas}`,
        [nome, descricao, categoria || 'Unhas', duracao_minutos, preco]
    );
    return result.rows[0];
}

async function atualizar(id, campos) {
    const entries = Object.entries(campos);
    const sets = entries.map(([chave], index) => `${chave} = $${index + 1}`);
    const values = entries.map(([, value]) => value);
    values.push(id);
    const result = await pool.query(
        `UPDATE servicos SET ${sets.join(', ')}, atualizado_em = NOW()
         WHERE id = $${values.length} RETURNING ${colunas}`,
        values
    );
    return result.rows[0] || null;
}

module.exports = { listar, buscarPorId, criar, atualizar };
