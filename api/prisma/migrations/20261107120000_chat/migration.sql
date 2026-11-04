-- Pátio · Migração 9 — chat completo
-- Responder uma mensagem, reações, apagar mensagem e mensagens de voz.

CREATE TABLE audios (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id UUID         NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  autor_id       UUID         NOT NULL,
  tipo           VARCHAR(40)  NOT NULL,
  dados          BYTEA        NOT NULL,
  duracao_ms     INTEGER      NOT NULL,
  criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT audios_instituicao_id_key UNIQUE (instituicao_id, id),
  CONSTRAINT audios_tipo_ck CHECK (tipo IN
    ('audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/aac')),
  CONSTRAINT audios_tamanho_ck CHECK (octet_length(dados) BETWEEN 1 AND 1048576),
  CONSTRAINT audios_duracao_ck CHECK (duracao_ms BETWEEN 1 AND 120000),
  CONSTRAINT audios_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);
CREATE INDEX audios_autor_idx ON audios (autor_id, criado_em);

ALTER TABLE mensagens ADD CONSTRAINT mensagens_instituicao_id_key UNIQUE (instituicao_id, id);
ALTER TABLE mensagens ADD COLUMN resposta_id UUID;
ALTER TABLE mensagens ADD CONSTRAINT mensagens_resposta_fk FOREIGN KEY (instituicao_id, resposta_id)
  REFERENCES mensagens (instituicao_id, id) ON DELETE SET NULL (resposta_id);
ALTER TABLE mensagens ADD COLUMN audio_id UUID;
ALTER TABLE mensagens ADD CONSTRAINT mensagens_audio_key UNIQUE (audio_id);
ALTER TABLE mensagens ADD CONSTRAINT mensagens_audio_fk FOREIGN KEY (instituicao_id, audio_id)
  REFERENCES audios (instituicao_id, id) ON DELETE SET NULL (audio_id);
ALTER TABLE mensagens ADD COLUMN apagada_em TIMESTAMPTZ;
ALTER TABLE mensagens
  DROP CONSTRAINT mensagens_texto_ck,
  ADD CONSTRAINT mensagens_texto_ck CHECK (
    length(btrim(texto)) > 0 OR imagem_id IS NOT NULL OR post_id IS NOT NULL
    OR audio_id IS NOT NULL OR apagada_em IS NOT NULL);

-- Uma reação por pessoa em cada mensagem (trocar substitui a anterior).
CREATE TABLE reacoes_mensagem (
  instituicao_id UUID        NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  mensagem_id    UUID        NOT NULL,
  usuario_id     UUID        NOT NULL,
  reacao         VARCHAR(12) NOT NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mensagem_id, usuario_id),
  CONSTRAINT reacoes_mensagem_reacao_ck CHECK (reacao IN
    ('AMEI', 'JOINHA', 'RISADA', 'UAU', 'TRISTE', 'FOGO')),
  CONSTRAINT reacoes_mensagem_mensagem_fk FOREIGN KEY (instituicao_id, mensagem_id)
    REFERENCES mensagens (instituicao_id, id) ON DELETE CASCADE,
  CONSTRAINT reacoes_mensagem_usuario_fk FOREIGN KEY (instituicao_id, usuario_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE CASCADE
);

DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['audios', 'reacoes_mensagem']
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
