const agendamentos = require('../models/agendamentos');
const clientes = require('../models/clientes');
const pagamentos = require('../models/pagamentos');
const mercadoPago = require('../services/mercadoPago');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');
const regrasPagamento = require('../utils/paymentRules');

function tipoPagamentoParaCobranca(tipoCobranca) {
    return tipoCobranca === 'total' ? 'total' : 'sinal';
}

function metodoOnline(metodo) {
    return ['pix_online', 'cartao_online'].includes(metodo);
}

function dadosPix(payment) {
    const transaction = payment.point_of_interaction && payment.point_of_interaction.transaction_data;
    return {
        qr_code: transaction && transaction.qr_code,
        qr_code_base64: transaction && transaction.qr_code_base64,
        ticket_url: transaction && transaction.ticket_url
    };
}

async function obterOuCriarCliente({ nome, telefone, email }) {
    const existente = await clientes.buscarPorTelefone(telefone);
    if (!existente) return clientes.criar({ nome, telefone, email });
    const atualizacoes = {};
    if (existente.nome !== nome) atualizacoes.nome = nome;
    if (email && existente.email !== email) atualizacoes.email = email;
    if (!Object.keys(atualizacoes).length) return existente;
    return clientes.atualizar(existente.id, atualizacoes);
}

async function agendar(req, res) {
    const metodoSolicitado = req.body.metodo_pagamento_preferido || 'pix_online';
    const nome = validacao.texto(req.body.nome, 'nome', { max: 120 });
    const telefone = validacao.telefone(req.body.telefone);
    const email = validacao.email(req.body.email, { obrigatorio: metodoOnline(metodoSolicitado) });
    const inicio = validacao.data(req.body.inicio);
    if (inicio <= new Date()) throw new HttpError(400, 'O agendamento deve ser feito em uma data futura.');

    const tipoCobranca = regrasPagamento.validarTipoCobranca(req.body.tipo_cobranca || 'sinal_30');
    const metodoPreferido = regrasPagamento.validarMetodoPreferido(metodoSolicitado);
    regrasPagamento.validarCombinacao(tipoCobranca, metodoPreferido);
    if (metodoOnline(metodoPreferido) && !mercadoPago.estaConfigurado()) {
        throw new HttpError(503, 'Mercado Pago ainda nao configurado.');
    }

    const cliente = await obterOuCriarCliente({ nome, telefone, email });
    const agendamento = await agendamentos.criar({
        cliente_id: cliente.id,
        servico_id: validacao.id(req.body.servico_id, 'servico_id'),
        inicio,
        observacoes: validacao.texto(req.body.observacoes, 'observacoes', { obrigatorio: false, max: 1000 }),
        permitir_conflito: false,
        tipo_cobranca: tipoCobranca,
        metodo_pagamento_preferido: metodoPreferido
    });

    if (!metodoOnline(metodoPreferido)) {
        return res.status(201).json({ agendamento, pagamento: null });
    }

    const tipo = tipoPagamentoParaCobranca(tipoCobranca);
    const valor = tipo === 'sinal' ? agendamento.valor_sinal : agendamento.preco;
    if (valor <= 0) throw new HttpError(400, 'Valor de cobranca deve ser maior que zero.');

    let atualizado;
    let pix = null;
    try {
        const pagamento = await pagamentos.criarPendente({
            agendamento_id: agendamento.id,
            valor,
            provedor: 'mercado_pago',
            metodo: metodoPreferido,
            tipo
        });
        if (metodoPreferido === 'pix_online') {
            const payment = await mercadoPago.criarPagamentoPix({
                agendamento,
                pagamento,
                payer: { nome: cliente.nome, email: cliente.email || email }
            });
            const status = mercadoPago.mapearStatus(payment.status);
            pix = dadosPix(payment);
            atualizado = await pagamentos.atualizar(pagamento.id, {
                status,
                mercado_pago_payment_id: String(payment.id),
                checkout_url: pix.ticket_url,
                payload: payment
            });
            if (status === 'pago') await pagamentos.sincronizarAgendamento(undefined, agendamento.id);
        } else {
            const preference = await mercadoPago.criarPreferencia({ agendamento, pagamento });
            atualizado = await pagamentos.atualizar(pagamento.id, {
                mercado_pago_preference_id: preference.id,
                checkout_url: preference.init_point,
                sandbox_checkout_url: preference.sandbox_init_point,
                payload: preference
            });
        }
    } catch (error) {
        await agendamentos.remover(agendamento.id);
        throw error;
    }

    res.status(201).json({
        agendamento,
        pagamento: {
            ...atualizado,
            pix
        }
    });
}

module.exports = { agendar };
