require('dotenv').config();
const { Pool } = require('pg');

const banco = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, // <-- Protegido! Puxa do .env
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE
});

async function testarSistema() {
    try {
        console.log('🚀 Tentando conectar ao PostgreSQL nativo direto...');

        const resultadoHora = await banco.query('SELECT NOW()');
        console.log('✅ Conectado com sucesso! Hora no banco:', resultadoHora.rows[0].now);

        console.log('\n👤 Cadastrando cliente de teste...');
        
        const nomeCliente = 'Bruna Oliveira';
        const celularCliente = '5551999998888';

        const queryInserir = `
            INSERT INTO clientes (nome, celular) 
            VALUES ($1, $2) 
            ON CONFLICT (celular) DO NOTHING 
            RETURNING *;
        `;

        const resultadoInsert = await banco.query(queryInserir, [nomeCliente, celularCliente]);

        if (resultadoInsert.rows.length > 0) {
            console.log('🎉 Cliente cadastrada com sucesso via JavaScript:', resultadoInsert.rows[0]);
        } else {
            console.log('⚠️ Essa cliente já existia no banco de dados.');
        }

    } catch (erro) {
        console.error('❌ Erro crítico no sistema:', erro.message);
    } finally {
        await banco.end();
        console.log('\n🔒 Conexão encerrada.');
    }
}

testarSistema();