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

function autorizarPerfis(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.user || !perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para realizar esta ação.' });
    }

    next();
  };
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

  if (!/^[\p{L}\p{M} .'-]{2,80}\s*[-,]\s*[A-Za-z]{2}$/u.test(dados.local_desaparecimento)
    || /\b(?:rua|avenida|av\.?|travessa|rodovia|estrada|alameda|cep)\b/i.test(dados.local_desaparecimento)) {
    return res.status(400).json({
      erro: 'Informe somente cidade e UF no local do desaparecimento, sem endereço ou número.'
    });
  }

  if (!['oficial', 'autorizada'].includes(dados.fonte_tipo)) {
    return res.status(400).json({ erro: 'Informe se a fonte é oficial ou autorizada.' });
  }
  if (typeof dados.fonte_referencia !== 'string' || dados.fonte_referencia.trim() === '') {
    return res.status(400).json({ erro: 'Informe a referência da fonte utilizada.' });
  }
  dados.fonte_referencia = dados.fonte_referencia.trim();
  if (dados.fonte_referencia.length > 500) {
    return res.status(400).json({ erro: 'A referência da fonte deve ter no máximo 500 caracteres.' });
  }
  if (dados.dados_autorizados !== true) {
    return res.status(400).json({ erro: 'Confirme que os dados podem ser divulgados com autorização.' });
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

function validarIdCrianca(req, res, next) {
  const id = Number(req.params.id);
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(id)) {
    return res.status(400).json({ erro: 'Informe um ID de caso válido.' });
  }

  next();
}

function validarFonteCaso(req, res, next) {
  const { fonte_tipo, fonte_referencia, dados_autorizados } = req.body || {};
  if (!['oficial', 'autorizada'].includes(fonte_tipo)) {
    return res.status(400).json({ erro: 'Informe se a fonte é oficial ou autorizada.' });
  }
  if (typeof fonte_referencia !== 'string' || fonte_referencia.trim() === ''
    || fonte_referencia.trim().length > 500) {
    return res.status(400).json({ erro: 'Informe uma referência válida de até 500 caracteres.' });
  }
  if (dados_autorizados !== true) {
    return res.status(400).json({ erro: 'Confirme que os dados estão autorizados para divulgação.' });
  }

  req.body.fonte_referencia = fonte_referencia.trim();
  next();
}

module.exports = {
  verificarToken,
  autorizarPerfis,
  validarDadosCrianca,
  validarIdCrianca,
  validarFonteCaso
};