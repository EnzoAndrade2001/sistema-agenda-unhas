const { Pool } = require('pg');

// Colocando os dados direto aqui para testar se funciona sem o .env
const banco = new Pool({
    user: 'postgres',
    password: '050419', // <-- COLOQUE AQUI A MESMA SENHA QUE VOCÊ CRIOU NO POSTGRES
    host: 'localhost',
    port: 5432,
    database: 'postgres'
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