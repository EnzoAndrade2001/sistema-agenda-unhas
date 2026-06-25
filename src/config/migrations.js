const { pool } = require('./database');

const schema = `
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS clientes_telefone_ativo_idx
    ON clientes (telefone) WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS servicos (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(60) NOT NULL DEFAULT 'Unhas',
    duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos BETWEEN 15 AND 480),
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE servicos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE servicos ADD COLUMN IF NOT EXISTS categoria VARCHAR(60) NOT NULL DEFAULT 'Unhas';

CREATE TABLE IF NOT EXISTS agendamentos (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id),
    servico_id BIGINT NOT NULL REFERENCES servicos(id),
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ NOT NULL,
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'agendado'
        CHECK (status IN ('agendado', 'confirmado', 'concluido', 'cancelado', 'faltou')),
    pagamento_status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (pagamento_status IN ('pendente', 'parcial', 'pago', 'reembolsado', 'cancelado')),
    forma_pagamento VARCHAR(30),
    valor_pago NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
    confirmado_em TIMESTAMPTZ,
    pago_em TIMESTAMPTZ,
    encaixe BOOLEAN NOT NULL DEFAULT FALSE,
    motivo_encaixe VARCHAR(300),
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fim > inicio)
);

ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pagamento_status VARCHAR(20) NOT NULL DEFAULT 'pendente';
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(30);
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS encaixe BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE agendamentos ADD COLUMN IF NOT EXISTS motivo_encaixe VARCHAR(300);

CREATE INDEX IF NOT EXISTS agendamentos_inicio_idx ON agendamentos (inicio);
CREATE INDEX IF NOT EXISTS agendamentos_cliente_idx ON agendamentos (cliente_id);
CREATE INDEX IF NOT EXISTS agendamentos_pagamento_status_idx ON agendamentos (pagamento_status);

CREATE TABLE IF NOT EXISTS pagamentos (
    id BIGSERIAL PRIMARY KEY,
    agendamento_id BIGINT NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    provedor VARCHAR(30) NOT NULL DEFAULT 'manual',
    metodo VARCHAR(30),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pendente', 'parcial', 'pago', 'reembolsado', 'cancelado', 'falhou')),
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    mercado_pago_preference_id VARCHAR(120),
    mercado_pago_payment_id VARCHAR(120),
    checkout_url TEXT,
    sandbox_checkout_url TEXT,
    payload JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pagamentos_agendamento_idx ON pagamentos (agendamento_id);
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_mp_preference_idx
    ON pagamentos (mercado_pago_preference_id) WHERE mercado_pago_preference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_mp_payment_idx
    ON pagamentos (mercado_pago_payment_id) WHERE mercado_pago_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bloqueios (
    id BIGSERIAL PRIMARY KEY,
    inicio TIMESTAMPTZ NOT NULL,
    fim TIMESTAMPTZ NOT NULL,
    motivo VARCHAR(200),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fim > inicio)
);

CREATE INDEX IF NOT EXISTS bloqueios_inicio_idx ON bloqueios (inicio);

CREATE TABLE IF NOT EXISTS configuracoes (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    intervalo_minutos INTEGER NOT NULL DEFAULT 30 CHECK (intervalo_minutos BETWEEN 5 AND 120),
    horario_abertura TIME NOT NULL DEFAULT '08:00',
    horario_fechamento TIME NOT NULL DEFAULT '19:00',
    dias_funcionamento SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

INSERT INTO servicos (nome, descricao, categoria, duracao_minutos, preco)
SELECT * FROM (VALUES
    ('Manicure simples', 'Corte, lixamento, cuticula e esmaltacao comum.', 'Maos', 60, 45.00),
    ('Pedicure simples', 'Corte, lixamento, cuticula e esmaltacao comum nos pes.', 'Pes', 60, 50.00),
    ('Pe e mao', 'Manicure e pedicure no mesmo horario.', 'Combo', 120, 90.00),
    ('Esmaltacao em gel', 'Esmaltacao em gel com acabamento duradouro.', 'Gel', 90, 80.00),
    ('Blindagem', 'Camada de protecao para fortalecer a unha natural.', 'Tratamento', 90, 95.00),
    ('Banho de gel', 'Estruturacao leve em gel sobre a unha natural.', 'Gel', 120, 130.00),
    ('Alongamento fibra de vidro', 'Aplicacao completa de alongamento em fibra.', 'Alongamento', 180, 180.00),
    ('Manutencao de alongamento', 'Manutencao periodica do alongamento.', 'Alongamento', 150, 130.00),
    ('Nail art simples', 'Detalhes simples em ate duas unhas.', 'Decoracao', 30, 20.00),
    ('Nail art elaborada', 'Decoracao personalizada com maior nivel de detalhe.', 'Decoracao', 60, 45.00)
) AS padroes(nome, descricao, categoria, duracao_minutos, preco)
WHERE NOT EXISTS (
    SELECT 1 FROM servicos s WHERE LOWER(s.nome) = LOWER(padroes.nome)
);
`;

async function executarMigracoes() {
    await pool.query(schema);
    console.log('Estrutura do banco verificada.');
}

module.exports = { executarMigracoes };
