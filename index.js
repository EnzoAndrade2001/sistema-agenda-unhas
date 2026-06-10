// index.js
const express = require('express');
const { conectarBanco } = require('./src/config/database');

const app = express();
const PORT = 3000;

// Permite que o Express entenda JSON enviado pelo frontend futuramente
app.use(express.json());

// Executa a função para testar a conexão com o banco
conectarBanco();

// Rota de teste inicial para ter certeza que o servidor está online
app.get('/', (req, res) => {
    res.send('🚀 Backend da Agenda de Unhas rodando com sucesso!');
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});