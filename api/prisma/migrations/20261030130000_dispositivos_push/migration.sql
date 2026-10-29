-- Pátio · Migração 5 — aparelhos para notificações com o app fechado (RF27)

CREATE TABLE dispositivos_push (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  usuario_id     UUID         NOT NULL,
  token          VARCHAR(200) NOT NULL,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT dispositivos_push_token_key UNIQUE (token),
  CONSTRAINT dispositivos_push_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX dispositivos_push_usuario_idx ON dispositivos_push (usuario_id);

ALTER TABLE dispositivos_push ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento_faculdade ON dispositivos_push TO patio_app
  USING (instituicao_id = app_instituicao())
  WITH CHECK (instituicao_id = app_instituicao());
GRANT SELECT, INSERT, UPDATE, DELETE ON dispositivos_push TO patio_app;
