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
    assert.equal(duplicateRegistration.status, 400);

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
        body: { email: accounts[role].email, senha: accounts[role].password }
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

    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'PUT',
      token: accounts.usuario.token,
      body: { ...caseData, nome: 'Tentativa de editar caso publicado' }
    })).status, 403);

    assert.equal((await request(`/criancas/${caseId}`, {
      method: 'DELETE',
      token: accounts.usuario.token
    })).status, 200);
    const publicAfterDelete = await request('/criancas');
    assert.ok(!publicAfterDelete.data.some(item => item.id === caseId));
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
