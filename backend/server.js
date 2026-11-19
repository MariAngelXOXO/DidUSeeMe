const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET is required and must contain at least 32 characters. '
    + 'Configure it in backend/.env using a randomly generated secret.'
  );
}

const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');

const app = express();
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('API do projeto "Did U See Me?" em funcionamento!');
});

app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição contém JSON inválido.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'O corpo da requisição excede o limite de 1 MB.' });
  }

  console.error('Erro não tratado na API:', error);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;