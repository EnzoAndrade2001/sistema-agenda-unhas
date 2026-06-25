const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');

const baseUrl = 'https://api.mercadopago.com';

function accessToken() {
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
        throw new HttpError(503, 'MERCADO_PAGO_ACCESS_TOKEN nao configurado.');
    }
    return process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

function estaConfigurado() {
    return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken()}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new HttpError(response.status, data.message || 'Erro ao comunicar com Mercado Pago.', data);
    }
    return data;
}

function publicUrl(path) {
    const base = process.env.PUBLIC_BASE_URL;
    if (!base) return null;
    return `${base.replace(/\/$/, '')}${path}`;
}

async function criarPreferencia({ agendamento, pagamento }) {
    const body = {
        external_reference: `agendamento:${agendamento.id}:pagamento:${pagamento.id}`,
        items: [{
            id: String(agendamento.id),
            title: `Horario Karina - ${agendamento.servico_nome}`,
            description: `Cliente: ${agendamento.cliente_nome}`,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: Number(pagamento.valor)
        }],
        metadata: {
            agendamento_id: String(agendamento.id),
            pagamento_id: String(pagamento.id)
        }
    };

    const notificationUrl = publicUrl('/api/webhooks/mercado-pago');
    if (notificationUrl && notificationUrl.startsWith('https://')) body.notification_url = notificationUrl;

    const successUrl = publicUrl('/pagamento-sucesso.html');
    const failureUrl = publicUrl('/pagamento-falha.html');
    const pendingUrl = publicUrl('/pagamento-pendente.html');
    if (successUrl && failureUrl && pendingUrl) {
        body.back_urls = { success: successUrl, failure: failureUrl, pending: pendingUrl };
        body.auto_return = 'approved';
    }

    return request('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

async function buscarPagamento(paymentId) {
    return request(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

function validarAssinatura({ xSignature, xRequestId, dataId, secret }) {
    if (!secret) return true;
    if (!xSignature || !xRequestId || !dataId) return false;

    const parts = Object.fromEntries(xSignature.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key && key.trim(), value && value.trim()];
    }));
    if (!parts.ts || !parts.v1) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${parts.ts};`;
    const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    if (hash.length !== parts.v1.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(parts.v1));
}

function mapearStatus(status) {
    const mapa = {
        approved: 'pago',
        authorized: 'pendente',
        pending: 'pendente',
        in_process: 'pendente',
        in_mediation: 'pendente',
        rejected: 'falhou',
        cancelled: 'cancelado',
        refunded: 'reembolsado',
        charged_back: 'reembolsado'
    };
    return mapa[status] || 'pendente';
}

module.exports = { estaConfigurado, criarPreferencia, buscarPagamento, validarAssinatura, mapearStatus };
