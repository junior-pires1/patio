-- Pátio · Migração 8 — social (estilo Instagram)
-- Respostas e curtidas em comentários, menções, publicações salvas,
-- publicação compartilhada no chat e a central de notificações.

-- Comentário pode responder outro comentário do mesmo post.
ALTER TABLE comentarios ADD CONSTRAINT comentarios_instituicao_id_key UNIQUE (instituicao_id, id);
ALTER TABLE comentarios ADD COLUMN pai_id UUID;
ALTER TABLE comentarios ADD CONSTRAINT comentarios_pai_fk FOREIGN KEY (instituicao_id, pai_id)
  REFERENCES comentarios (instituicao_id, id) ON DELETE CASCADE;
CREATE INDEX comentarios_pai_idx ON comentarios (pai_id);

-- Pessoas marcadas com @ (o app escolhe na lista; o texto mostra o apelido).
ALTER TABLE posts ADD COLUMN mencoes UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE comentarios ADD COLUMN mencoes UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE posts ADD CONSTRAINT posts_mencoes_ck CHECK (cardinality(mencoes) <= 10);
ALTER TABLE comentarios ADD CONSTRAINT comentarios_mencoes_ck CHECK (cardinality(mencoes) <= 10);

CREATE TABLE curtidas_comentario (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  comentario_id  UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comentario_id, usuario_id),
  CONSTRAINT curtidas_comentario_comentario_fk FOREIGN KEY (instituicao_id, comentario_id)
    REFERENCES comentarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT curtidas_comentario_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

CREATE TABLE posts_salvos (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID        NOT NULL,
  post_id        UUID        NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, post_id),
  CONSTRAINT posts_salvos_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT posts_salvos_post_fk FOREIGN KEY (instituicao_id, post_id)
    REFERENCES posts (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX posts_salvos_usuario_idx ON posts_salvos (usuario_id, criado_em DESC);

-- Publicação enviada numa conversa. Post removido continua na linha (removido_em)
-- e aparece como indisponível; só some se o post for apagado de vez.
ALTER TABLE mensagens ADD COLUMN post_id UUID;
ALTER TABLE mensagens ADD CONSTRAINT mensagens_post_fk FOREIGN KEY (instituicao_id, post_id)
  REFERENCES posts (instituicao_id, id) ON DELETE CASCADE;
ALTER TABLE mensagens
  DROP CONSTRAINT mensagens_texto_ck,
  ADD CONSTRAINT mensagens_texto_ck
    CHECK (length(btrim(texto)) > 0 OR imagem_id IS NOT NULL OR post_id IS NOT NULL);

CREATE TABLE notificacoes (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID         NOT NULL,
  ator_id        UUID,
  tipo           VARCHAR(30)  NOT NULL,
  post_id        UUID,
  comentario_id  UUID,
  match_id       UUID,
  texto          VARCHAR(160),
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  lida_em        TIMESTAMPTZ,
  CONSTRAINT notificacoes_tipo_ck CHECK (tipo IN (
    'POST_CURTIDO', 'POST_COMENTADO', 'COMENTARIO_RESPONDIDO', 'COMENTARIO_CURTIDO',
    'MENCAO', 'CONEXAO_NOVA', 'RECOMENDACAO')),
  CONSTRAINT notificacoes_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT notificacoes_ator_fk FOREIGN KEY (instituicao_id, ator_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT notificacoes_post_fk FOREIGN KEY (instituicao_id, post_id)
    REFERENCES posts (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT notificacoes_comentario_fk FOREIGN KEY (instituicao_id, comentario_id)
    REFERENCES comentarios (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT notificacoes_match_fk FOREIGN KEY (instituicao_id, match_id)
    REFERENCES matches (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX notificacoes_usuario_idx ON notificacoes (usuario_id, criado_em DESC);
CREATE INDEX notificacoes_nao_lidas_idx ON notificacoes (usuario_id) WHERE lida_em IS NULL;

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['curtidas_comentario', 'posts_salvos', 'notificacoes']
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
