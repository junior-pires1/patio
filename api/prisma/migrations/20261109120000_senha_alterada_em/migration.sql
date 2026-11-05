-- Pátio · Migração 11 — senha trocada e sessões renovadas.
--
-- usuarios.senha_alterada_em: tokens de acesso emitidos antes da última troca
-- de senha deixam de valer na hora (antes valiam até vencer, por até 15 min,
-- em outros aparelhos).
--
-- sessoes.renovada: marca o token de renovação que já foi trocado por outro.
-- Só o reuso de um token assim indica roubo (e derruba todas as sessões).
-- Uma sessão encerrada por troca de senha ou "sair" que volta a ser usada
-- (o outro aparelho abrindo o app) só recebe 401, sem derrubar a sessão nova.

ALTER TABLE usuarios ADD COLUMN senha_alterada_em TIMESTAMPTZ;
ALTER TABLE sessoes ADD COLUMN renovada BOOLEAN NOT NULL DEFAULT false;
