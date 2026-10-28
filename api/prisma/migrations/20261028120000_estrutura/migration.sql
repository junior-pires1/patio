-- Pátio · Migração 1 — estrutura
-- 24 tabelas e 10 tipos enumerados (Apêndice A do relatório).
-- Toda tabela de uma faculdade tem instituicao_id e chaves estrangeiras
-- compostas (instituicao_id, x_id): o banco impede ligar registros de
-- faculdades diferentes, mesmo que a aplicação erre.

-- ───────────────────────── Tipos enumerados ─────────────────────────
CREATE TYPE papel_usuario      AS ENUM ('ALUNO', 'COORDENACAO');
CREATE TYPE status_conta       AS ENUM ('ATIVA', 'SUSPENSA', 'EXCLUIDA');
CREATE TYPE turno              AS ENUM ('MANHA', 'TARDE', 'NOITE', 'INTEGRAL');
CREATE TYPE relacao_disciplina AS ENUM ('CURSANDO', 'POSSO_AJUDAR', 'PRECISO_AJUDA');
CREATE TYPE categoria_post     AS ENUM ('GERAL', 'EVENTO', 'ESTUDOS', 'VAGA', 'ACHADOS');
CREATE TYPE papel_grupo        AS ENUM ('CRIADOR', 'MEMBRO');
CREATE TYPE motivo_denuncia    AS ENUM ('PERFIL_FALSO', 'ASSEDIO', 'CONTEUDO_IMPROPRIO', 'SPAM', 'VENDA_DE_TRABALHOS', 'OUTRO');
CREATE TYPE status_denuncia    AS ENUM ('ABERTA', 'RESOLVIDA');
CREATE TYPE acao_denuncia      AS ENUM ('ARQUIVADA', 'ADVERTENCIA', 'SUSPENSAO');
CREATE TYPE tipo_ator          AS ENUM ('ADMIN_PLATAFORMA', 'COORDENACAO', 'SISTEMA');

-- ───────────────────────── Plataforma ─────────────────────────
CREATE TABLE instituicoes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         VARCHAR(120) NOT NULL,
  sigla        VARCHAR(20)  NOT NULL,
  cor_primaria VARCHAR(7)   NOT NULL DEFAULT '#1F6FEB',
  cidade       VARCHAR(80)  NOT NULL,
  uf           CHAR(2)      NOT NULL,
  ativa        BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT instituicoes_cor_ck CHECK (cor_primaria ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT instituicoes_uf_ck  CHECK (uf ~ '^[A-Z]{2}$')
);

CREATE TABLE dominios_email (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  dominio        VARCHAR(120) NOT NULL,
  CONSTRAINT dominios_email_dominio_key UNIQUE (dominio),
  CONSTRAINT dominios_email_formato_ck CHECK (
    dominio = lower(dominio)
    AND dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  )
);
CREATE INDEX dominios_email_instituicao_idx ON dominios_email (instituicao_id);

CREATE TABLE administradores (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               VARCHAR(120) NOT NULL,
  email              VARCHAR(160) NOT NULL,
  senha_hash         VARCHAR(100) NOT NULL,
  dois_fatores_ativo BOOLEAN      NOT NULL DEFAULT FALSE,
  criado_em          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT administradores_email_key UNIQUE (email),
  CONSTRAINT administradores_email_ck CHECK (email = lower(email))
);

CREATE TABLE auditoria (
  id             BIGSERIAL    PRIMARY KEY,
  instituicao_id UUID         REFERENCES instituicoes (id) ON DELETE CASCADE,
  ator_tipo      tipo_ator    NOT NULL,
  ator_id        UUID,
  acao           VARCHAR(60)  NOT NULL,
  alvo_tipo      VARCHAR(40),
  alvo_id        UUID,
  detalhes       JSONB        NOT NULL DEFAULT '{}',
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_instituicao_idx ON auditoria (instituicao_id, criado_em DESC);

-- ───────────────────────── Catálogo da faculdade ─────────────────────────
CREATE TABLE cursos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  nome           VARCHAR(120) NOT NULL,
  CONSTRAINT cursos_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT cursos_nome_key UNIQUE (instituicao_id, nome)
);

CREATE TABLE disciplinas (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  curso_id       UUID,
  nome           VARCHAR(120) NOT NULL,
  CONSTRAINT disciplinas_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT disciplinas_nome_key UNIQUE (instituicao_id, nome),
  CONSTRAINT disciplinas_curso_fk FOREIGN KEY (instituicao_id, curso_id)
    REFERENCES cursos (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX disciplinas_curso_idx ON disciplinas (curso_id);

-- ───────────────────────── Contas ─────────────────────────
CREATE TABLE usuarios (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id      UUID          NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  curso_id            UUID,
  papel               papel_usuario NOT NULL DEFAULT 'ALUNO',
  nome                VARCHAR(120)  NOT NULL,
  apelido             VARCHAR(40)   NOT NULL,
  email               VARCHAR(160)  NOT NULL,
  senha_hash          VARCHAR(100)  NOT NULL,
  data_nascimento     DATE,
  semestre            SMALLINT,
  turno               turno,
  frase               VARCHAR(140),
  sobre               VARCHAR(1000),
  foto_url            VARCHAR(300),
  objetivos           TEXT[]        NOT NULL DEFAULT '{}',
  interesses          TEXT[]        NOT NULL DEFAULT '{}',
  habilidades         TEXT[]        NOT NULL DEFAULT '{}',
  horarios_livres     TEXT[]        NOT NULL DEFAULT '{}',
  contatos            JSONB         NOT NULL DEFAULT '{}',
  status              status_conta  NOT NULL DEFAULT 'ATIVA',
  advertencias        SMALLINT      NOT NULL DEFAULT 0,
  email_verificado_em TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_email_key UNIQUE (email),
  CONSTRAINT usuarios_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT usuarios_email_ck CHECK (email = lower(email)),
  CONSTRAINT usuarios_semestre_ck CHECK (semestre BETWEEN 1 AND 12),
  CONSTRAINT usuarios_advertencias_ck CHECK (advertencias >= 0),
  CONSTRAINT usuarios_nascimento_aluno_ck CHECK (papel <> 'ALUNO' OR data_nascimento IS NOT NULL),
  CONSTRAINT usuarios_curso_fk FOREIGN KEY (instituicao_id, curso_id)
    REFERENCES cursos (instituicao_id, id) ON DELETE SET NULL (curso_id)
);
CREATE INDEX usuarios_instituicao_idx ON usuarios (instituicao_id, status);

CREATE TABLE usuario_disciplinas (
  instituicao_id UUID               NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID               NOT NULL,
  disciplina_id  UUID               NOT NULL,
  relacao        relacao_disciplina NOT NULL,
  PRIMARY KEY (usuario_id, disciplina_id, relacao),
  CONSTRAINT usuario_disciplinas_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT usuario_disciplinas_disciplina_fk FOREIGN KEY (instituicao_id, disciplina_id)
    REFERENCES disciplinas (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX usuario_disciplinas_disciplina_idx ON usuario_disciplinas (disciplina_id, relacao);

CREATE TABLE codigos_verificacao (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  email          VARCHAR(160) NOT NULL,
  codigo_hash    VARCHAR(100) NOT NULL,
  tentativas     SMALLINT     NOT NULL DEFAULT 0,
  expira_em      TIMESTAMPTZ  NOT NULL,
  usado_em       TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT codigos_verificacao_tentativas_ck CHECK (tentativas BETWEEN 0 AND 5)
);
CREATE INDEX codigos_verificacao_email_idx ON codigos_verificacao (email, criado_em DESC);

CREATE TABLE sessoes (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id     UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id         UUID         NOT NULL,
  refresh_token_hash VARCHAR(100) NOT NULL,
  dispositivo        VARCHAR(120),
  criado_em          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expira_em          TIMESTAMPTZ  NOT NULL,
  revogada_em        TIMESTAMPTZ,
  CONSTRAINT sessoes_refresh_token_hash_key UNIQUE (refresh_token_hash),
  CONSTRAINT sessoes_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX sessoes_usuario_idx ON sessoes (usuario_id);

-- ───────────────────────── Conexões ─────────────────────────
CREATE TABLE curtidas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  de_id          UUID        NOT NULL,
  para_id        UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curtidas_par_key UNIQUE (de_id, para_id),
  CONSTRAINT curtidas_si_mesmo_ck CHECK (de_id <> para_id),
  CONSTRAINT curtidas_de_fk FOREIGN KEY (instituicao_id, de_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT curtidas_para_fk FOREIGN KEY (instituicao_id, para_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX curtidas_para_idx ON curtidas (para_id);

CREATE TABLE recusas (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  de_id          UUID        NOT NULL,
  para_id        UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recusas_par_key UNIQUE (de_id, para_id),
  CONSTRAINT recusas_si_mesmo_ck CHECK (de_id <> para_id),
  CONSTRAINT recusas_de_fk FOREIGN KEY (instituicao_id, de_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT recusas_para_fk FOREIGN KEY (instituicao_id, para_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

CREATE TABLE matches (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_a_id   UUID        NOT NULL,
  usuario_b_id   UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  desfeito_em    TIMESTAMPTZ,
  CONSTRAINT matches_par_key UNIQUE (usuario_a_id, usuario_b_id),
  CONSTRAINT matches_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT matches_ordem_ck CHECK (usuario_a_id < usuario_b_id),
  CONSTRAINT matches_a_fk FOREIGN KEY (instituicao_id, usuario_a_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT matches_b_fk FOREIGN KEY (instituicao_id, usuario_b_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX matches_b_idx ON matches (usuario_b_id);

CREATE TABLE mensagens (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID          NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  match_id       UUID          NOT NULL,
  autor_id       UUID          NOT NULL,
  texto          VARCHAR(1000) NOT NULL,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  lida_em        TIMESTAMPTZ,
  CONSTRAINT mensagens_texto_ck CHECK (length(btrim(texto)) > 0),
  CONSTRAINT mensagens_match_fk FOREIGN KEY (instituicao_id, match_id)
    REFERENCES matches (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT mensagens_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX mensagens_match_idx ON mensagens (match_id, criado_em);

CREATE TABLE bloqueios (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  bloqueador_id  UUID        NOT NULL,
  bloqueado_id   UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bloqueador_id, bloqueado_id),
  CONSTRAINT bloqueios_si_mesmo_ck CHECK (bloqueador_id <> bloqueado_id),
  CONSTRAINT bloqueios_bloqueador_fk FOREIGN KEY (instituicao_id, bloqueador_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT bloqueios_bloqueado_fk FOREIGN KEY (instituicao_id, bloqueado_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX bloqueios_bloqueado_idx ON bloqueios (bloqueado_id);

-- ───────────────────────── Feed ─────────────────────────
CREATE TABLE posts (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID           NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID           NOT NULL,
  categoria      categoria_post NOT NULL DEFAULT 'GERAL',
  texto          VARCHAR(500)   NOT NULL,
  imagem_url     VARCHAR(300),
  evento_inicio  TIMESTAMPTZ,
  evento_local   VARCHAR(120),
  criado_em      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  removido_em    TIMESTAMPTZ,
  CONSTRAINT posts_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT posts_texto_ck CHECK (length(btrim(texto)) > 0),
  CONSTRAINT posts_evento_ck CHECK (categoria <> 'EVENTO' OR evento_inicio IS NOT NULL),
  CONSTRAINT posts_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX posts_feed_idx ON posts (instituicao_id, criado_em DESC) WHERE removido_em IS NULL;

CREATE TABLE comentarios (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  post_id        UUID         NOT NULL,
  autor_id       UUID         NOT NULL,
  texto          VARCHAR(300) NOT NULL,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT comentarios_texto_ck CHECK (length(btrim(texto)) > 0),
  CONSTRAINT comentarios_post_fk FOREIGN KEY (instituicao_id, post_id)
    REFERENCES posts (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT comentarios_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX comentarios_post_idx ON comentarios (post_id, criado_em);

CREATE TABLE curtidas_post (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  post_id        UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, usuario_id),
  CONSTRAINT curtidas_post_post_fk FOREIGN KEY (instituicao_id, post_id)
    REFERENCES posts (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT curtidas_post_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

CREATE TABLE presencas_evento (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  post_id        UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, usuario_id),
  CONSTRAINT presencas_evento_post_fk FOREIGN KEY (instituicao_id, post_id)
    REFERENCES posts (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT presencas_evento_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

-- ───────────────────────── Grupos de estudo ─────────────────────────
CREATE TABLE grupos_estudo (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  disciplina_id  UUID,
  criador_id     UUID         NOT NULL,
  nome           VARCHAR(80)  NOT NULL,
  descricao      VARCHAR(300),
  encontro       VARCHAR(80),
  local          VARCHAR(80),
  vagas          SMALLINT     NOT NULL DEFAULT 10,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT grupos_estudo_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT grupos_estudo_vagas_ck CHECK (vagas BETWEEN 3 AND 20),
  CONSTRAINT grupos_estudo_disciplina_fk FOREIGN KEY (instituicao_id, disciplina_id)
    REFERENCES disciplinas (instituicao_id, id) ON DELETE SET NULL (disciplina_id),
  CONSTRAINT grupos_estudo_criador_fk FOREIGN KEY (instituicao_id, criador_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX grupos_estudo_instituicao_idx ON grupos_estudo (instituicao_id, criado_em DESC);

CREATE TABLE grupo_membros (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  grupo_id       UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  papel          papel_grupo NOT NULL DEFAULT 'MEMBRO',
  entrou_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  lido_ate       TIMESTAMPTZ,
  PRIMARY KEY (grupo_id, usuario_id),
  CONSTRAINT grupo_membros_grupo_fk FOREIGN KEY (instituicao_id, grupo_id)
    REFERENCES grupos_estudo (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT grupo_membros_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX grupo_membros_usuario_idx ON grupo_membros (usuario_id);

CREATE TABLE grupo_mensagens (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID          NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  grupo_id       UUID          NOT NULL,
  autor_id       UUID          NOT NULL,
  texto          VARCHAR(1000) NOT NULL,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT grupo_mensagens_texto_ck CHECK (length(btrim(texto)) > 0),
  CONSTRAINT grupo_mensagens_grupo_fk FOREIGN KEY (instituicao_id, grupo_id)
    REFERENCES grupos_estudo (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT grupo_mensagens_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX grupo_mensagens_grupo_idx ON grupo_mensagens (grupo_id, criado_em);

-- ───────────────────────── Coordenação ─────────────────────────
CREATE TABLE avisos (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID         NOT NULL,
  titulo         VARCHAR(80)  NOT NULL,
  texto          VARCHAR(500) NOT NULL,
  fixado         BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  removido_em    TIMESTAMPTZ,
  CONSTRAINT avisos_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX avisos_instituicao_idx ON avisos (instituicao_id, criado_em DESC) WHERE removido_em IS NULL;

CREATE TABLE denuncias (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id   UUID            NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  denunciante_id   UUID            NOT NULL,
  denunciado_id    UUID            NOT NULL,
  motivo           motivo_denuncia NOT NULL,
  detalhe          VARCHAR(500),
  status           status_denuncia NOT NULL DEFAULT 'ABERTA',
  acao             acao_denuncia,
  resolvida_por_id UUID,
  resolvida_em     TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_si_mesmo_ck CHECK (denunciante_id <> denunciado_id),
  CONSTRAINT denuncias_decisao_ck CHECK (
    (status = 'ABERTA' AND acao IS NULL AND resolvida_por_id IS NULL AND resolvida_em IS NULL)
    OR (status = 'RESOLVIDA' AND acao IS NOT NULL AND resolvida_em IS NOT NULL)
  ),
  CONSTRAINT denuncias_denunciante_fk FOREIGN KEY (instituicao_id, denunciante_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT denuncias_denunciado_fk FOREIGN KEY (instituicao_id, denunciado_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT denuncias_resolvida_por_fk FOREIGN KEY (instituicao_id, resolvida_por_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE SET NULL (resolvida_por_id)
);
CREATE INDEX denuncias_fila_idx ON denuncias (instituicao_id, status, criado_em);
