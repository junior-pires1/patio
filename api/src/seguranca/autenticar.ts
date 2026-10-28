import type { Request, RequestHandler } from 'express';
import { ErroApp, naoAutenticado } from '../erros';
import { type Autenticado, type Papel, verificarAcesso } from './tokens';

const CHAVE = Symbol('autenticado');
type ComAutenticado = Request & { [CHAVE]?: Autenticado };

/** Exige `Authorization: Bearer <token de acesso>`. */
export function autenticar(segredo: string): RequestHandler {
  return (req, _res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();
    (req as ComAutenticado)[CHAVE] = verificarAcesso(token, segredo);
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
