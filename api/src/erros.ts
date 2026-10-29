import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from './generated/prisma/client';

/**
 * Erro esperado da aplicação. Vira uma resposta no formato padrão:
 * `{ erro: 'codigo', mensagem: 'texto para a pessoa', campos?: {...} }`.
 */
export class ErroApp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly campos?: Record<string, string>,
  ) {
    super(mensagem);
    this.name = 'ErroApp';
  }
}

export const naoEncontrado = (mensagem = 'Registro não encontrado.') =>
  new ErroApp(404, 'nao_encontrado', mensagem);

export const naoAutenticado = (mensagem = 'Faça login para continuar.') =>
  new ErroApp(401, 'nao_autenticado', mensagem);

// Regras do banco (gatilhos e CHECKs) que podem chegar até a pessoa.
const REGRAS_DO_BANCO: Record<string, [string, string]> = {
  usuarios_dominio_ck: [
    'dominio_nao_aceito',
    'Use o e-mail institucional da sua faculdade.',
  ],
  usuarios_idade_ck: ['idade_minima', 'É preciso ter pelo menos 18 anos.'],
  grupo_membros_vagas_ck: ['grupo_cheio', 'O grupo não tem mais vagas.'],
  mensagens_autor_ck: ['conexao_inativa', 'Esta conversa não está mais disponível.'],
  grupo_mensagens_autor_ck: ['nao_e_membro', 'Entre no grupo para mandar mensagens.'],
};

type ErroPostgres = { code: string; message: string };

/**
 * Procura o erro original do PostgreSQL. Com o adapter `pg`, o Prisma o
 * guarda em `meta.driverAdapterError.cause`; o driver `pg` usa `code`.
 */
function erroDoPostgres(e: unknown): ErroPostgres | undefined {
  const candidatos: unknown[] = [e];
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const adapter = (e.meta as { driverAdapterError?: { cause?: unknown } } | undefined)
      ?.driverAdapterError;
    candidatos.unshift(adapter?.cause);
  }
  for (const c of candidatos) {
    if (!c || typeof c !== 'object') continue;
    const { code, message } = c as { code?: unknown; message?: unknown };
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, message: typeof message === 'string' ? message : '' };
    }
  }
  return undefined;
}

/** Erros vindos do banco: regras com nome (gatilhos e CHECKs) e classes conhecidas. */
function erroDoBanco(e: unknown): ErroApp | undefined {
  const pg = erroDoPostgres(e);
  if (!pg) return undefined;
  const regra = Object.keys(REGRAS_DO_BANCO).find((nome) => pg.message.includes(nome));
  if (regra) {
    const [codigo, mensagem] = REGRAS_DO_BANCO[regra]!;
    return new ErroApp(422, codigo, mensagem);
  }
  if (pg.code === '23505') return new ErroApp(409, 'duplicado', 'Este registro já existe.');
  if (pg.code === '23503')
    return new ErroApp(422, 'referencia_invalida', 'Referência inválida.');
  if (pg.code === '23514')
    return new ErroApp(422, 'regra_violada', 'Os dados violam uma regra do sistema.');
  return undefined;
}

/** Converte qualquer erro em resposta HTTP. Detalhes internos nunca vão para o cliente. */
export function converterErro(e: unknown): ErroApp {
  if (e instanceof ErroApp) return e;

  if (e instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const problema of e.issues) {
      const campo = problema.path.join('.') || '_';
      campos[campo] ??= problema.message;
    }
    return new ErroApp(400, 'dados_invalidos', 'Confira os dados enviados.', campos);
  }

  if (e && typeof e === 'object' && (e as { type?: unknown }).type === 'entity.too.large') {
    return new ErroApp(413, 'conteudo_grande', 'O conteúdo enviado é grande demais.');
  }

  if (e instanceof SyntaxError && 'body' in e) {
    return new ErroApp(400, 'json_invalido', 'O corpo da requisição não é um JSON válido.');
  }

  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002')
      return new ErroApp(409, 'duplicado', 'Este registro já existe.');
    if (e.code === 'P2025') return naoEncontrado();
    if (e.code === 'P2003')
      return new ErroApp(422, 'referencia_invalida', 'Referência inválida.');
  }

  const banco = erroDoBanco(e);
  if (banco) return banco;

  return new ErroApp(500, 'erro_interno', 'Algo deu errado. Tente novamente em instantes.');
}

export const tratarErros: ErrorRequestHandler = (e, _req, res, _next) => {
  const erro = converterErro(e);
  if (erro.status >= 500) console.error(e);
  res.status(erro.status).json({
    erro: erro.codigo,
    mensagem: erro.message,
    ...(erro.campos ? { campos: erro.campos } : {}),
  });
};
