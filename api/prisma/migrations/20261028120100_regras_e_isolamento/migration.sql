-- Pátio · Migração 2 — regras de negócio no banco e isolamento por faculdade
--
-- Como o isolamento funciona:
--   1. A API abre uma transação, troca para o papel restrito patio_app
--      (SET LOCAL ROLE) e grava a faculdade do token em app.instituicao_id
--      (set_config(..., true), que vale só para a transação).
--   2. As políticas de segurança em nível de linha (RLS) só deixam patio_app
--      ver e gravar linhas dessa faculdade. Uma consulta sem filtro devolve
--      apenas dados da própria faculdade.
--   3. O dono das tabelas (usado nas migrações, no seed e nas rotas da
--      plataforma) não é afetado pelo RLS.

-- ───────────────────────── Papel restrito da aplicação ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'patio_app') THEN
    CREATE ROLE patio_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- O usuário que roda as migrações precisa poder assumir o papel patio_app.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'patio_app', 'MEMBER') THEN
    EXECUTE format('GRANT patio_app TO %I', current_user);
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO patio_app;

-- Faculdade da transação atual (NULL quando não definida: nenhuma linha passa).
CREATE FUNCTION app_instituicao() RETURNS UUID
  LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.instituicao_id', TRUE), '')::UUID $$;

GRANT EXECUTE ON FUNCTION app_instituicao() TO patio_app;

-- ───────────────────────── Permissões ─────────────────────────
-- Tabelas da plataforma: só leitura do necessário para cadastro e telas.
GRANT SELECT ON instituicoes, dominios_email TO patio_app;
-- administradores: nenhum acesso para patio_app.
GRANT SELECT, INSERT ON auditoria TO patio_app;
GRANT USAGE ON SEQUENCE auditoria_id_seq TO patio_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  cursos, disciplinas, usuarios, usuario_disciplinas, codigos_verificacao, sessoes,
  curtidas, recusas, matches, mensagens, bloqueios, posts, comentarios, curtidas_post,
  presencas_evento, grupos_estudo, grupo_membros, grupo_mensagens, avisos, denuncias
TO patio_app;

-- ───────────────────────── Políticas RLS ─────────────────────────
DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'cursos', 'disciplinas', 'usuarios', 'usuario_disciplinas', 'codigos_verificacao', 'sessoes',
    'curtidas', 'recusas', 'matches', 'mensagens', 'posts', 'comentarios', 'curtidas_post',
    'presencas_evento', 'grupos_estudo', 'grupo_membros', 'grupo_mensagens', 'avisos',
    'denuncias', 'bloqueios', 'auditoria'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format(
      'CREATE POLICY isolamento_faculdade ON %I TO patio_app
         USING (instituicao_id = app_instituicao())
         WITH CHECK (instituicao_id = app_instituicao())',
      tabela
    );
  END LOOP;
END
$$;

-- Os erros dos gatilhos começam com [nome_da_regra]: a API usa esse nome para
-- devolver uma mensagem amigável (o driver não repassa o campo CONSTRAINT).

-- ───────────────────────── Gatilhos: usuarios ─────────────────────────
-- E-mail do domínio da faculdade (subdomínios aceitos) e idade mínima de 18 anos.
CREATE FUNCTION usuarios_validar() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  dominio_email TEXT := split_part(NEW.email, '@', 2);
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM dominios_email d
     WHERE d.instituicao_id = NEW.instituicao_id
       AND (dominio_email = d.dominio OR dominio_email LIKE '%.' || d.dominio)
  ) THEN
    RAISE EXCEPTION '[usuarios_dominio_ck] O e-mail % não pertence a um domínio da faculdade', NEW.email
      USING ERRCODE = 'check_violation', CONSTRAINT = 'usuarios_dominio_ck';
  END IF;

  IF NEW.data_nascimento IS NOT NULL
     AND NEW.data_nascimento > (current_date - INTERVAL '18 years') THEN
    RAISE EXCEPTION '[usuarios_idade_ck] É preciso ter pelo menos 18 anos'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'usuarios_idade_ck';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER usuarios_validar
  BEFORE INSERT OR UPDATE OF email, instituicao_id, data_nascimento ON usuarios
  FOR EACH ROW EXECUTE FUNCTION usuarios_validar();

CREATE FUNCTION tocar_atualizado_em() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER usuarios_atualizado_em
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();

-- ───────────────────────── Gatilhos: mensagens ─────────────────────────
-- O autor participa da conexão e ela está ativa.
CREATE FUNCTION mensagens_validar() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM matches m
     WHERE m.id = NEW.match_id
       AND m.desfeito_em IS NULL
       AND NEW.autor_id IN (m.usuario_a_id, m.usuario_b_id)
  ) THEN
    RAISE EXCEPTION '[mensagens_autor_ck] O autor não participa de uma conexão ativa'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'mensagens_autor_ck';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER mensagens_validar
  BEFORE INSERT ON mensagens
  FOR EACH ROW EXECUTE FUNCTION mensagens_validar();

-- ───────────────────────── Gatilhos: grupos ─────────────────────────
-- O número de membros não ultrapassa o de vagas. A linha do grupo é travada
-- para que duas entradas simultâneas não passem do limite.
CREATE FUNCTION grupo_membros_validar() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
DECLARE
  limite SMALLINT;
  ocupadas INTEGER;
BEGIN
  SELECT vagas INTO limite FROM grupos_estudo WHERE id = NEW.grupo_id FOR UPDATE;
  SELECT count(*) INTO ocupadas FROM grupo_membros WHERE grupo_id = NEW.grupo_id;
  IF ocupadas >= limite THEN
    RAISE EXCEPTION '[grupo_membros_vagas_ck] O grupo está cheio'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'grupo_membros_vagas_ck';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER grupo_membros_validar
  BEFORE INSERT ON grupo_membros
  FOR EACH ROW EXECUTE FUNCTION grupo_membros_validar();

-- O autor da mensagem é membro do grupo.
CREATE FUNCTION grupo_mensagens_validar() RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM grupo_membros WHERE grupo_id = NEW.grupo_id AND usuario_id = NEW.autor_id
  ) THEN
    RAISE EXCEPTION '[grupo_mensagens_autor_ck] O autor não é membro do grupo'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'grupo_mensagens_autor_ck';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER grupo_mensagens_validar
  BEFORE INSERT ON grupo_mensagens
  FOR EACH ROW EXECUTE FUNCTION grupo_mensagens_validar();
