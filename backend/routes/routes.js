const express = require('express');
const router = express.Router();
const controllers = require('../controllers/controllers');
const middlewares = require('../middlewares/middlewares');

// Rotas de Autenticação
router.post('/auth/registrar', controllers.registrarUsuario);
router.post('/auth/login', controllers.loginUsuario);

// Rotas de Casos
router.get('/criancas', controllers.listarCriancas);
// Rota protegida (requer token JWT)
router.post('/criancas', middlewares.verificarToken, middlewares.validarDadosCrianca, controllers.cadastrarCrianca);

module.exports = router;