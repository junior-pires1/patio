-- Pátio · Migração 7 — perfil social (estilo Instagram e LinkedIn)
-- Links públicos, experiências, recomendações de habilidades, stories de 24
-- horas (só para conexões) e destaques fixos no perfil.

-- Links que todos da faculdade veem (diferente de contatos, que só a conexão vê).
ALTER TABLE usuarios ADD COLUMN links JSONB NOT NULL DEFAULT '{}';

CREATE TABLE experiencias (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID         NOT NULL,
  tipo           VARCHAR(20)  NOT NULL,
  titulo         VARCHAR(100) NOT NULL,
  organizacao    VARCHAR(100),
  inicio         DATE         NOT NULL,
  fim            DATE,
  descricao      VARCHAR(500),
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT experiencias_tipo_ck CHECK (tipo IN
    ('ESTAGIO', 'EMPREGO', 'PROJETO', 'MONITORIA', 'PESQUISA', 'VOLUNTARIADO', 'CURSO')),
  CONSTRAINT experiencias_titulo_ck CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT experiencias_periodo_ck CHECK (fim IS NULL OR fim >= inicio),
  CONSTRAINT experiencias_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX experiencias_usuario_idx ON experiencias (usuario_id);

-- Recomendação de uma habilidade por um colega conectado (estilo LinkedIn).
CREATE TABLE endossos (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID        NOT NULL,
  autor_id       UUID        NOT NULL,
  habilidade     VARCHAR(40) NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, autor_id, habilidade),
  CONSTRAINT endossos_proprio_ck CHECK (usuario_id <> autor_id),
  CONSTRAINT endossos_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT endossos_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

CREATE TABLE stories (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID         NOT NULL,
  imagem_id      UUID         NOT NULL,
  legenda        VARCHAR(200),
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expira_em      TIMESTAMPTZ  NOT NULL DEFAULT now() + INTERVAL '24 hours',
  CONSTRAINT stories_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT stories_imagem_key UNIQUE (imagem_id),
  CONSTRAINT stories_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT stories_imagem_fk FOREIGN KEY (instituicao_id, imagem_id)
    REFERENCES imagens (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX stories_autor_idx ON stories (autor_id, criado_em DESC);

CREATE TABLE story_visualizacoes (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  story_id       UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  visto_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, usuario_id),
  CONSTRAINT story_visualizacoes_story_fk FOREIGN KEY (instituicao_id, story_id)
    REFERENCES stories (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT story_visualizacoes_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

CREATE TABLE destaques (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID        NOT NULL,
  titulo         VARCHAR(30) NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT destaques_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT destaques_titulo_ck CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT destaques_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX destaques_usuario_idx ON destaques (usuario_id);

CREATE TABLE destaque_stories (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  destaque_id    UUID        NOT NULL,
  story_id       UUID        NOT NULL,
  adicionado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (destaque_id, story_id),
  CONSTRAINT destaque_stories_destaque_fk FOREIGN KEY (instituicao_id, destaque_id)
    REFERENCES destaques (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT destaque_stories_story_fk FOREIGN KEY (instituicao_id, story_id)
    REFERENCES stories (instituicao_id, id) ON DELETE CASCADE
);

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'experiencias', 'endossos', 'stories', 'story_visualizacoes', 'destaques', 'destaque_stories'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY isolamento_faculdade ON %I TO patio_app
         USING (instituicao_id = app_instituicao())
         WITH CHECK (instituicao_id = app_instituicao())',
      tabela
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO patio_app', tabela);
  END LOOP;
END
$$;
