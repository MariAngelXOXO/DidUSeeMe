const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

test('registration, permissions, CRUD, and case publication work with MySQL', async () => {
  for (const variable of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    assert.notEqual(
      process.env[variable],
      undefined,
      `${variable} must be configured in backend/.env before running integration tests.`
    );
  }

  const originalDatabaseName = process.env.DB_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;
  const temporaryDatabaseName = `diduseeme_test_${Date.now()}_${process.pid}`;
  const mysqlConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true
  };
  let adminConnection;
  let db;
  let server;

  try {
    adminConnection = await mysql.createConnection(mysqlConfig);
    await adminConnection.query(
      `CREATE DATABASE \`${temporaryDatabaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8').replaceAll(
      'diduseeme_db',
      temporaryDatabaseName
    );
    await adminConnection.query(schema);
    await adminConnection.query(`
      ALTER TABLE criancas_desaparecidas DROP FOREIGN KEY fk_criancas_usuario;
      ALTER TABLE criancas_desaparecidas MODIFY COLUMN usuario_id INT NOT NULL;
      ALTER TABLE criancas_desaparecidas
        ADD CONSTRAINT fk_criancas_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE;
      ALTER TABLE historico_status_casos DROP COLUMN usuario_nome
    `);
    await adminConnection.query(schema);

    const [ownerForeignKeys] = await adminConnection.execute(
      `SELECT c.IS_NULLABLE, r.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       JOIN information_schema.COLUMNS c
         ON c.TABLE_SCHEMA = k.TABLE_SCHEMA
        AND c.TABLE_NAME = k.TABLE_NAME
        AND c.COLUMN_NAME = k.COLUMN_NAME
       WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = 'criancas_desaparecidas'
         AND k.COLUMN_NAME = 'usuario_id' AND k.REFERENCED_TABLE_NAME = 'usuarios'`,
      [temporaryDatabaseName]
    );
    assert.equal(ownerForeignKeys.length, 1);
    assert.equal(ownerForeignKeys[0].IS_NULLABLE, 'YES');
    assert.equal(ownerForeignKeys[0].DELETE_RULE, 'SET NULL');

    process.env.DB_NAME = temporaryDatabaseName;
    process.env.JWT_SECRET = 'integration-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz';

    db = require('../database/database');
    const app = require('../server');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const apiUrl = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (endpoint, { method = 'GET', token, body } = {}) => {
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json();
      return { status: response.status, data };
    };

    const password = 'TestPassword!2026';
    const accounts = {};
    for (const role of ['usuario', 'outro_usuario', 'moderador', 'aprovador', 'publicador']) {
      const email = `${role}_${temporaryDatabaseName}@example.test`;
      const registration = await request('/auth/registrar', {
        method: 'POST',
        body: { nome: `Teste ${role}`, email, senha: password }
      });
      assert.equal(registration.status, 201, `registration failed for ${role}`);
      accounts[role] = { email, password };
    }

    const duplicateRegistration = await request('/auth/registrar', {
      method: 'POST',
      body: {
        nome: 'Cadastro duplicado',
        email: accounts.usuario.email,
        senha: password
      }
    });
    assert.equal(duplicateRegistration.status, 409);

    for (const invalidAccount of [
      { nome: 'A', email: 'invalid-name@example.test', senha: password },
      { nome: 'Nome inválido', email: 'not-an-email', senha: password },
      { nome: 'E-mail inválido', email: 'nome@.example.test', senha: password },
      { nome: 'E-mail inválido', email: 'nome@example..test', senha: password },
      { nome: 'E-mail inválido', email: 'nome@exemplo.123', senha: password },
      { nome: 'Senha curta', email: 'short-password@example.test', senha: 'short' },
      { nome: 'Senha longa', email: 'long-password@example.test', senha: 'x'.repeat(73) }
    ]) {
      assert.equal((await request('/auth/registrar', {
        method: 'POST',
        body: invalidAccount
      })).status, 400);
    }

    const concurrentEmail = `race_${temporaryDatabaseName}@example.test`;
    const concurrentRegistrations = await Promise.all([
      request('/auth/registrar', {
        method: 'POST',
        body: { nome: 'Cadastro concorrente', email: concurrentEmail, senha: password }
      }),
      request('/auth/registrar', {
        method: 'POST',
        body: { nome: 'Cadastro concorrente', email: concurrentEmail, senha: password }
      })
    ]);
    assert.deepEqual(
      concurrentRegistrations.map(result => result.status).sort(),
      [201, 409]
    );

    const [profiles] = await db.execute('SELECT id, nome FROM perfis');
    const profileIds = Object.fromEntries(profiles.map(profile => [profile.nome, profile.id]));
    for (const role of ['moderador', 'aprovador', 'publicador']) {
      const [result] = await db.execute(
        'UPDATE usuarios SET perfil_id = ? WHERE email = ?',
        [profileIds[role], accounts[role].email]
      );
      assert.equal(result.affectedRows, 1, `could not assign ${role} profile`);
    }

    for (const role of ['usuario', 'outro_usuario', 'moderador', 'aprovador', 'publicador']) {
      const login = await request('/auth/login', {
        method: 'POST',
        body: {
          email: role === 'usuario' ? accounts[role].email.toUpperCase() : accounts[role].email,
          senha: accounts[role].password
        }
      });
      assert.equal(login.status, 200, `login failed for ${role}`);
      assert.equal(login.data.usuario.perfil, role === 'outro_usuario' ? 'usuario' : role);
      accounts[role].token = login.data.token;
    }

    const invalidLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: accounts.usuario.email, senha: 'wrong-password' }
    });
    assert.equal(invalidLogin.status, 400);

    const malformedJson = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email":'
    });
    assert.equal(malformedJson.status, 400);
    assert.match((await malformedJson.json()).erro, /JSON inválido/);

    const oversizedBody = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: accounts.usuario.email, senha: 'x'.repeat(1024 * 1024) })
    });
    assert.equal(oversizedBody.status, 413);
    assert.match((await oversizedBody.json()).erro, /1 MB/);

    const missingRoute = await request('/endpoint-inexistente');
    assert.equal(missingRoute.status, 404);
    assert.equal(typeof missingRoute.data.erro, 'string');

    assert.equal((await request('/criancas/minhas')).status, 401);
    assert.equal((await request('/criancas/revisao', {
      token: accounts.usuario.token
    })).status, 403);
    assert.equal((await request('/criancas/1/aprovar', {
      method: 'POST',
      token: accounts.moderador.token
    })).status, 403);
    assert.equal((await request('/criancas/1/publicar', {
      method: 'POST',
      token: accounts.aprovador.token
    })).status, 403);

    const caseData = {
      nome: 'Caso de integração',
      idade_atual: 10,
      idade_desaparecimento: 9,
      cor_pele: '',
      cabelo: '',
      olhos: '',
      altura: '',
      roupas_desaparecimento: '',
      caracteristicas_marcantes: '',
      familiares_proximos: '',
      data_desaparecimento: '2020-01-01',
      local_desaparecimento: 'Campinas - SP',
      ultimo_local_visto: '',
      locais_testemunhas: '',
      informacoes_adicionais: '',
      fonte_tipo: 'oficial',
      fonte_referencia: 'Registro de integração',
      dados_autorizados: true
    };

    const invalidCase = await request('/criancas', {
      method: 'POST',
      token: accounts.usuario.token,
      body: { ...caseData, idade_atual: -1 }
    });
    assert.equal(invalidCase.status, 400);

    const created = await request('/criancas', {
      method: 'POST',
      token: accounts.usuario.token,
      body: caseData
    });
    assert.equal(created.status, 201);
    const caseId = created.data.id;

    const ownCases = await request('/criancas/minhas', { token: accounts.usuario.token });
    assert.equal(ownCases.status, 200);
    assert.ok(ownCases.data.some(item => item.id === caseId));
    assert.equal((await request(`/criancas/minhas/${caseId}`, {
      token: accounts.outro_usuario.token
    })).status, 404);
    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'DELETE',
      token: accounts.outro_usuario.token
    })).status, 404);

    const update = await request(`/criancas/${caseId}`, {
      method: 'PUT',
      token: accounts.usuario.token,
      body: { ...caseData, nome: 'Caso atualizado' }
    });
    assert.equal(update.status, 200);
    const ownCase = await request(`/criancas/minhas/${caseId}`, {
      token: accounts.usuario.token
    });
    assert.equal(ownCase.data.nome, 'Caso atualizado');

    const publicBeforeReview = await request('/criancas');
    assert.equal(publicBeforeReview.status, 200);
    assert.ok(!publicBeforeReview.data.some(item => item.id === caseId));

    assert.equal((await request(`/criancas/${caseId}/revisar`, {
      method: 'POST',
      token: accounts.moderador.token
    })).status, 200);
    assert.equal((await request('/criancas/revisao', {
      token: accounts.moderador.token
    })).status, 200);
    assert.equal((await request(`/criancas/${caseId}/historico`, {
      token: accounts.usuario.token
    })).status, 403);
    assert.equal((await request(`/criancas/${caseId}/aprovar`, {
      method: 'POST',
      token: accounts.aprovador.token
    })).status, 409);

    assert.equal((await request(`/criancas/${caseId}/fonte`, {
      method: 'PUT',
      token: accounts.moderador.token,
      body: {
        fonte_tipo: 'oficial',
        fonte_referencia: 'Fonte conferida nos testes',
        dados_autorizados: true
      }
    })).status, 200);

    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'PUT',
      token: accounts.moderador.token,
      body: { ...caseData, nome: 'Caso editado durante a revisão' }
    })).status, 200);
    const [resetVerification] = await db.execute(
      `SELECT status, fonte_verificada_por, fonte_verificada_em
       FROM criancas_desaparecidas WHERE id = ?`,
      [caseId]
    );
    assert.equal(resetVerification[0].status, 'pending_review');
    assert.equal(resetVerification[0].fonte_verificada_por, null);
    assert.equal(resetVerification[0].fonte_verificada_em, null);

    assert.equal((await request(`/criancas/${caseId}/revisar`, {
      method: 'POST',
      token: accounts.moderador.token
    })).status, 200);
    assert.equal((await request(`/criancas/${caseId}/aprovar`, {
      method: 'POST',
      token: accounts.aprovador.token
    })).status, 409);
    assert.equal((await request(`/criancas/${caseId}/fonte`, {
      method: 'PUT',
      token: accounts.moderador.token,
      body: {
        fonte_tipo: 'oficial',
        fonte_referencia: 'Fonte conferida após edição',
        dados_autorizados: true
      }
    })).status, 200);

    assert.equal((await request(`/criancas/${caseId}/publicar`, {
      method: 'POST',
      token: accounts.publicador.token
    })).status, 409);
    assert.equal((await request(`/criancas/${caseId}/aprovar`, {
      method: 'POST',
      token: accounts.aprovador.token
    })).status, 200);
    assert.equal((await request(`/criancas/${caseId}/publicar`, {
      method: 'POST',
      token: accounts.publicador.token
    })).status, 200);

    const publicCases = await request('/criancas');
    const publishedCase = publicCases.data.find(item => item.id === caseId);
    assert.ok(publishedCase);
    assert.equal('familiares_proximos' in publishedCase, false);
    assert.equal('fonte_verificada_por' in publishedCase, false);
    const publishedInReviewQueue = await request('/criancas/revisao', {
      token: accounts.moderador.token
    });
    assert.ok(publishedInReviewQueue.data.some(item => item.id === caseId));

    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'PUT',
      token: accounts.usuario.token,
      body: { ...caseData, nome: 'Tentativa de editar caso publicado' }
    })).status, 403);

    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'DELETE',
      token: accounts.usuario.token
    })).status, 409);

    assert.equal((await request(`/criancas/${caseId}/arquivar`, {
      method: 'POST',
      token: accounts.usuario.token,
      body: { observacao: 'Solicitação de arquivamento' }
    })).status, 403);
    assert.equal((await request(`/criancas/${caseId}/arquivar`, {
      method: 'POST',
      token: accounts.moderador.token,
      body: {}
    })).status, 400);

    const archiveReason = 'Autoridade confirmou que o caso foi localizado.';
    const archived = await request(`/criancas/${caseId}/arquivar`, {
      method: 'POST',
      token: accounts.moderador.token,
      body: { observacao: archiveReason }
    });
    assert.equal(archived.status, 200);

    const publicAfterArchive = await request('/criancas');
    assert.ok(!publicAfterArchive.data.some(item => item.id === caseId));
    const [archivedCase] = await db.execute(
      'SELECT status FROM criancas_desaparecidas WHERE id = ?',
      [caseId]
    );
    assert.equal(archivedCase[0].status, 'archived');
    const [archiveEvents] = await db.execute(
      `SELECT usuario_id, usuario_nome, status_anterior, status_novo, observacao
       FROM historico_status_casos
       WHERE crianca_id = ? AND status_novo = 'archived'`,
      [caseId]
    );
    assert.equal(archiveEvents.length, 1);
    const [moderators] = await db.execute(
      'SELECT id FROM usuarios WHERE email = ?',
      [accounts.moderador.email]
    );
    assert.equal(archiveEvents[0].usuario_id, Number(moderators[0].id));
    assert.equal(archiveEvents[0].status_anterior, 'published');
    assert.equal(archiveEvents[0].observacao, archiveReason);
    assert.equal(archiveEvents[0].usuario_nome, 'Teste moderador');
    const historyApi = await request(`/criancas/${caseId}/historico`, {
      token: accounts.moderador.token
    });
    assert.equal(historyApi.status, 200);
    assert.ok(historyApi.data.some(event =>
      event.status_novo === 'archived'
      && event.responsavel === 'Teste moderador'
      && event.observacao === archiveReason
    ));
    const archivedInReviewQueue = await request('/criancas/revisao', {
      token: accounts.moderador.token
    });
    assert.ok(archivedInReviewQueue.data.some(item =>
      item.id === caseId && item.status === 'archived'
    ));
    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'DELETE',
      token: accounts.usuario.token
    })).status, 409);
    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'PUT',
      token: accounts.moderador.token,
      body: { ...caseData, nome: 'Tentativa de editar caso arquivado' }
    })).status, 403);
    const [preservedArchiveEvent] = await db.execute(
      `SELECT COUNT(*) AS total FROM historico_status_casos
       WHERE crianca_id = ? AND status_novo = 'archived'`,
      [caseId]
    );
    assert.equal(preservedArchiveEvent[0].total, 1);
    assert.equal((await request(`/criancas/${caseId}/arquivar`, {
      method: 'POST',
      token: accounts.moderador.token,
      body: { observacao: 'Tentativa repetida' }
    })).status, 409);

    const disposable = await request('/criancas', {
      method: 'POST',
      token: accounts.usuario.token,
      body: { ...caseData, nome: 'Caso não publicado para exclusão' }
    });
    assert.equal(disposable.status, 201);
    assert.equal((await request(`/criancas/${disposable.data.id}`, {
      method: 'DELETE',
      token: accounts.usuario.token
    })).status, 200);
    assert.equal((await request(`/criancas/minhas/${disposable.data.id}`, {
      token: accounts.usuario.token
    })).status, 404);

    await db.execute('UPDATE usuarios SET ativo = 0 WHERE email = ?', [accounts.usuario.email]);
    assert.equal((await request('/auth/login', {
      method: 'POST',
      body: { email: accounts.usuario.email, senha: accounts.usuario.password }
    })).status, 403);
    assert.equal((await request('/criancas/minhas', {
      token: accounts.usuario.token
    })).status, 403);
    await db.execute('DELETE FROM usuarios WHERE email = ?', [accounts.usuario.email]);
    const [preservedAfterOwnerDeletion] = await db.execute(
      `SELECT c.usuario_id, h.status_novo, h.observacao
       FROM criancas_desaparecidas c
       JOIN historico_status_casos h ON h.crianca_id = c.id
       WHERE c.id = ? AND h.status_novo = 'archived'`,
      [caseId]
    );
    assert.equal(preservedAfterOwnerDeletion.length, 1);
    assert.equal(preservedAfterOwnerDeletion[0].usuario_id, null);
    assert.equal(preservedAfterOwnerDeletion[0].observacao, archiveReason);
    await db.execute('DELETE FROM usuarios WHERE email = ?', [accounts.moderador.email]);
    const historyAfterActorDeletion = await request(`/criancas/${caseId}/historico`, {
      token: accounts.aprovador.token
    });
    assert.equal(historyAfterActorDeletion.status, 200);
    assert.ok(historyAfterActorDeletion.data.some(event =>
      event.status_novo === 'archived'
      && event.responsavel === 'Teste moderador'
      && event.observacao === archiveReason
    ));
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    if (db) {
      await db.end();
    }
    process.env.DB_NAME = originalDatabaseName;
    process.env.JWT_SECRET = originalJwtSecret;
    if (adminConnection) {
      try {
        await adminConnection.query(`DROP DATABASE IF EXISTS \`${temporaryDatabaseName}\``);
      } finally {
        await adminConnection.end();
      }
    }
  }
});
