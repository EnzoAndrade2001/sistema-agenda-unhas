const express = require('express');
const path = require('path');
const routes = require('./routes');
const { HttpError } = require('./utils/httpError');

function createApp() {
    const app = express();
    const adminPath = process.env.ADMIN_PATH || '/admin';
    const publicDir = path.join(__dirname, '..', 'public');
    app.disable('x-powered-by');
    app.use(express.json({ limit: '100kb' }));
    app.use((req, res, next) => {
        res.set({
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
        });
        if (req.method === 'OPTIONS') return res.status(204).end();
        next();
    });

    app.get('/admin.html', (req, res) => res.status(404).send('Not found'));
    app.get('/app.js', (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.sendFile(path.join(publicDir, 'app.js'));
    });
    app.get(adminPath, (req, res) => {
        res.set('Cache-Control', 'no-store');
        res.sendFile(path.join(publicDir, 'admin.html'));
    });
    if (adminPath !== '/admin') {
        app.get('/admin', (req, res) => res.status(404).send('Not found'));
    }
    app.use(express.static(publicDir));
    app.get('/servicos', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
    app.get('/api', (req, res) => res.json({
        endpoints: [
            '/api/clientes', '/api/servicos', '/api/agendamentos',
            '/api/bloqueios', '/api/disponibilidade', '/api/disponibilidade/grade',
            '/api/lembretes/retorno', '/api/resumo', '/api/configuracoes'
        ]
    }));
    app.use('/api', routes);
    app.use((req, res, next) => next(new HttpError(404, 'Rota nao encontrada.')));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        if (error.type === 'entity.parse.failed') {
            return res.status(400).json({ erro: 'JSON invalido.' });
        }
        if (error.code === '23505') {
            return res.status(409).json({ erro: 'Ja existe um cadastro com esses dados.' });
        }
        if (error.code === '23503') {
            return res.status(409).json({ erro: 'O registro esta em uso e nao pode ser removido.' });
        }
        const status = error.status || 500;
        if (status === 500) console.error(error);
        return res.status(status).json({
            erro: status === 500 ? 'Erro interno do servidor.' : error.message,
            ...(error.details ? { detalhes: error.details } : {})
        });
    });
    return app;
}

module.exports = { createApp };
