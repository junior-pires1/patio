-- Pátio · Migração 10 — match (estilo Tinder) e carreira (estilo LinkedIn)
-- Super curtida, seguir pessoas, visitas ao perfil, vagas com candidatura
-- e certificados nas experiências.

-- Super curtida: a pessoa fica sabendo na hora quem foi.
ALTER TABLE curtidas ADD COLUMN super BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX curtidas_super_idx ON curtidas (de_id, criado_em) WHERE super;

ALTER TABLE notificacoes DROP CONSTRAINT notificacoes_tipo_ck;
ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_tipo_ck CHECK (tipo IN (
  'POST_CURTIDO', 'POST_COMENTADO', 'COMENTARIO_RESPONDIDO', 'COMENTARIO_CURTIDO',
  'MENCAO', 'CONEXAO_NOVA', 'RECOMENDACAO', 'SUPER_CURTIDA', 'NOVO_SEGUIDOR',
  'CANDIDATURA_NOVA', 'CANDIDATURA_ATUALIZADA'));
ALTER TABLE notificacoes ADD COLUMN vaga_id UUID;

-- Certificados entram como experiência, com link para conferir.
ALTER TABLE experiencias DROP CONSTRAINT experiencias_tipo_ck;
ALTER TABLE experiencias ADD CONSTRAINT experiencias_tipo_ck CHECK (tipo IN
  ('ESTAGIO', 'EMPREGO', 'PROJETO', 'MONITORIA', 'PESQUISA', 'VOLUNTARIADO', 'CURSO',
   'CERTIFICADO'));
ALTER TABLE experiencias ADD COLUMN link VARCHAR(300);

-- Seguir alguém sem precisar de match (vê as publicações em "Seguindo").
CREATE TABLE seguidores (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  seguidor_id    UUID        NOT NULL,
  seguido_id     UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (seguidor_id, seguido_id),
  CONSTRAINT seguidores_proprio_ck CHECK (seguidor_id <> seguido_id),
  CONSTRAINT seguidores_seguidor_fk FOREIGN KEY (instituicao_id, seguidor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT seguidores_seguido_fk FOREIGN KEY (instituicao_id, seguido_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX seguidores_seguido_idx ON seguidores (seguido_id);

-- Quem viu o perfil: uma linha por visitante por dia.
CREATE TABLE visitas_perfil (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  perfil_id      UUID        NOT NULL,
  visitante_id   UUID        NOT NULL,
  dia            DATE        NOT NULL DEFAULT CURRENT_DATE,
  ultima_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, visitante_id, dia),
  CONSTRAINT visitas_perfil_propria_ck CHECK (perfil_id <> visitante_id),
  CONSTRAINT visitas_perfil_perfil_fk FOREIGN KEY (instituicao_id, perfil_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT visitas_perfil_visitante_fk FOREIGN KEY (instituicao_id, visitante_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX visitas_perfil_recentes_idx ON visitas_perfil (perfil_id, ultima_em DESC);

-- Vagas de estágio, monitoria, pesquisa e projetos da faculdade.
CREATE TABLE vagas (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID          NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID          NOT NULL,
  tipo           VARCHAR(20)   NOT NULL,
  titulo         VARCHAR(100)  NOT NULL,
  organizacao    VARCHAR(100),
  descricao      VARCHAR(1500) NOT NULL,
  local          VARCHAR(100),
  modalidade     VARCHAR(12)   NOT NULL DEFAULT 'PRESENCIAL',
  link           VARCHAR(300),
  prazo          DATE,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  encerrada_em   TIMESTAMPTZ,
  CONSTRAINT vagas_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT vagas_tipo_ck CHECK (tipo IN
    ('ESTAGIO', 'MONITORIA', 'PESQUISA', 'PROJETO', 'EMPREGO', 'VOLUNTARIADO')),
  CONSTRAINT vagas_modalidade_ck CHECK (modalidade IN ('PRESENCIAL', 'REMOTO', 'HIBRIDO')),
  CONSTRAINT vagas_titulo_ck CHECK (length(btrim(titulo)) > 0),
  CONSTRAINT vagas_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX vagas_recentes_idx ON vagas (instituicao_id, criado_em DESC);

CREATE TABLE candidaturas (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  vaga_id        UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  mensagem       VARCHAR(500),
  status         VARCHAR(12) NOT NULL DEFAULT 'ENVIADA',
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (vaga_id, usuario_id),
  CONSTRAINT candidaturas_status_ck CHECK (status IN
    ('ENVIADA', 'EM_ANALISE', 'APROVADA', 'RECUSADA')),
  CONSTRAINT candidaturas_vaga_fk FOREIGN KEY (instituicao_id, vaga_id)
    REFERENCES vagas (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT candidaturas_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX candidaturas_usuario_idx ON candidaturas (usuario_id, criado_em DESC);

ALTER TABLE notificacoes ADD CONSTRAINT notificacoes_vaga_fk FOREIGN KEY (instituicao_id, vaga_id)
  REFERENCES vagas (instituicao_id, id) ON DELETE CASCADE;

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['seguidores', 'visitas_perfil', 'vagas', 'candidaturas']
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
