-- Pátio · Migração 12 — termo de uso e privacidade (LGPD) de cada faculdade.
--
-- Cada faculdade tem o seu termo, com versões. Sem versão publicada vale o
-- modelo padrão do Pátio (versão 1, gerado com o nome da faculdade). Publicar
-- um texto novo cria a próxima versão; as antigas ficam guardadas para provar
-- o que cada aluno aceitou.
--
-- No usuário ficam a versão aceita e quando. `termo_pendente` marca quem
-- ainda precisa aceitar antes de usar o app (contas criadas pela coordenação);
-- contas antigas não são afetadas.

CREATE TABLE termos (
  instituicao_id UUID          NOT NULL REFERENCES instituicoes (id) ON DELETE CASCADE,
  versao         INTEGER       NOT NULL,
  texto          VARCHAR(20000) NOT NULL,
  autor_id       UUID,
  publicado_em   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (instituicao_id, versao),
  CONSTRAINT termos_versao_ck CHECK (versao >= 2),
  CONSTRAINT termos_texto_ck CHECK (length(btrim(texto)) >= 200),
  CONSTRAINT termos_autor_fk FOREIGN KEY (instituicao_id, autor_id)
    REFERENCES usuarios (instituicao_id, id) ON DELETE SET NULL (autor_id)
);

ALTER TABLE usuarios
  ADD COLUMN termo_versao INTEGER,
  ADD COLUMN termo_aceito_em TIMESTAMPTZ,
  ADD COLUMN termo_pendente BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE termos ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento_faculdade ON termos TO patio_app
  USING (instituicao_id = app_instituicao())
  WITH CHECK (instituicao_id = app_instituicao());
GRANT SELECT, INSERT ON termos TO patio_app;
