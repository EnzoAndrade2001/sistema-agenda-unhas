const { pool } = require('../config/database');

async function buscar() {
    const result = await pool.query(
        `SELECT intervalo_minutos, horario_abertura::text, horario_fechamento::text,
                dias_funcionamento, atualizado_em FROM configuracoes WHERE id = 1`
    );
    return result.rows[0];
}

async function atualizar(valores) {
    const result = await pool.query(
        `UPDATE configuracoes SET
            intervalo_minutos = COALESCE($1, intervalo_minutos),
            horario_abertura = COALESCE($2, horario_abertura),
            horario_fechamento = COALESCE($3, horario_fechamento),
            dias_funcionamento = COALESCE($4, dias_funcionamento),
            atualizado_em = NOW()
         WHERE id = 1
         RETURNING intervalo_minutos, horario_abertura::text, horario_fechamento::text,
                   dias_funcionamento, atualizado_em`,
        [
            valores.intervalo_minutos ?? null,
            valores.horario_abertura ?? null,
            valores.horario_fechamento ?? null,
            valores.dias_funcionamento ?? null
        ]
    );
    return result.rows[0];
}

module.exports = { buscar, atualizar };
