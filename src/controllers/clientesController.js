const clientes = require('../models/clientes');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');

async function listar(req, res) {
    const busca = req.query.busca ? validacao.texto(req.query.busca, 'busca', { max: 120 }) : null;
    res.json(await clientes.listar(busca, req.query.incluir_inativos === 'true'));
}

async function buscar(req, res) {
    const cliente = await clientes.buscarPorId(validacao.id(req.params.id));
    if (!cliente) throw new HttpError(404, 'Cliente nao encontrado.');
    res.json(cliente);
}

async function criar(req, res) {
    const cliente = await clientes.criar({
        nome: validacao.texto(req.body.nome, 'nome', { max: 120 }),
        telefone: validacao.telefone(req.body.telefone),
        email: validacao.email(req.body.email),
        observacoes: validacao.texto(req.body.observacoes, 'observacoes', { obrigatorio: false, max: 1000 })
    });
    res.status(201).json(cliente);
}

async function atualizar(req, res) {
    const campos = {};
    if (req.body.nome !== undefined) campos.nome = validacao.texto(req.body.nome, 'nome', { max: 120 });
    if (req.body.telefone !== undefined) campos.telefone = validacao.telefone(req.body.telefone);
    if (req.body.email !== undefined) campos.email = validacao.email(req.body.email);
    if (req.body.observacoes !== undefined) {
        campos.observacoes = validacao.texto(req.body.observacoes, 'observacoes', { obrigatorio: false, max: 1000 });
    }
    if (req.body.ativo !== undefined) {
        if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'O campo ativo deve ser booleano.');
        campos.ativo = req.body.ativo;
    }
    if (!Object.keys(campos).length) throw new HttpError(400, 'Nenhum campo valido foi enviado.');
    const cliente = await clientes.atualizar(validacao.id(req.params.id), campos);
    if (!cliente) throw new HttpError(404, 'Cliente nao encontrado.');
    res.json(cliente);
}

module.exports = { listar, buscar, criar, atualizar };
