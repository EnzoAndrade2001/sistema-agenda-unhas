const { HttpError } = require('./httpError');

function texto(value, campo, { obrigatorio = true, max = 500 } = {}) {
    if (value === undefined || value === null || value === '') {
        if (obrigatorio) throw new HttpError(400, `O campo ${campo} e obrigatorio.`);
        return null;
    }

    if (typeof value !== 'string') throw new HttpError(400, `O campo ${campo} deve ser texto.`);
    const normalizado = value.trim();
    if (!normalizado && obrigatorio) throw new HttpError(400, `O campo ${campo} e obrigatorio.`);
    if (normalizado.length > max) throw new HttpError(400, `O campo ${campo} excede ${max} caracteres.`);
    return normalizado || null;
}

function id(value, campo = 'id') {
    const numero = Number(value);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
        throw new HttpError(400, `O campo ${campo} deve ser um inteiro positivo.`);
    }
    return numero;
}

function dinheiro(value, campo = 'preco') {
    const numero = Number(value);
    if (!Number.isFinite(numero) || numero < 0) {
        throw new HttpError(400, `O campo ${campo} deve ser um valor positivo.`);
    }
    return Math.round(numero * 100) / 100;
}

function inteiro(value, campo, minimo, maximo) {
    const numero = Number(value);
    if (!Number.isInteger(numero) || numero < minimo || numero > maximo) {
        throw new HttpError(400, `O campo ${campo} deve estar entre ${minimo} e ${maximo}.`);
    }
    return numero;
}

function data(value, campo = 'inicio') {
    if (typeof value !== 'string' || !value.trim()) {
        throw new HttpError(400, `O campo ${campo} deve ser uma data ISO 8601.`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `O campo ${campo} possui data invalida.`);
    return parsed;
}

function telefone(value) {
    const original = texto(value, 'telefone', { max: 20 });
    const digitos = original.replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 13) {
        throw new HttpError(400, 'O telefone deve conter entre 10 e 13 digitos.');
    }
    return digitos;
}

function email(value, { obrigatorio = false } = {}) {
    const normalizado = texto(value, 'email', { obrigatorio, max: 160 });
    if (!normalizado) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
        throw new HttpError(400, 'O email informado e invalido.');
    }
    return normalizado.toLowerCase();
}

module.exports = { texto, id, dinheiro, inteiro, data, telefone, email };
