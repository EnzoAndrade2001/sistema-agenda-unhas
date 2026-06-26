const agendamentos = require('../models/agendamentos');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');
const regrasPagamento = require('../utils/paymentRules');

const statuses = ['agendado', 'confirmado', 'concluido', 'cancelado', 'faltou'];
const pagamentos = ['pendente', 'parcial', 'pago', 'reembolsado', 'cancelado'];

function validarStatus(value) {
    if (!statuses.includes(value)) throw new HttpError(400, `Status invalido. Use: ${statuses.join(', ')}.`);
    return value;
}

function validarPagamentoStatus(value) {
    if (!pagamentos.includes(value)) throw new HttpError(400, `Status de pagamento invalido. Use: ${pagamentos.join(', ')}.`);
    return value;
}

function booleano(value, campo) {
    if (value === undefined) return false;
    if (typeof value !== 'boolean') throw new HttpError(400, `O campo ${campo} deve ser booleano.`);
    return value;
}

async function listar(req, res) {
    res.json(await agendamentos.listar({
        inicio: req.query.inicio ? validacao.data(req.query.inicio, 'inicio') : undefined,
        fim: req.query.fim ? validacao.data(req.query.fim, 'fim') : undefined,
        status: req.query.status ? validarStatus(req.query.status) : undefined,
        clienteId: req.query.cliente_id ? validacao.id(req.query.cliente_id, 'cliente_id') : undefined
    }));
}

async function buscar(req, res) {
    const agendamento = await agendamentos.buscarPorId(validacao.id(req.params.id));
    if (!agendamento) throw new HttpError(404, 'Agendamento nao encontrado.');
    res.json(agendamento);
}

async function criar(req, res) {
    const inicio = validacao.data(req.body.inicio);
    if (inicio <= new Date()) throw new HttpError(400, 'O agendamento deve ser feito em uma data futura.');
    const agendamento = await agendamentos.criar({
        cliente_id: validacao.id(req.body.cliente_id, 'cliente_id'),
        servico_id: validacao.id(req.body.servico_id, 'servico_id'),
        inicio,
        observacoes: validacao.texto(req.body.observacoes, 'observacoes', { obrigatorio: false, max: 1000 }),
        permitir_conflito: booleano(req.body.permitir_conflito, 'permitir_conflito'),
        motivo_encaixe: validacao.texto(req.body.motivo_encaixe, 'motivo_encaixe', { obrigatorio: false, max: 300 }),
        tipo_cobranca: regrasPagamento.validarTipoCobranca(req.body.tipo_cobranca || 'pagar_na_hora'),
        metodo_pagamento_preferido: regrasPagamento.validarMetodoPreferido(req.body.metodo_pagamento_preferido || 'pix_manual')
    });
    res.status(201).json(agendamento);
}

async function atualizar(req, res) {
    const campos = {};
    if (req.body.cliente_id !== undefined) campos.cliente_id = validacao.id(req.body.cliente_id, 'cliente_id');
    if (req.body.servico_id !== undefined) campos.servico_id = validacao.id(req.body.servico_id, 'servico_id');
    if (req.body.inicio !== undefined) campos.inicio = validacao.data(req.body.inicio);
    if (req.body.status !== undefined) campos.status = validarStatus(req.body.status);
    if (req.body.pagamento_status !== undefined) campos.pagamento_status = validarPagamentoStatus(req.body.pagamento_status);
    if (req.body.tipo_cobranca !== undefined) campos.tipo_cobranca = regrasPagamento.validarTipoCobranca(req.body.tipo_cobranca);
    if (req.body.metodo_pagamento_preferido !== undefined) {
        campos.metodo_pagamento_preferido = regrasPagamento.validarMetodoPreferido(req.body.metodo_pagamento_preferido);
    }
    if (req.body.forma_pagamento !== undefined) {
        campos.forma_pagamento = validacao.texto(req.body.forma_pagamento, 'forma_pagamento', { obrigatorio: false, max: 30 });
    }
    if (req.body.valor_pago !== undefined) campos.valor_pago = validacao.dinheiro(req.body.valor_pago, 'valor_pago');
    if (req.body.permitir_conflito !== undefined) campos.permitir_conflito = booleano(req.body.permitir_conflito, 'permitir_conflito');
    if (req.body.encaixe !== undefined) campos.encaixe = booleano(req.body.encaixe, 'encaixe');
    if (req.body.motivo_encaixe !== undefined) {
        campos.motivo_encaixe = validacao.texto(req.body.motivo_encaixe, 'motivo_encaixe', { obrigatorio: false, max: 300 });
    }
    if (req.body.observacoes !== undefined) {
        campos.observacoes = validacao.texto(req.body.observacoes, 'observacoes', { obrigatorio: false, max: 1000 });
    }
    if (!Object.keys(campos).length) throw new HttpError(400, 'Nenhum campo valido foi enviado.');
    res.json(await agendamentos.atualizar(validacao.id(req.params.id), campos));
}

async function remover(req, res) {
    if (!(await agendamentos.remover(validacao.id(req.params.id)))) {
        throw new HttpError(404, 'Agendamento nao encontrado.');
    }
    res.status(204).end();
}

module.exports = { listar, buscar, criar, atualizar, remover };
