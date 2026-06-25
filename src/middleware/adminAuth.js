const { HttpError } = require('../utils/httpError');

function adminProtegido() {
    return Boolean(process.env.ADMIN_TOKEN);
}

function exigirAdmin(req, res, next) {
    if (!adminProtegido()) return next();
    const token = req.get('x-admin-token');
    if (token && token === process.env.ADMIN_TOKEN) return next();
    return next(new HttpError(401, 'Acesso administrativo nao autorizado.'));
}

function statusAdmin(req, res) {
    res.json({ protegido: adminProtegido() });
}

module.exports = { exigirAdmin, statusAdmin };
