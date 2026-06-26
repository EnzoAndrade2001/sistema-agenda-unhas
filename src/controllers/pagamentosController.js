const agendamentos = require('../models/agendamentos');
const pagamentos = require('../models/pagamentos');
const mercadoPago = require('../services/mercadoPago');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');
const regrasPagamento = require('../utils/paymentRules');

const metodosOnline = ['pix_online', 'cartao_online'];

function validarMetodoOnline(value = 'pix_online') {
    const metodo = validacao.texto(value, 'metodo', { max: 30 });
    if (!metodosOnline.includes(metodo)) throw new HttpError(400, `Metodo online invalido. Use: ${metodosOnline.join(', ')}.`);
    return metodo;
}

async function listar(req, res) {
    res.json(await pagamentos.listar({
        agendamentoId: req.query.agendamento_id ? validacao.id(req.query.agendamento_id, 'agendamento_id') : undefined
    }));
}

async function buscar(req, res) {
    const pagamento = await pagamentos.buscarPorId(validacao.id(req.params.id));
    if (!pagamento) throw new HttpError(404, 'Pagamento nao encontrado.');
    res.json(pagamento);
}

async function registrarManual(req, res) {
    const agendamentoId = validacao.id(req.body.agendamento_id, 'agendamento_id');
    const pagamento = await pagamentos.registrarManual({
        agendamento_id: agendamentoId,
        valor: validacao.dinheiro(req.body.valor, 'valor'),
        metodo: regrasPagamento.validarMetodoManual(req.body.metodo || 'dinheiro'),
        tipo: regrasPagamento.validarTipoPagamento(req.body.tipo || 'manual')
    });
    res.status(201).json(pagamento);
}

async function criarMercadoPago(req, res) {
    if (!mercadoPago.estaConfigurado()) {
        throw new HttpError(503, 'MERCADO_PAGO_ACCESS_TOKEN nao configurado.');
    }
    const agendamentoId = validacao.id(req.body.agendamento_id || req.params.agendamentoId, 'agendamento_id');
    const agendamento = await agendamentos.buscarPorId(agendamentoId);
    if (!agendamento) throw new HttpError(404, 'Agendamento nao encontrado.');
    if (['cancelado', 'faltou'].includes(agendamento.status)) {
        throw new HttpError(409, 'Nao e possivel cobrar um agendamento cancelado ou com falta.');
    }
    const metodo = validarMetodoOnline(req.body.metodo || agendamento.metodo_pagamento_preferido || 'pix_online');
    const tipo = regrasPagamento.validarTipoPagamento(req.body.tipo || (agendamento.tipo_cobranca === 'total' ? 'total' : 'sinal'));
    const valorPadrao = tipo === 'sinal' ? agendamento.valor_sinal : agendamento.preco;
    const valor = req.body.valor !== undefined ? validacao.dinheiro(req.body.valor, 'valor') : valorPadrao;
    if (valor <= 0) throw new HttpError(400, 'Valor de cobranca deve ser maior que zero.');
    const pagamento = await pagamentos.criarPendente({
        agendamento_id: agendamentoId,
        valor,
        provedor: 'mercado_pago',
        metodo,
        tipo
    });
    const preference = await mercadoPago.criarPreferencia({ agendamento, pagamento });
    const atualizado = await pagamentos.atualizar(pagamento.id, {
        mercado_pago_preference_id: preference.id,
        checkout_url: preference.init_point,
        sandbox_checkout_url: preference.sandbox_init_point,
        payload: preference
    });
    res.status(201).json(atualizado);
}

async function webhookMercadoPago(req, res) {
    const dataId = req.query['data.id'] || (req.body.data && req.body.data.id);
    const type = req.query.type || req.body.type;
    const ok = mercadoPago.validarAssinatura({
        xSignature: req.headers['x-signature'],
        xRequestId: req.headers['x-request-id'],
        dataId,
        secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET
    });
    if (!ok) throw new HttpError(401, 'Assinatura do Mercado Pago invalida.');

    if (type !== 'payment' || !dataId) return res.status(200).json({ recebido: true, ignorado: true });

    const payment = await mercadoPago.buscarPagamento(dataId);
    await pagamentos.atualizarPorMercadoPago({
        paymentId: String(payment.id),
        preferenceId: payment.preference_id,
        externalReference: payment.external_reference,
        status: mercadoPago.mapearStatus(payment.status),
        valor: payment.transaction_amount,
        metodo: payment.payment_method_id || payment.payment_type_id,
        payload: payment
    });
    res.status(200).json({ recebido: true });
}

module.exports = { listar, buscar, registrarManual, criarMercadoPago, webhookMercadoPago };
