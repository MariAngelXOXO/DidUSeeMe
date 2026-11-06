const express = require('express');
const router = express.Router();
const controllers = require('../controllers/controllers');
const middlewares = require('../middlewares/middlewares');

// Rotas de Autenticação
router.post('/auth/registrar', controllers.registrarUsuario);
router.post('/auth/login', controllers.loginUsuario);

// Rotas de Casos
router.get('/criancas', controllers.listarCriancas);
router.get(
  '/criancas/revisao',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'moderador', 'aprovador', 'publicador'),
  controllers.listarFilaRevisao
);
// Rota protegida (requer token JWT)
router.post(
  '/criancas',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'usuario'),
  middlewares.validarDadosCrianca,
  controllers.cadastrarCrianca
);
router.put(
  '/criancas/:id/fonte',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'moderador'),
  middlewares.validarIdCrianca,
  middlewares.validarFonteCaso,
  controllers.atualizarFonteCaso
);
router.post(
  '/criancas/:id/revisar',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'moderador'),
  middlewares.validarIdCrianca,
  controllers.iniciarRevisaoCrianca
);
router.post(
  '/criancas/:id/aprovar',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'aprovador'),
  middlewares.validarIdCrianca,
  controllers.aprovarCrianca
);
router.post(
  '/criancas/:id/reprovar',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'moderador', 'aprovador'),
  middlewares.validarIdCrianca,
  controllers.reprovarCrianca
);
router.post(
  '/criancas/:id/publicar',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'publicador'),
  middlewares.validarIdCrianca,
  controllers.publicarCrianca
);
router.delete(
  '/criancas/:id',
  middlewares.verificarToken,
  middlewares.autorizarPerfis('admin', 'moderador', 'aprovador', 'publicador', 'usuario'),
  middlewares.validarIdCrianca,
  controllers.excluirCrianca
);

module.exports = router;