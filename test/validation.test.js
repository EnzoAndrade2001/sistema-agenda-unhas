const test = require('node:test');
const assert = require('node:assert/strict');
const validacao = require('../src/utils/validation');

test('normaliza telefone brasileiro', () => {
    assert.equal(validacao.telefone('(11) 99999-8888'), '11999998888');
});

test('rejeita telefone curto', () => {
    assert.throws(() => validacao.telefone('1234'), /10 e 13 digitos/);
});

test('aceita e converte dinheiro', () => {
    assert.equal(validacao.dinheiro('42.509'), 42.51);
});

test('rejeita data invalida', () => {
    assert.throws(() => validacao.data('nao-e-data'), /data invalida/);
});

test('valida ids positivos', () => {
    assert.equal(validacao.id('12'), 12);
    assert.throws(() => validacao.id('0'), /inteiro positivo/);
});
