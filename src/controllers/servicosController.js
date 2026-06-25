const servicos = require('../models/servicos');
const { HttpError } = require('../utils/httpError');
const validacao = require('../utils/validation');

async function listar(req, res) {
    res.json(await servicos.listar(req.query.incluir_inativos === 'true'));
}

async function buscar(req, res) {
    const servico = await servicos.buscarPorId(validacao.id(req.params.id));
    if (!servico) throw new HttpError(404, 'Servico nao encontrado.');
    res.json(servico);
}

async function criar(req, res) {
    const servico = await servicos.criar({
        nome: validacao.texto(req.body.nome, 'nome', { max: 100 }),
        descricao: validacao.texto(req.body.descricao, 'descricao', { obrigatorio: false, max: 1000 }),
        categoria: validacao.texto(req.body.categoria || 'Unhas', 'categoria', { max: 60 }),
        duracao_minutos: validacao.inteiro(req.body.duracao_minutos, 'duracao_minutos', 15, 480),
        preco: validacao.dinheiro(req.body.preco)
    });
    res.status(201).json(servico);
}

async function atualizar(req, res) {
    const campos = {};
    if (req.body.nome !== undefined) campos.nome = validacao.texto(req.body.nome, 'nome', { max: 100 });
    if (req.body.descricao !== undefined) {
        campos.descricao = validacao.texto(req.body.descricao, 'descricao', { obrigatorio: false, max: 1000 });
    }
    if (req.body.categoria !== undefined) campos.categoria = validacao.texto(req.body.categoria, 'categoria', { max: 60 });
    if (req.body.duracao_minutos !== undefined) {
        campos.duracao_minutos = validacao.inteiro(req.body.duracao_minutos, 'duracao_minutos', 15, 480);
    }
    if (req.body.preco !== undefined) campos.preco = validacao.dinheiro(req.body.preco);
    if (req.body.ativo !== undefined) {
        if (typeof req.body.ativo !== 'boolean') throw new HttpError(400, 'O campo ativo deve ser booleano.');
        campos.ativo = req.body.ativo;
    }
    if (!Object.keys(campos).length) throw new HttpError(400, 'Nenhum campo valido foi enviado.');
    const servico = await servicos.atualizar(validacao.id(req.params.id), campos);
    if (!servico) throw new HttpError(404, 'Servico nao encontrado.');
    res.json(servico);
}

module.exports = { listar, buscar, criar, atualizar };
