# Agenda de Unhas - Backend

API REST em Node.js, Express e PostgreSQL para administrar clientes, servicos,
agendamentos e periodos indisponiveis.

## Executar

1. Copie as variaveis de `.env.example` para `.env` e informe o PostgreSQL.
2. Instale as dependencias com `npm install`.
3. Inicie com `npm start`.

As tabelas sao criadas automaticamente. Por padrao, o site publico fica em
`http://localhost:3000`, o painel administrativo fica em
`http://localhost:3000/admin` e a API fica em `http://localhost:3000/api`.

## Endpoints

| Metodo | Rota | Finalidade |
| --- | --- | --- |
| GET/POST | `/api/clientes` | Listar e cadastrar clientes |
| GET/PATCH | `/api/clientes/:id` | Consultar e alterar cliente |
| GET/POST | `/api/servicos` | Listar e cadastrar servicos |
| GET/PATCH | `/api/servicos/:id` | Consultar e alterar servico |
| GET/POST | `/api/agendamentos` | Consultar e criar agendamentos |
| GET/PATCH/DELETE | `/api/agendamentos/:id` | Gerenciar agendamento |
| GET | `/api/pagamentos?agendamento_id=1` | Listar pagamentos |
| POST | `/api/pagamentos/manual` | Registrar pagamento manual |
| POST | `/api/pagamentos/mercado-pago` | Criar link de pagamento Mercado Pago |
| POST | `/api/webhooks/mercado-pago` | Receber notificacoes do Mercado Pago |
| GET/POST | `/api/bloqueios` | Consultar e criar bloqueios |
| DELETE | `/api/bloqueios/:id` | Remover bloqueio |
| GET | `/api/disponibilidade?data=2026-06-25&servico_id=1` | Horarios livres |
| GET | `/api/resumo?data=2026-06-25` | Resumo financeiro do dia |
| GET/PATCH | `/api/configuracoes` | Expediente e intervalo da agenda |

Datas de agendamento devem ser enviadas em ISO 8601 com fuso horario, por
exemplo `2026-06-25T14:00:00-03:00`.

## Exemplos

```json
POST /api/clientes
{
  "nome": "Maria",
  "telefone": "(11) 99999-8888"
}
```

```json
POST /api/servicos
{
  "nome": "Manicure",
  "duracao_minutos": 60,
  "preco": 45
}
```

```json
POST /api/agendamentos
{
  "cliente_id": 1,
  "servico_id": 1,
  "inicio": "2026-06-25T14:00:00-03:00",
  "tipo_cobranca": "sinal_30",
  "metodo_pagamento_preferido": "pix_online",
  "observacoes": "Francesinha"
}
```

Tipos de cobranca aceitos: `sinal_30`, `sinal_50`, `total` e
`pagar_na_hora`. Metodos aceitos: `pix_online`, `cartao_online`,
`pix_manual` e `dinheiro`. Cartao e Pix online nao sao permitidos na opcao
`pagar_na_hora`; dinheiro e usado apenas para pagamento presencial.

```json
POST /api/pagamentos/manual
{
  "agendamento_id": 1,
  "valor": 45,
  "metodo": "pix"
}
```

```json
POST /api/pagamentos/mercado-pago
{
  "agendamento_id": 1
}
```

Para o Mercado Pago funcionar em producao, configure `MERCADO_PAGO_ACCESS_TOKEN`,
`PUBLIC_BASE_URL` com HTTPS e, se usar validacao de webhook,
`MERCADO_PAGO_WEBHOOK_SECRET`.

Para proteger o painel administrativo em producao, configure `ADMIN_TOKEN`.
O site publico continua aberto, mas rotas administrativas passam a exigir essa
senha no painel. Opcionalmente configure `ADMIN_PATH` com um caminho dificil de
adivinhar, por exemplo `/painel-karina-2026`.
