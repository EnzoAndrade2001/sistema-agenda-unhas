const { pool } = require('../config/database');
const { HttpError } = require('../utils/httpError');

async function listar(inicio, fim) {
    const result = await pool.query(
        `SELECT id, inicio, fim, motivo, criado_em FROM bloqueios
         WHERE ($1::timestamptz IS NULL OR fim > $1)
           AND ($2::timestamptz IS NULL OR inicio < $2)
         ORDER BY inicio`,
        [inicio || null, fim || null]
    );
    return result.rows;
}

async function criar({ inicio, fim, motivo }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(1)');
        const conflito = await client.query(
            `SELECT EXISTS(SELECT 1 FROM agendamentos
             WHERE status NOT IN ('cancelado', 'faltou') AND inicio < $2 AND fim > $1) AS existe`,
            [inicio, fim]
        );
        if (conflito.rows[0].existe) throw new HttpError(409, 'Ha um agendamento nesse periodo.');
        const result = await client.query(
            `INSERT INTO bloqueios (inicio, fim, motivo) VALUES ($1, $2, $3)
             RETURNING id, inicio, fim, motivo, criado_em`,
            [inicio, fim, motivo]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function remover(id) {
    const result = await pool.query('DELETE FROM bloqueios WHERE id = $1 RETURNING id', [id]);
    return Boolean(result.rowCount);
}

module.exports = { listar, criar, remover };
