// src/config/database.js
require('dotenv').config();
const { Pool } = require('pg');

// Cria a conexão usando as variáveis do arquivo .env
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE
});

// Função para testar a conexão assim que o sistema iniciar
const conectarBanco = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ Conectado ao PostgreSQL com sucesso (Módulo Isolado)!');
        client.release(); // Libera o cliente de volta para o pool
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco de dados:', error.message);
        process.exit(1); // Fecha o sistema se não conseguir conectar
    }
};

// Exportamos o 'pool' para fazer consultas e a função de teste
module.exports = {
    pool,
    conectarBanco
};