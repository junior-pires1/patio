import type { Request, RequestHandler } from 'express';
import { naFaculdade } from '../banco/prisma';
import type { Contexto } from '../contexto';
import { ErroApp, naoAutenticado } from '../erros';
import { type Autenticado, type Papel, verificarAcesso } from './tokens';

const CHAVE = Symbol('autenticado');
type ComAutenticado = Request & { [CHAVE]?: Autenticado };

/**
 * Exige `Authorization: Bearer <token de acesso>` e confere no banco se a
 * conta continua ativa e a faculdade também: suspensão (RN16) e faculdade
 * desativada (RN20) valem na hora, sem esperar o token vencer.
 */
export function autenticar(ctx: Pick<Contexto, 'segredoJwt' | 'prisma'>): RequestHandler {
  return async (req, _res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();
    const autenticado = verificarAcesso(token, ctx.segredoJwt);

    const conta = await naFaculdade(ctx.prisma, autenticado.instituicaoId, (tx) =>
      tx.usuario.findUnique({
        where: { id: autenticado.id },
        select: { status: true, instituicao: { select: { ativa: true } } },
      }),
    );
    if (!conta || conta.status === 'EXCLUIDA') throw naoAutenticado();
    if (conta.status === 'SUSPENSA') {
      throw new ErroApp(403, 'conta_suspensa', 'Sua conta está suspensa pela coordenação.');
    }
    if (!conta.instituicao.ativa) {
      throw new ErroApp(403, 'faculdade_inativa', 'Sua faculdade não está ativa no Pátio.');
    }
    (req as ComAutenticado)[CHAVE] = autenticado;
    next();
  };
}

/** Quem fez a requisição. Só use em rotas protegidas por `autenticar`. */
export function quem(req: Request): Autenticado {
  const usuario = (req as ComAutenticado)[CHAVE];
  if (!usuario) throw naoAutenticado();
  return usuario;
}

/** Restringe a rota a alguns papéis (ex.: só a coordenação). */
export function exigirPapel(...papeis: Papel[]): RequestHandler {
  return (req, _res, next) => {
    if (!papeis.includes(quem(req).papel)) {
      throw new ErroApp(403, 'sem_permissao', 'Você não tem permissão para esta ação.');
    }
    next();
  };
}
