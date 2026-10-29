import request from 'supertest';
import { criarApp } from '../../src/app';
import { criarPrisma } from '../../src/banco/prisma';
import type { EnviadorEmail } from '../../src/servicos/email';
import type { Evento, Notificador } from '../../src/servicos/notificador';
import { SENHA_DEMONSTRACAO } from '../../prisma/seed';
import { urlTeste } from './banco';

export const SEGREDO_TESTE = 'segredo-dos-testes-com-mais-de-32-caracteres';

let contador = 0;
/** E-mail que ainda não existe no banco. */
export function emailNovo(dominio = 'aluno.horizonte.edu.br'): string {
  contador++;
  return `teste.${Date.now().toString(36)}.${process.pid}.${contador}@${dominio}`;
}

export function dadosDeCadastro(email: string, codigo: string) {
  return {
    email,
    codigo,
    nome: 'Pessoa de Teste',
    apelido: 'Teste',
    senha: 'senhaForte123',
    dataNascimento: '2000-01-15',
  };
}

/** E-mail falso: guarda o último código enviado para cada endereço. */
export function caixaDeEntrada() {
  const codigos = new Map<string, string>();
  const enviador: EnviadorEmail = {
    async enviarCodigo(destino, codigo) {
      codigos.set(destino, codigo);
    },
  };
  return { enviador, codigo: (email: string) => codigos.get(email) };
}

/** App completo ligado ao banco de testes. Chame `fechar()` no afterAll. */
export function appDeTeste(limites = { geral: 10_000, credenciais: 10_000 }) {
  const prisma = criarPrisma(urlTeste());
  const caixa = caixaDeEntrada();
  const eventos: { usuarioIds: string[]; evento: Evento; dados: unknown }[] = [];
  const notificar: Notificador = {
    enviar: (usuarioIds, evento, dados) => void eventos.push({ usuarioIds, evento, dados }),
  };
  const app = criarApp({
    origensPermitidas: ['http://localhost:3000'],
    prisma,
    email: caixa.enviador,
    segredoJwt: SEGREDO_TESTE,
    notificar,
    limites,
  });

  async function entrar(email: string, senha = SENHA_DEMONSTRACAO) {
    const r = await request(app).post('/auth/login').send({ email, senha });
    if (r.status !== 200)
      throw new Error(`Login falhou (${r.status}): ${JSON.stringify(r.body)}`);
    return r.body as { acessoToken: string; refreshToken: string; usuario: { id: string } };
  }

  /** Cria uma conta nova pelo fluxo completo (código + cadastro). */
  async function cadastrarNovo(dominio = 'aluno.horizonte.edu.br', extra: object = {}) {
    const email = emailNovo(dominio);
    const pedido = await request(app).post('/auth/codigo').send({ email });
    if (pedido.status !== 202)
      throw new Error(`Código falhou: ${JSON.stringify(pedido.body)}`);
    const r = await request(app)
      .post('/auth/cadastro')
      .send({ ...dadosDeCadastro(email, caixa.codigo(email) ?? ''), ...extra });
    if (r.status !== 201) throw new Error(`Cadastro falhou: ${JSON.stringify(r.body)}`);
    return {
      email,
      ...(r.body as { acessoToken: string; refreshToken: string; usuario: { id: string } }),
    };
  }

  return {
    app,
    prisma,
    caixa,
    eventos,
    entrar,
    cadastrarNovo,
    fechar: () => prisma.$disconnect(),
  };
}
