const { pool } = require('../config/database');
const configuracoes = require('../models/configuracoes');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');

function dataLocal(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new HttpError(400, 'A data deve estar no formato AAAA-MM-DD.');
    }
    const parsed = new Date(`${value}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new HttpError(400, 'Data invalida.');
    }
    return value;
}

async function infoPublica(req, res) {
    res.json({
        nome: 'Nails by Karina',
        subtitulo: 'Unhas com cuidado, beleza e horario marcado.',
        whatsapp: process.env.WHATSAPP_BUSINESS_NUMBER || null
    });
}

async function disponibilidade(req, res) {
    const dia = dataLocal(req.query.data);
    const servicoId = validacao.id(req.query.servico_id, 'servico_id');
    const result = await pool.query(
        `SELECT slot.inicio
         FROM configuracoes c
         JOIN servicos s ON s.id = $2 AND s.ativo
         CROSS JOIN LATERAL generate_series(
             ($1::date + c.horario_abertura)::timestamptz,
             ($1::date + c.horario_fechamento)::timestamptz
                 - make_interval(mins => s.duracao_minutos),
             make_interval(mins => c.intervalo_minutos)
         ) AS slot(inicio)
         WHERE EXTRACT(ISODOW FROM $1::date)::smallint = ANY(c.dias_funcionamento)
           AND slot.inicio >= NOW()
           AND NOT EXISTS (
               SELECT 1 FROM agendamentos a
               WHERE a.status NOT IN ('cancelado', 'faltou')
                 AND a.inicio < slot.inicio + make_interval(mins => s.duracao_minutos)
                 AND a.fim > slot.inicio
           )
           AND NOT EXISTS (
               SELECT 1 FROM bloqueios b
               WHERE b.inicio < slot.inicio + make_interval(mins => s.duracao_minutos)
                 AND b.fim > slot.inicio
           )
         ORDER BY slot.inicio`,
        [dia, servicoId]
    );
    res.json(result.rows.map((row) => row.inicio));
}

async function gradeDisponibilidade(req, res) {
    const dia = dataLocal(req.query.data);
    const servicoId = validacao.id(req.query.servico_id, 'servico_id');
    const result = await pool.query(
        `SELECT
            slot.inicio,
            slot.inicio + make_interval(mins => s.duracao_minutos) AS fim,
            EXISTS (
                SELECT 1 FROM agendamentos a
                WHERE a.status NOT IN ('cancelado', 'faltou')
                  AND a.inicio < slot.inicio + make_interval(mins => s.duracao_minutos)
                  AND a.fim > slot.inicio
            ) AS ocupado,
            EXISTS (
                SELECT 1 FROM bloqueios b
                WHERE b.inicio < slot.inicio + make_interval(mins => s.duracao_minutos)
                  AND b.fim > slot.inicio
            ) AS bloqueado
         FROM configuracoes c
         JOIN servicos s ON s.id = $2 AND s.ativo
         CROSS JOIN LATERAL generate_series(
             ($1::date + c.horario_abertura)::timestamptz,
             ($1::date + c.horario_fechamento)::timestamptz
                 - make_interval(mins => s.duracao_minutos),
             make_interval(mins => c.intervalo_minutos)
         ) AS slot(inicio)
         WHERE EXTRACT(ISODOW FROM $1::date)::smallint = ANY(c.dias_funcionamento)
         ORDER BY slot.inicio`,
        [dia, servicoId]
    );
    const agora = new Date();
    res.json(result.rows.map((row) => {
        const passado = new Date(row.inicio) < agora;
        const motivo = passado ? 'passado' : (row.bloqueado ? 'bloqueado' : (row.ocupado ? 'ocupado' : null));
        return {
            inicio: row.inicio,
            fim: row.fim,
            disponivel: !motivo,
            motivo
        };
    }));
}

async function lembretesRetorno(req, res) {
    const result = await pool.query(
        `SELECT a.id AS agendamento_id, a.inicio, a.fim, a.preco::float AS preco,
                c.id AS cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone,
                s.nome AS servico_nome,
                a.lembrete_retorno_em::text AS data_retorno,
                a.lembrete_retorno_observacoes,
                (a.lembrete_retorno_em - CURRENT_DATE)::int AS dias_restantes
         FROM agendamentos a
         JOIN clientes c ON c.id = a.cliente_id
         JOIN servicos s ON s.id = a.servico_id
         WHERE a.lembrete_retorno_em IS NOT NULL
           AND a.lembrete_retorno_concluido = FALSE
           AND a.lembrete_retorno_em BETWEEN CURRENT_DATE - INTERVAL '30 days'
               AND CURRENT_DATE + INTERVAL '7 days'
           AND NOT EXISTS (
               SELECT 1 FROM agendamentos futuro
               WHERE futuro.cliente_id = a.cliente_id
                 AND futuro.status NOT IN ('cancelado', 'faltou')
                 AND futuro.inicio > a.inicio
           )
         ORDER BY data_retorno, a.inicio
         LIMIT 30`
    );
    res.json(result.rows);
}

async function resumo(req, res) {
    const dia = dataLocal(req.query.data || new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo'
    }).format(new Date()));
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status NOT IN ('cancelado', 'faltou'))::int AS total,
            COUNT(*) FILTER (WHERE status = 'confirmado')::int AS confirmados,
            COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos,
            COALESCE(SUM(preco) FILTER (WHERE status = 'concluido'), 0)::float AS faturamento,
            COUNT(*) FILTER (WHERE pagamento_status = 'pago')::int AS pagos,
            COUNT(*) FILTER (WHERE pagamento_status IN ('pendente', 'parcial'))::int AS pagamentos_pendentes,
            COALESCE(SUM(valor_pago), 0)::float AS recebido,
            COUNT(*) FILTER (WHERE status = 'cancelado')::int AS cancelados
         FROM agendamentos
         WHERE inicio >= $1::date AND inicio < $1::date + INTERVAL '1 day'`,
        [dia]
    );
    res.json({ data: dia, ...result.rows[0] });
}

async function buscarConfiguracoes(req, res) {
    res.json(await configuracoes.buscar());
}

async function atualizarConfiguracoes(req, res) {
    const valores = {};
    if (req.body.intervalo_minutos !== undefined) {
        valores.intervalo_minutos = validacao.inteiro(req.body.intervalo_minutos, 'intervalo_minutos', 5, 120);
    }
    for (const campo of ['horario_abertura', 'horario_fechamento']) {
        if (req.body[campo] !== undefined) {
            if (typeof req.body[campo] !== 'string' || !/^\d{2}:\d{2}$/.test(req.body[campo])) {
                throw new HttpError(400, `${campo} deve estar no formato HH:MM.`);
            }
            valores[campo] = req.body[campo];
        }
    }
    if (req.body.dias_funcionamento !== undefined) {
        const dias = req.body.dias_funcionamento;
        if (!Array.isArray(dias) || !dias.length || dias.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 7)) {
            throw new HttpError(400, 'dias_funcionamento deve conter numeros de 1 (segunda) a 7 (domingo).');
        }
        valores.dias_funcionamento = [...new Set(dias)];
    }
    if (!Object.keys(valores).length) throw new HttpError(400, 'Nenhuma configuracao valida foi enviada.');
    const atuais = await configuracoes.buscar();
    const abertura = valores.horario_abertura || atuais.horario_abertura.slice(0, 5);
    const fechamento = valores.horario_fechamento || atuais.horario_fechamento.slice(0, 5);
    if (fechamento <= abertura) throw new HttpError(400, 'O horario de fechamento deve ser posterior a abertura.');
    res.json(await configuracoes.atualizar(valores));
}

module.exports = {
    infoPublica,
    disponibilidade,
    gradeDisponibilidade,
    lembretesRetorno,
    resumo,
    buscarConfiguracoes,
    atualizarConfiguracoes
};
