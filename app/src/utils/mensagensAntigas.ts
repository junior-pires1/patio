import { useCallback, useState } from 'react';
import { useSessao } from '@/sessao';

type Pagina<M> = { mensagens: M[]; temMais: boolean };

/**
 * Mensagens anteriores às 50 mais recentes: carrega de 50 em 50 quando a
 * pessoa rola até o começo da conversa (`?antes=` da API).
 */
export function useMensagensAntigas<M extends { id: string; criadoEm: string }>(
  caminho: string,
  recentes: Pagina<M> | undefined,
) {
  const { api } = useSessao();
  const [antigas, setAntigas] = useState<M[]>([]);
  const [temMais, setTemMais] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);

  const podeCarregar = (temMais ?? recentes?.temMais ?? false) && !carregando;
  const carregar = useCallback(async () => {
    if (!podeCarregar) return;
    const maisAntiga = antigas[0] ?? recentes?.mensagens[0];
    if (!maisAntiga) return;
    setCarregando(true);
    try {
      const pagina = await api.get<Pagina<M>>(
        `${caminho}?antes=${encodeURIComponent(maisAntiga.criadoEm)}`,
      );
      setAntigas((lista) => [...pagina.mensagens, ...lista]);
      setTemMais(pagina.temMais);
    } finally {
      setCarregando(false);
    }
  }, [api, caminho, antigas, recentes, podeCarregar]);

  // Junta sem repetir (a página recente pode ter sido buscada de novo).
  const vistas = new Set(recentes?.mensagens.map((m) => m.id));
  const todas = [
    ...antigas.filter((m) => !vistas.has(m.id)),
    ...(recentes?.mensagens ?? []),
  ];
  return { todas, carregar, carregando };
}
