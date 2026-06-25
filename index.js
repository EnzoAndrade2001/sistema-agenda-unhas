const { createApp } = require('./src/app');
const { conectarBanco, pool } = require('./src/config/database');
const { executarMigracoes } = require('./src/config/migrations');

const PORT = Number(process.env.PORT) || 3000;

async function iniciarServidor() {
    await conectarBanco();
    await executarMigracoes();

    const app = createApp();
    const server = app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
    });

    const encerrar = () => {
        server.close(async () => {
            await pool.end();
            process.exit(0);
        });
    };

    process.on('SIGINT', encerrar);
    process.on('SIGTERM', encerrar);

    return server;
}

if (require.main === module) {
    iniciarServidor().catch((error) => {
        console.error('Erro ao iniciar o servidor:', error.message);
        process.exit(1);
    });
}

module.exports = { iniciarServidor };
