const express = require('express');
const clientes = require('../controllers/clientesController');
const servicos = require('../controllers/servicosController');
const bloqueios = require('../controllers/bloqueiosController');
const sistema = require('../controllers/sistemaController');
const pagamentos = require('../controllers/pagamentosController');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.get('/admin/status', adminAuth.statusAdmin);
router.post('/admin/login', adminAuth.loginAdmin);
router.post('/admin/logout', adminAuth.logoutAdmin);

router.get('/clientes', adminAuth.exigirAdmin, clientes.listar);
router.get('/clientes/:id', adminAuth.exigirAdmin, clientes.buscar);
router.post('/clientes', adminAuth.exigirAdmin, clientes.criar);
router.patch('/clientes/:id', adminAuth.exigirAdmin, clientes.atualizar);

router.get('/servicos', servicos.listar);
router.get('/servicos/:id', servicos.buscar);
router.post('/servicos', adminAuth.exigirAdmin, servicos.criar);
router.patch('/servicos/:id', adminAuth.exigirAdmin, servicos.atualizar);

router.use('/agendamentos', adminAuth.exigirAdmin, require('./agendamentosRoutes'));

router.get('/pagamentos', adminAuth.exigirAdmin, pagamentos.listar);
router.get('/pagamentos/:id', adminAuth.exigirAdmin, pagamentos.buscar);
router.post('/pagamentos/manual', adminAuth.exigirAdmin, pagamentos.registrarManual);
router.post('/pagamentos/mercado-pago', adminAuth.exigirAdmin, pagamentos.criarMercadoPago);
router.post('/agendamentos/:agendamentoId/pagamentos/mercado-pago', adminAuth.exigirAdmin, pagamentos.criarMercadoPago);

router.get('/bloqueios', adminAuth.exigirAdmin, bloqueios.listar);
router.post('/bloqueios', adminAuth.exigirAdmin, bloqueios.criar);
router.delete('/bloqueios/:id', adminAuth.exigirAdmin, bloqueios.remover);

router.post('/webhooks/mercado-pago', pagamentos.webhookMercadoPago);

router.get('/publico', sistema.infoPublica);
router.get('/disponibilidade', sistema.disponibilidade);
router.get('/resumo', adminAuth.exigirAdmin, sistema.resumo);
router.get('/configuracoes', adminAuth.exigirAdmin, sistema.buscarConfiguracoes);
router.patch('/configuracoes', adminAuth.exigirAdmin, sistema.atualizarConfiguracoes);

module.exports = router;
