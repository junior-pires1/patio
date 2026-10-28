import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { naoAutenticado } from '../erros';

export const DURACAO_ACESSO_SEGUNDOS = 15 * 60;
export const DURACAO_RENOVACAO_DIAS = 30;

export type Papel = 'ALUNO' | 'COORDENACAO';

/** Quem está fazendo a requisição, segundo o token de acesso. */
export type Autenticado = { id: string; instituicaoId: string; papel: Papel };

const conteudo = z.object({
  sub: z.uuid(),
  fac: z.uuid(),
  papel: z.enum(['ALUNO', 'COORDENACAO']),
});

export function assinarAcesso(usuario: Autenticado, segredo: string): string {
  return jwt.sign({ fac: usuario.instituicaoId, papel: usuario.papel }, segredo, {
    algorithm: 'HS256',
    subject: usuario.id,
    expiresIn: DURACAO_ACESSO_SEGUNDOS,
  });
}

export function verificarAcesso(token: string, segredo: string): Autenticado {
  try {
    const dados = conteudo.parse(jwt.verify(token, segredo, { algorithms: ['HS256'] }));
    return { id: dados.sub, instituicaoId: dados.fac, papel: dados.papel };
  } catch {
    throw naoAutenticado('Sessão expirada ou inválida. Faça login novamente.');
  }
}

/**
 * Token de renovação: `<id da faculdade>.<segredo aleatório>`.
 * O prefixo indica em qual faculdade procurar a sessão (o banco é isolado
 * por faculdade); só o hash SHA-256 do token inteiro fica guardado.
 */
export function gerarRenovacao(instituicaoId: string): { token: string; hash: string } {
  const token = `${instituicaoId}.${randomBytes(48).toString('base64url')}`;
  return { token, hash: hashRenovacao(token) };
}

export const hashRenovacao = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export function faculdadeDaRenovacao(token: string): string {
  const [prefixo, segredo] = token.split('.');
  if (!prefixo || !segredo || !z.uuid().safeParse(prefixo).success) {
    throw naoAutenticado('Sessão expirada ou inválida. Faça login novamente.');
  }
  return prefixo;
}

export function validadeRenovacao(agora = new Date()): Date {
  return new Date(agora.getTime() + DURACAO_RENOVACAO_DIAS * 24 * 60 * 60 * 1000);
}
