-- Pátio · Migração 6 — imagens nas publicações e nas conversas
-- Como as fotos de perfil, as imagens ficam no banco (até 1 MB, já reduzidas
-- pelo app). Quem envia é o autor; a imagem só é usada uma vez.

CREATE TABLE imagens (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID        NOT NULL,
  tipo           VARCHAR(20) NOT NULL,
  dados          BYTEA       NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT imagens_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT imagens_tipo_ck CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT imagens_tamanho_ck CHECK (octet_length(dados) BETWEEN 1 AND 1048576),
  CONSTRAINT imagens_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX imagens_autor_idx ON imagens (autor_id, criado_em);

ALTER TABLE imagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento_faculdade ON imagens TO patio_app
  USING (instituicao_id = app_instituicao())
  WITH CHECK (instituicao_id = app_instituicao());
GRANT SELECT, INSERT, UPDATE, DELETE ON imagens TO patio_app;

-- Publicações: a imagem passa a ser do próprio Pátio (antes era um endereço externo).
ALTER TABLE posts DROP COLUMN imagem_url;
ALTER TABLE posts ADD COLUMN imagem_id UUID;
ALTER TABLE posts
  ADD CONSTRAINT posts_imagem_key UNIQUE (imagem_id),
  ADD CONSTRAINT posts_imagem_fk FOREIGN KEY (instituicao_id, imagem_id)
    REFERENCES imagens (instituicao_id, id) ON DELETE SET NULL (imagem_id),
  DROP CONSTRAINT posts_texto_ck,
  -- Publicação removida perde a imagem e pode ficar sem texto.
  ADD CONSTRAINT posts_texto_ck
    CHECK (length(btrim(texto)) > 0 OR imagem_id IS NOT NULL OR removido_em IS NOT NULL);

-- Conversas: mensagem pode ser só a imagem (texto vazio).
ALTER TABLE mensagens ADD COLUMN imagem_id UUID;
ALTER TABLE mensagens
  ADD CONSTRAINT mensagens_imagem_key UNIQUE (imagem_id),
  ADD CONSTRAINT mensagens_imagem_fk FOREIGN KEY (instituicao_id, imagem_id)
    REFERENCES imagens (instituicao_id, id) ON DELETE SET NULL (imagem_id),
  DROP CONSTRAINT mensagens_texto_ck,
  ADD CONSTRAINT mensagens_texto_ck CHECK (length(btrim(texto)) > 0 OR imagem_id IS NOT NULL);

ALTER TABLE grupo_mensagens ADD COLUMN imagem_id UUID;
ALTER TABLE grupo_mensagens
  ADD CONSTRAINT grupo_mensagens_imagem_key UNIQUE (imagem_id),
  ADD CONSTRAINT grupo_mensagens_imagem_fk FOREIGN KEY (instituicao_id, imagem_id)
    REFERENCES imagens (instituicao_id, id) ON DELETE SET NULL (imagem_id),
  DROP CONSTRAINT grupo_mensagens_texto_ck,
  ADD CONSTRAINT grupo_mensagens_texto_ck
    CHECK (length(btrim(texto)) > 0 OR imagem_id IS NOT NULL);
