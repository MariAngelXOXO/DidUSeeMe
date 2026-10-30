const db = require('../database/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// 1. REGISTRAR USUÁRIO
exports.registrarUsuario = async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos de cadastro.' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    await db.execute('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senhaHash]);
    return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
};

// 2. LOGIN DE USUÁRIO
exports.loginUsuario = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const usuario = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ id: usuario.id, nome: usuario.nome, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '8h' });

    return res.status(200).json({
      mensagem: 'Login efetuado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
};

// 3. LISTAR CRIANÇAS DESAPARECIDAS (PÚBLICO)
exports.listarCriancas = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM criancas_desaparecidas ORDER BY criado_em DESC');
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar casos:', error);
    return res.status(500).json({ erro: 'Erro ao buscar registros.' });
  }
};

// 4. CADASTRAR CRIANÇA (PROTEGIDO)
exports.cadastrarCrianca = async (req, res) => {
  const {
    nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos,
    altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos,
    data_desaparecimento, local_desaparecimento, ultimo_local_visto,
    locais_testemunhas, informacoes_adicionais
  } = req.body;

  try {
    const query = `
      INSERT INTO criancas_desaparecidas
      (nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos, altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos, data_desaparecimento, local_desaparecimento, ultimo_local_visto, locais_testemunhas, informacoes_adicionais)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos,
      altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos,
      data_desaparecimento, local_desaparecimento, ultimo_local_visto,
      locais_testemunhas, informacoes_adicionais
    ];

    const [result] = await db.execute(query, values);

    return res.status(201).json({
      mensagem: 'Caso catalogado com sucesso!',
      id: result.insertId
    });
  } catch (error) {
    console.error('Erro ao inserir caso:', error);
    return res.status(500).json({ erro: 'Erro ao salvar os dados no banco.' });
  }
};