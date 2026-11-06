import type { Request, RequestHandler } from 'express';
import { naFaculdade } from '../banco/prisma';
import type { Contexto } from '../contexto';
import { ErroApp, naoAutenticado } from '../erros';
import { type Autenticado, type Papel, verificarAcesso } from './tokens';

const CHAVE = Symbol('autenticado');

/** Rotas que funcionam antes de aceitar o termo (o resto responde 403 termo_pendente). */
const LIBERADO_SEM_TERMO = new Set([
  'GET /eu',
  'GET /eu/termo',
  'POST /eu/termo/aceite',
  'PUT /auth/senha',
  'PUT /eu/push',
  'DELETE /eu/push',
]);
type ComAutenticado = Request & { [CHAVE]?: Autenticado };

/**
 * Exige `Authorization: Bearer <token de acesso>` e confere no banco se a
 * conta continua ativa e a faculdade também: suspensão (RN16) e faculdade
 * desativada (RN20) valem na hora, sem esperar o token vencer. Troca de senha
 * também: tokens emitidos antes dela deixam de valer.
 */
export function autenticar(ctx: Pick<Contexto, 'segredoJwt' | 'prisma'>): RequestHandler {
  return async (req, _res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw naoAutenticado();
    const { emitidoEm, ...autenticado } = verificarAcesso(token, ctx.segredoJwt);

    const conta = await naFaculdade(ctx.prisma, autenticado.instituicaoId, (tx) =>
      tx.usuario.findUnique({
        where: { id: autenticado.id },
        select: {
          status: true,
          senhaAlteradaEm: true,
          termoPendente: true,
          instituicao: { select: { ativa: true } },
        },
      }),
    );
    if (!conta || conta.status === 'EXCLUIDA') throw naoAutenticado();
    // Token emitido antes da última troca de senha (outro aparelho, por exemplo) não vale mais.
    if (conta.senhaAlteradaEm && emitidoEm < conta.senhaAlteradaEm.getTime()) {
      throw naoAutenticado('Sua senha foi trocada. Entre de novo.');
    }
    if (conta.status === 'SUSPENSA') {
      throw new ErroApp(403, 'conta_suspensa', 'Sua conta está suspensa pela coordenação.');
    }
    // LGPD: quem ainda não aceitou o termo só pode ler e aceitar o termo (e o
    // básico para o app abrir: o próprio perfil, trocar a senha provisória e sair).
    if (
      conta.termoPendente &&
      !LIBERADO_SEM_TERMO.has(`${req.method} ${req.baseUrl}${req.path}`)
    ) {
      throw new ErroApp(
        403,
        'termo_pendente',
        'Aceite o termo de uso e privacidade da sua faculdade para continuar.',
      );
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
