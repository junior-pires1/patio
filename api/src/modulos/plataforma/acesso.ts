import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Contexto } from '../../contexto';
import { naoAutenticado } from '../../erros';

/** Equipe da plataforma: token próprio (público "plataforma"), sem faculdade. */
const PUBLICO = 'plataforma';
export const DURACAO_PLATAFORMA_SEGUNDOS = 8 * 60 * 60;

export function assinarPlataforma(adminId: string, segredo: string): string {
  return jwt.sign({}, segredo, {
    algorithm: 'HS256',
    subject: adminId,
    audience: PUBLICO,
    expiresIn: DURACAO_PLATAFORMA_SEGUNDOS,
  });
}

const CHAVE = Symbol('admin');
type ComAdmin = Request & { [CHAVE]?: string };

/**
 * Exige token da equipe da plataforma e confere que o administrador existe.
 * Tokens de aluno ou coordenação não servem aqui (e vice-versa).
 */
export function autenticarPlataforma(
  ctx: Pick<Contexto, 'segredoJwt' | 'prisma'>,
): RequestHandler {
  return async (req, _res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();
    let adminId: string | undefined;
    try {
      adminId = jwt.verify(token, ctx.segredoJwt, {
        algorithms: ['HS256'],
        audience: PUBLICO,
      }).sub as string;
    } catch {
      throw naoAutenticado('Sessão expirada ou inválida. Faça login novamente.');
    }
    const admin = await ctx.prisma.administrador.findUnique({
      where: { id: adminId },
      select: { id: true },
    });
    if (!admin) throw naoAutenticado();
    (req as ComAdmin)[CHAVE] = admin.id;
    next();
  };
}

export function adminDe(req: Request): string {
  const id = (req as ComAdmin)[CHAVE];
  if (!id) throw naoAutenticado();
  return id;
}
