require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_DATABASE
    };

const pool = new Pool({
    ...poolConfig,
    options: '-c timezone=America/Sao_Paulo',
    max: 10,
    idleTimeoutMillis: 30000
});

pool.on('error', (error) => {
    console.error('Erro inesperado no PostgreSQL:', error.message);
});

async function conectarBanco() {
    const client = await pool.connect();
    client.release();
    console.log('Conectado ao PostgreSQL.');
}

module.exports = { pool, conectarBanco };
