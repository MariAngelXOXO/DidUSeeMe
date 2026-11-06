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

    const [perfis] = await db.execute("SELECT id FROM perfis WHERE nome = 'usuario'");
    if (perfis.length === 0) {
      throw new Error('Perfil padrão "usuario" não encontrado no banco de dados.');
    }

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    await db.execute(
      'INSERT INTO usuarios (nome, email, senha, perfil_id) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, perfis[0].id]
    );
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
    const [rows] = await db.execute(
      `SELECT u.id, u.nome, u.email, u.senha, u.ativo, p.nome AS perfil
       FROM usuarios AS u
       INNER JOIN perfis AS p ON p.id = u.perfil_id
       WHERE u.email = ?`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const usuario = rows[0];
    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Esta conta está desativada.' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      mensagem: 'Login efetuado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
};

// 3. LISTAR CRIANÇAS DESAPARECIDAS (PÚBLICO)
exports.listarCriancas = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, nome, idade_atual, idade_desaparecimento, cor_pele, cabelo,
              olhos, altura, roupas_desaparecimento, data_desaparecimento,
              local_desaparecimento, status, criado_em
       FROM criancas_desaparecidas
       WHERE status = 'published'
       ORDER BY criado_em DESC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar casos:', error);
    return res.status(500).json({ erro: 'Erro ao buscar registros.' });
  }
};

exports.listarFilaRevisao = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, nome, idade_atual, idade_desaparecimento, cor_pele, cabelo,
              olhos, altura, roupas_desaparecimento, caracteristicas_marcantes,
              familiares_proximos, data_desaparecimento, local_desaparecimento,
              ultimo_local_visto, locais_testemunhas, informacoes_adicionais,
              fonte_tipo, fonte_referencia, dados_autorizados, usuario_id,
              status, criado_em, atualizado_em
       FROM criancas_desaparecidas
       WHERE status IN ('pending_review', 'in_review', 'approved')
       ORDER BY criado_em ASC`
    );
    return res.status(200).json(rows);
  } catch (error) {
    console.error('Erro ao buscar fila de revisão:', error);
    return res.status(500).json({ erro: 'Erro ao buscar casos para revisão.' });
  }
};

// 4. CADASTRAR CRIANÇA (PROTEGIDO)
exports.cadastrarCrianca = async (req, res) => {
  const {
    nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos,
    altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos,
    data_desaparecimento, local_desaparecimento, ultimo_local_visto,
    locais_testemunhas, informacoes_adicionais, fonte_tipo, fonte_referencia,
    dados_autorizados
  } = req.body;

  const usuarioId = req.user.id;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const query = `
      INSERT INTO criancas_desaparecidas
      (nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos, altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos, data_desaparecimento, local_desaparecimento, ultimo_local_visto, locais_testemunhas, informacoes_adicionais, usuario_id, fonte_tipo, fonte_referencia, dados_autorizados)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      nome, idade_atual, idade_desaparecimento, cor_pele, cabelo, olhos,
      altura, roupas_desaparecimento, caracteristicas_marcantes, familiares_proximos,
      data_desaparecimento, local_desaparecimento, ultimo_local_visto,
      locais_testemunhas, informacoes_adicionais, usuarioId, fonte_tipo,
      fonte_referencia, dados_autorizados
    ];

    const [result] = await connection.execute(query, values);
    await connection.execute(
      `INSERT INTO historico_status_casos
       (crianca_id, usuario_id, status_anterior, status_novo, observacao)
       VALUES (?, ?, NULL, 'pending_review', ?)`,
      [result.insertId, usuarioId, 'Caso enviado para revisão.']
    );
    await connection.commit();

    return res.status(201).json({
      mensagem: 'Caso enviado para revisão. Ele só será exibido publicamente após aprovação e publicação.',
      id: result.insertId
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao inserir caso:', error);
    return res.status(500).json({ erro: 'Erro ao salvar os dados no banco.' });
  } finally {
    if (connection) connection.release();
  }
};

async function alterarStatusCaso(req, res, statusAtual, statusNovo, observacao) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [casos] = await connection.execute(
      `SELECT id, status, fonte_tipo, fonte_referencia, dados_autorizados
       FROM criancas_desaparecidas WHERE id = ? FOR UPDATE`,
      [Number(req.params.id)]
    );

    if (casos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ erro: 'Caso não encontrado.' });
    }
    if (casos[0].status !== statusAtual) {
      await connection.rollback();
      return res.status(409).json({
        erro: `O caso precisa estar com status "${statusAtual}" para esta ação.`,
        status_atual: casos[0].status
      });
    }
    if (statusNovo === 'approved'
      && (!['oficial', 'autorizada'].includes(casos[0].fonte_tipo)
        || !casos[0].fonte_referencia
        || Number(casos[0].dados_autorizados) !== 1)) {
      await connection.rollback();
      return res.status(409).json({
        erro: 'Não é possível aprovar: verifique a fonte e confirme a autorização para divulgação.'
      });
    }

    await connection.execute(
      'UPDATE criancas_desaparecidas SET status = ? WHERE id = ?',
      [statusNovo, Number(req.params.id)]
    );
    await connection.execute(
      `INSERT INTO historico_status_casos
       (crianca_id, usuario_id, status_anterior, status_novo, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(req.params.id), req.user.id, statusAtual, statusNovo, observacao]
    );
    await connection.commit();
    return res.status(200).json({ mensagem: `Status do caso atualizado para "${statusNovo}".` });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao atualizar status do caso:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar o status do caso.' });
  } finally {
    if (connection) connection.release();
  }
}

exports.iniciarRevisaoCrianca = (req, res) =>
  alterarStatusCaso(req, res, 'pending_review', 'in_review', 'Revisão iniciada.');

exports.aprovarCrianca = (req, res) =>
  alterarStatusCaso(req, res, 'in_review', 'approved', 'Caso aprovado para publicação.');

exports.publicarCrianca = (req, res) =>
  alterarStatusCaso(req, res, 'approved', 'published', 'Caso publicado.');

exports.reprovarCrianca = (req, res) => {
  const { observacao } = req.body || {};
  if (typeof observacao !== 'string' || observacao.trim() === '') {
    return res.status(400).json({ erro: 'Informe o motivo da reprovação.' });
  }
  if (observacao.trim().length > 1000) {
    return res.status(400).json({ erro: 'O motivo deve ter no máximo 1000 caracteres.' });
  }
  return alterarStatusCaso(req, res, 'in_review', 'rejected', observacao.trim());
};

exports.atualizarFonteCaso = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [casos] = await connection.execute(
      'SELECT status FROM criancas_desaparecidas WHERE id = ? FOR UPDATE',
      [Number(req.params.id)]
    );

    if (casos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ erro: 'Caso não encontrado.' });
    }
    if (!['pending_review', 'in_review', 'approved'].includes(casos[0].status)) {
      await connection.rollback();
      return res.status(409).json({ erro: 'A fonte só pode ser atualizada antes da publicação.' });
    }

    const statusAnterior = casos[0].status;
    const statusNovo = statusAnterior === 'approved' ? 'in_review' : statusAnterior;
    await connection.execute(
      `UPDATE criancas_desaparecidas
       SET fonte_tipo = ?, fonte_referencia = ?, dados_autorizados = 1, status = ?
       WHERE id = ?`,
      [req.body.fonte_tipo, req.body.fonte_referencia, statusNovo, Number(req.params.id)]
    );
    await connection.execute(
      `INSERT INTO historico_status_casos
       (crianca_id, usuario_id, status_anterior, status_novo, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(req.params.id),
        req.user.id,
        statusAnterior,
        statusNovo,
        'Fonte e autorização de divulgação revisadas.'
      ]
    );
    await connection.commit();
    return res.status(200).json({
      mensagem: statusAnterior === 'approved'
        ? 'Fonte atualizada. O caso voltou para revisão e precisa ser aprovado novamente.'
        : 'Fonte e autorização registradas para revisão.'
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao atualizar fonte do caso:', error);
    return res.status(500).json({ erro: 'Erro ao atualizar a fonte do caso.' });
  } finally {
    if (connection) connection.release();
  }
};

// Cada usuário pode excluir os próprios casos; somente o admin pode excluir qualquer caso.
exports.excluirCrianca = async (req, res) => {
  try {
    const [result] = req.user.perfil === 'admin'
      ? await db.execute('DELETE FROM criancas_desaparecidas WHERE id = ?', [Number(req.params.id)])
      : await db.execute(
        'DELETE FROM criancas_desaparecidas WHERE id = ? AND usuario_id = ?',
        [Number(req.params.id), req.user.id]
      );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Caso não encontrado ou você não tem permissão para excluí-lo.' });
    }

    return res.status(200).json({ mensagem: 'Caso excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir caso:', error);
    return res.status(500).json({ erro: 'Erro ao excluir o caso.' });
  }
};