import type { Reacao } from '@/api/tipos';
import type { Cores } from '@/tema';
import type { NomeIcone } from '../Info';

/** Reações do chat como ícones (sem emojis), na ordem do menu. */
export const REACOES: {
  valor: Reacao;
  rotulo: string;
  icone: NomeIcone;
  cor: (c: Cores) => string;
}[] = [
  { valor: 'AMEI', rotulo: 'Amei', icone: 'heart', cor: (c) => c.erro },
  { valor: 'JOINHA', rotulo: 'Joinha', icone: 'thumbs-up', cor: (c) => c.marca },
  { valor: 'RISADA', rotulo: 'Risada', icone: 'happy', cor: (c) => c.destaque },
  { valor: 'UAU', rotulo: 'Uau', icone: 'sparkles', cor: (c) => c.marca },
  { valor: 'TRISTE', rotulo: 'Triste', icone: 'sad', cor: (c) => c.textoSuave },
  { valor: 'FOGO', rotulo: 'Fogo', icone: 'flame', cor: () => '#F97316' },
];
export const reacaoDe = (v: Reacao) => REACOES.find((r) => r.valor === v)!;
