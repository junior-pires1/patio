import bcrypt from 'bcryptjs';

// Custo 12 em produção (cerca de 250 ms por hash). Nos testes o custo mínimo
// deixa a suíte rápida e estável em máquinas lentas, como as do GitHub Actions.
const CUSTO = process.env.NODE_ENV === 'test' ? 4 : 12;
// Hash usado quando o e-mail não existe, para o login levar o mesmo tempo
// e não revelar quais contas existem.
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', CUSTO);

export const gerarHash = (texto: string) => bcrypt.hash(texto, CUSTO);

export async function conferir(
  texto: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const ok = await bcrypt.compare(texto, hash ?? HASH_FALSO);
  return ok && hash !== null && hash !== undefined;
}
