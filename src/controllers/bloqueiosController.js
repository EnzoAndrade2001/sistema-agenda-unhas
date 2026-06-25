const bloqueios = require('../models/bloqueios');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');

async function listar(req, res) {
    res.json(await bloqueios.listar(
        req.query.inicio ? validacao.data(req.query.inicio, 'inicio') : null,
        req.query.fim ? validacao.data(req.query.fim, 'fim') : null
    ));
}

async function criar(req, res) {
    const inicio = validacao.data(req.body.inicio);
    const fim = validacao.data(req.body.fim, 'fim');
    if (fim <= inicio) throw new HttpError(400, 'O fim deve ser posterior ao inicio.');
    res.status(201).json(await bloqueios.criar({
        inicio,
        fim,
        motivo: validacao.texto(req.body.motivo, 'motivo', { obrigatorio: false, max: 200 })
    }));
}

async function remover(req, res) {
    if (!(await bloqueios.remover(validacao.id(req.params.id)))) {
        throw new HttpError(404, 'Bloqueio nao encontrado.');
    }
    res.status(204).end();
}

module.exports = { listar, criar, remover };
