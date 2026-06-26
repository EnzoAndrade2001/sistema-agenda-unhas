const crypto = require('crypto');
const { HttpError } = require('../utils/httpError');

const COOKIE_NAME = 'karina_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map();

function adminProtegido() {
    return Boolean(process.env.ADMIN_TOKEN);
}

function cookieSeguro() {
    return process.env.NODE_ENV === 'production'
        || (process.env.PUBLIC_BASE_URL || '').startsWith('https://');
}

function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').map((item) => {
        const [key, ...value] = item.trim().split('=');
        return [key, decodeURIComponent(value.join('='))];
    }).filter(([key]) => key));
}

function assinar(payload) {
    return crypto
        .createHmac('sha256', process.env.ADMIN_TOKEN)
        .update(payload)
        .digest('base64url');
}

function criarSessao() {
    const payload = Buffer.from(JSON.stringify({
        iat: Date.now(),
        exp: Date.now() + SESSION_SECONDS * 1000
    })).toString('base64url');
    return `${payload}.${assinar(payload)}`;
}

function sessaoValida(req) {
    if (!adminProtegido()) return true;
    const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!token || !token.includes('.')) return false;
    const [payload, signature] = token.split('.');
    const expected = assinar(payload);
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return Number(data.exp) > Date.now();
    } catch (error) {
        return false;
    }
}

function setSessionCookie(res) {
    const secure = cookieSeguro() ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${encodeURIComponent(criarSessao())}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`
    );
}

function clearSessionCookie(res) {
    const secure = cookieSeguro() ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function clientKey(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}

function registrarFalha(req) {
    const key = clientKey(req);
    const now = Date.now();
    const current = attempts.get(key);
    if (!current || current.resetAt < now) {
        attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return;
    }
    current.count += 1;
}

function muitasTentativas(req) {
    const current = attempts.get(clientKey(req));
    return Boolean(current && current.resetAt > Date.now() && current.count >= MAX_ATTEMPTS);
}

function limparTentativas(req) {
    attempts.delete(clientKey(req));
}

function exigirAdmin(req, res, next) {
    if (!adminProtegido() || sessaoValida(req)) return next();
    return next(new HttpError(401, 'Acesso administrativo nao autorizado.'));
}

function statusAdmin(req, res) {
    res.json({ protegido: adminProtegido(), autenticado: sessaoValida(req) });
}

function loginAdmin(req, res, next) {
    if (!adminProtegido()) return res.json({ autenticado: true });
    if (muitasTentativas(req)) {
        return next(new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'));
    }
    if (!req.body || req.body.token !== process.env.ADMIN_TOKEN) {
        registrarFalha(req);
        return next(new HttpError(401, 'Senha administrativa invalida.'));
    }
    limparTentativas(req);
    setSessionCookie(res);
    res.json({ autenticado: true });
}

function logoutAdmin(req, res) {
    clearSessionCookie(res);
    res.status(204).end();
}

module.exports = {
    exigirAdmin,
    statusAdmin,
    loginAdmin,
    logoutAdmin
};
