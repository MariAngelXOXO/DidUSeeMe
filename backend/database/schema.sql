CREATE DATABASE IF NOT EXISTS diduseeme_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE diduseeme_db;

CREATE TABLE IF NOT EXISTS perfis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO perfis (nome, descricao) VALUES
('admin', 'Administrador do sistema com acesso total.'),
('moderador', 'Moderador responsável por revisão e gestão dos casos.'),
('aprovador', 'Responsável por aprovar casos revisados.'),
('publicador', 'Responsável por publicar casos aprovados.'),
('usuario', 'Usuário comum que cadastra e gerencia seus próprios casos.');

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    perfil_id INT NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_perfil
        FOREIGN KEY (perfil_id) REFERENCES perfis(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    INDEX idx_usuarios_perfil (perfil_id)
);

-- Compatibilidade com bancos antigos que já tinham usuarios sem perfil_id.
SET @perfil_id_existe = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'perfil_id'
);
SET @sql_migracao = IF(
    @perfil_id_existe = 0,
    'ALTER TABLE usuarios ADD COLUMN perfil_id INT NULL',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

SET @ativo_existe = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'ativo'
);
SET @sql_migracao = IF(
    @ativo_existe = 0,
    'ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

UPDATE usuarios
SET perfil_id = (SELECT id FROM perfis WHERE nome = 'usuario')
WHERE perfil_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM perfis WHERE id = usuarios.perfil_id);

ALTER TABLE usuarios
    MODIFY COLUMN perfil_id INT NOT NULL;

SET @fk_perfil_existe = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'perfil_id'
      AND REFERENCED_TABLE_NAME = 'perfis'
      AND REFERENCED_COLUMN_NAME = 'id'
);
SET @sql_migracao = IF(
    @fk_perfil_existe = 0,
    'ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_perfil FOREIGN KEY (perfil_id) REFERENCES perfis(id) ON UPDATE CASCADE ON DELETE RESTRICT',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

CREATE TABLE IF NOT EXISTS criancas_desaparecidas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    idade_atual INT NULL,
    idade_desaparecimento INT NULL,
    cor_pele VARCHAR(100) NULL,
    cabelo VARCHAR(100) NULL,
    olhos VARCHAR(100) NULL,
    altura VARCHAR(50) NULL,
    roupas_desaparecimento VARCHAR(255) NULL,
    caracteristicas_marcantes TEXT NULL,
    familiares_proximos TEXT NULL,
    data_desaparecimento DATE NULL,
    local_desaparecimento VARCHAR(255) NULL,
    ultimo_local_visto VARCHAR(255) NULL,
    locais_testemunhas TEXT NULL,
    informacoes_adicionais TEXT NULL,
    usuario_id INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    fonte_tipo VARCHAR(20) NOT NULL,
    fonte_referencia VARCHAR(500) NOT NULL,
    dados_autorizados TINYINT(1) NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_criancas_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_criancas_data (criado_em),
    INDEX idx_criancas_usuario (usuario_id),
    INDEX idx_criancas_status (status)
);

-- Migra tabelas anteriores sem publicar automaticamente casos já existentes.
SET @status_existe = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'status'
);
SET @sql_migracao = IF(
    @status_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT ''pending_review''',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

SET @fonte_tipo_existe = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'fonte_tipo'
);
SET @sql_migracao = IF(
    @fonte_tipo_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD COLUMN fonte_tipo VARCHAR(20) NULL',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

SET @fonte_referencia_existe = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'fonte_referencia'
);
SET @sql_migracao = IF(
    @fonte_referencia_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD COLUMN fonte_referencia VARCHAR(500) NULL',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

SET @dados_autorizados_existe = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'dados_autorizados'
);
SET @sql_migracao = IF(
    @dados_autorizados_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD COLUMN dados_autorizados TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

UPDATE criancas_desaparecidas
SET status = 'pending_review'
WHERE status = 'ativo';

ALTER TABLE criancas_desaparecidas
    MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending_review';

CREATE TABLE IF NOT EXISTS historico_status_casos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    crianca_id INT NOT NULL,
    usuario_id INT NULL,
    status_anterior VARCHAR(32) NULL,
    status_novo VARCHAR(32) NOT NULL,
    observacao VARCHAR(1000) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historico_caso
        FOREIGN KEY (crianca_id) REFERENCES criancas_desaparecidas(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_historico_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,
    INDEX idx_historico_caso_data (crianca_id, criado_em)
);

-- Compatibilidade com casos antigos sem vínculo a um usuário.
SET @usuario_id_existe = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'usuario_id'
);
SET @sql_migracao = IF(
    @usuario_id_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD COLUMN usuario_id INT NULL',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

SET @usuario_id_nullable = (
    SELECT IS_NULLABLE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'usuario_id'
);
SET @usuarios_orfaos = (
    SELECT COUNT(*)
    FROM criancas_desaparecidas AS c
    LEFT JOIN usuarios AS u ON u.id = c.usuario_id
    WHERE c.usuario_id IS NOT NULL
      AND u.id IS NULL
);
SET @sql_migracao = IF(
    @usuarios_orfaos > 0 AND @usuario_id_nullable = 'NO',
    'ALTER TABLE criancas_desaparecidas MODIFY COLUMN usuario_id INT NULL',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

UPDATE criancas_desaparecidas AS c
LEFT JOIN usuarios AS u ON u.id = c.usuario_id
SET usuario_id = NULL
WHERE c.usuario_id IS NOT NULL
  AND u.id IS NULL;

SET @fk_crianca_usuario_existe = (
    SELECT COUNT(*)
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'criancas_desaparecidas'
      AND COLUMN_NAME = 'usuario_id'
      AND REFERENCED_TABLE_NAME = 'usuarios'
      AND REFERENCED_COLUMN_NAME = 'id'
);
SET @sql_migracao = IF(
    @fk_crianca_usuario_existe = 0,
    'ALTER TABLE criancas_desaparecidas ADD CONSTRAINT fk_criancas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt_migracao FROM @sql_migracao;
EXECUTE stmt_migracao;
DEALLOCATE PREPARE stmt_migracao;

CREATE TABLE IF NOT EXISTS avistamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    crianca_id INT NOT NULL,
    usuario_id INT NOT NULL,
    latitude DECIMAL(10,8) NULL,
    longitude DECIMAL(11,8) NULL,
    descricao TEXT NOT NULL,
    data_avistamento DATETIME NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_avistamentos_crianca
        FOREIGN KEY (crianca_id) REFERENCES criancas_desaparecidas(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_avistamentos_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    INDEX idx_avistamentos_usuario (usuario_id)
);
