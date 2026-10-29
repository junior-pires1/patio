-- Pátio · Migração 3 — permitir SET ROLE patio_app em servidores gerenciados
--
-- No PostgreSQL 16+, quem cria um papel sem ser superusuário (caso do Neon,
-- Render e Supabase) recebe só a opção ADMIN sobre ele, sem a opção SET.
-- Sem SET, o `SET LOCAL ROLE patio_app` do naFaculdade() falha com
-- "permission denied to set role". Aqui a opção SET é concedida.

DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 160000
     AND NOT pg_has_role(current_user, 'patio_app', 'SET') THEN
    EXECUTE format('GRANT patio_app TO %I WITH INHERIT FALSE, SET TRUE', current_user);
  END IF;
END
$$;
