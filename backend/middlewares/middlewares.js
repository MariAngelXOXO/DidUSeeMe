const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. É necessário estar logado para realizar esta ação.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    }
    req.user = user; // Guarda os dados do usuário decodificados na requisição
    next();
  });
}

function validarDadosCrianca(req, res, next) {
  const dados = req.body;
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return res.status(400).json({ erro: 'Envie os dados do caso em formato válido.' });
  }

  for (const campo of ['nome', 'local_desaparecimento']) {
    if (typeof dados[campo] !== 'string' || dados[campo].trim() === '') {
      return res.status(400).json({ erro: 'Informe o nome e o local do desaparecimento.' });
    }
    dados[campo] = dados[campo].trim();
  }

  for (const campo of ['idade_atual', 'idade_desaparecimento']) {
    const valor = dados[campo];
    const valorValido = typeof valor === 'number'
      || (typeof valor === 'string' && /^\d+$/.test(valor.trim()));
    const idade = Number(valor);
    if (!valorValido || !Number.isInteger(idade) || idade < 0 || idade > 120) {
      return res.status(400).json({ erro: 'As idades devem ser números inteiros entre 0 e 120.' });
    }
    dados[campo] = idade;
  }

  if (dados.idade_desaparecimento > dados.idade_atual) {
    return res.status(400).json({ erro: 'A idade na época do desaparecimento não pode ser maior que a idade atual.' });
  }

  const data = dados.data_desaparecimento;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'Informe uma data de desaparecimento válida.' });
  }

  const [ano, mes, dia] = data.split('-').map(Number);
  const dataVerificada = new Date(Date.UTC(ano, mes - 1, dia));
  if (ano < 1000
    || dataVerificada.getUTCFullYear() !== ano
    || dataVerificada.getUTCMonth() !== mes - 1
    || dataVerificada.getUTCDate() !== dia) {
    return res.status(400).json({ erro: 'Informe uma data de desaparecimento válida.' });
  }

  const hoje = new Date();
  const dataHoje = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, '0'),
    String(hoje.getDate()).padStart(2, '0')
  ].join('-');
  if (data > dataHoje) {
    return res.status(400).json({ erro: 'A data do desaparecimento não pode estar no futuro.' });
  }

  for (const campo of [
    'cor_pele', 'cabelo', 'olhos', 'altura', 'roupas_desaparecimento',
    'caracteristicas_marcantes', 'familiares_proximos', 'ultimo_local_visto',
    'locais_testemunhas', 'informacoes_adicionais'
  ]) {
    if (dados[campo] === undefined || dados[campo] === null) {
      dados[campo] = '';
    } else if (typeof dados[campo] !== 'string') {
      return res.status(400).json({ erro: 'Os campos de descrição devem ser textos.' });
    } else {
      dados[campo] = dados[campo].trim();
    }
  }

  next();
}

module.exports = {
  verificarToken,
  validarDadosCrianca
};