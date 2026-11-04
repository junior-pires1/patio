import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Mencionado, ResultadoBusca } from '@/api/tipos';
import { useSessao } from '@/sessao';

// "@ana" no fim do que está sendo digitado.
const DIGITANDO = /@([\p{L}\p{N}_]{2,30})$/u;

/**
 * Texto com @menções: ao digitar "@ana" aparecem sugestões; escolher uma
 * completa o apelido e guarda a pessoa. `mencoes` só tem quem continua no texto.
 */
export function useMencoes(inicial = '') {
  const { api } = useSessao();
  const [texto, setTexto] = useState(inicial);
  const [marcados, setMarcados] = useState<Mencionado[]>([]);
  const termo = texto.match(DIGITANDO)?.[1] ?? null;
  const busca = useQuery({
    queryKey: ['mencao', termo],
    queryFn: () =>
      api.get<ResultadoBusca>(`/busca?q=${encodeURIComponent(termo!)}&tipo=pessoas`),
    enabled: termo !== null,
    staleTime: 60_000,
  });

  function escolher(p: Mencionado) {
    setTexto((t) => t.replace(DIGITANDO, `@${p.apelido} `));
    setMarcados((m) =>
      m.some((x) => x.id === p.id) ? m : [...m, { id: p.id, apelido: p.apelido }],
    );
  }

  /** Começa uma resposta já marcando a pessoa (ex.: "@Bia "). */
  function marcar(p: Mencionado) {
    setTexto(`@${p.apelido} `);
    setMarcados([{ id: p.id, apelido: p.apelido }]);
  }

  function limpar() {
    setTexto('');
    setMarcados([]);
  }

  const mencoes = marcados.filter((m) => texto.includes(`@${m.apelido}`)).map((m) => m.id);
  const sugestoes = termo ? (busca.data?.pessoas ?? []).slice(0, 5) : [];
  return { texto, setTexto, mencoes, sugestoes, escolher, marcar, limpar };
}
