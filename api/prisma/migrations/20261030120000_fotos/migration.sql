-- Pátio · Migração 4 — fotos de perfil (RF06)
-- A imagem fica no próprio banco (até 1 MB, já reduzida pelo app), sem
-- depender de um serviço de arquivos externo.

CREATE TABLE fotos (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID        NOT NULL,
  tipo           VARCHAR(20) NOT NULL,
  dados          BYTEA       NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fotos_usuario_key UNIQUE (usuario_id),
  CONSTRAINT fotos_instituicao_usuario_key UNIQUE (instituicao_id, usuario_id),
  CONSTRAINT fotos_tipo_ck CHECK (tipo IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT fotos_tamanho_ck CHECK (octet_length(dados) BETWEEN 1 AND 1048576),
  CONSTRAINT fotos_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento_faculdade ON fotos TO patio_app
  USING (instituicao_id = app_instituicao())
  WITH CHECK (instituicao_id = app_instituicao());
GRANT SELECT, INSERT, UPDATE, DELETE ON fotos TO patio_app;
