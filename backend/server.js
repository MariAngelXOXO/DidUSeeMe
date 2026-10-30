require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
  res.send('API do projeto "Did U See Me?" em funcionamento!');
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});