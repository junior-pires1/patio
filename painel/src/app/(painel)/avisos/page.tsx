'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Botao, Cartao, Estado, Selo, Titulo } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { useSessao } from '@/lib/sessao';
import { dataHora } from '@/lib/textos';
import type { Aviso } from '@/lib/tipos';

export default function PaginaAvisos() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [fixado, setFixado] = useState(true);
  const [campos, setCampos] = useState<Record<string, string>>({});

  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<Aviso[]>('/avisos'),
  });
  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ['avisos'] });

  const publicar = useMutation({
    mutationFn: () => api.post<Aviso>('/coordenacao/avisos', { titulo, texto, fixado }),
    onSuccess: () => {
      setTitulo('');
      setTexto('');
      setCampos({});
      atualizar();
    },
    onError: (e) => setCampos(e instanceof ErroApi ? e.campos : { _: e.message }),
  });
  const remover = useMutation({
    mutationFn: (id: string) => api.delete(`/coordenacao/avisos/${id}`),
    onSuccess: atualizar,
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    publicar.mutate();
  }

  return (
    <>
      <Titulo descricao="Os avisos aparecem no topo do aplicativo para todos os alunos da faculdade.">
        Avisos oficiais
      </Titulo>
      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Cartao>
          <form onSubmit={enviar} className="space-y-3">
            <h2 className="font-semibold">Novo aviso</h2>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Título</span>
              <input
                value={titulo}
                maxLength={80}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)]"
              />
              {campos.titulo ? (
                <span className="text-sm text-red-600">{campos.titulo}</span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Texto</span>
              <textarea
                value={texto}
                maxLength={500}
                rows={5}
                onChange={(e) => setTexto(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)]"
              />
              <span className="text-xs text-slate-500">{texto.length}/500</span>
              {campos.texto ? (
                <span className="block text-sm text-red-600">{campos.texto}</span>
              ) : null}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fixado}
                onChange={(e) => setFixado(e.target.checked)}
              />
              Fixar no topo do aplicativo
            </label>
            {campos._ ? <p className="text-sm text-red-600">{campos._}</p> : null}
            <Botao type="submit" carregando={publicar.isPending}>
              Publicar aviso
            </Botao>
          </form>
        </Cartao>

        <div className="space-y-3">
          <Estado
            carregando={avisos.isPending}
            erro={avisos.error}
            vazio={avisos.data?.length === 0}
            textoVazio="Nenhum aviso publicado."
          />
          {avisos.data?.map((a) => (
            <Cartao key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{a.titulo}</h3>
                    {a.fixado ? <Selo>Fixado</Selo> : null}
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
                    {a.texto}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {a.autor.nome} · {dataHora(a.criadoEm)}
                  </p>
                </div>
                <Botao
                  variante="neutro"
                  disabled={remover.isPending}
                  onClick={() => confirm('Remover este aviso?') && remover.mutate(a.id)}
                >
                  Remover
                </Botao>
              </div>
            </Cartao>
          ))}
        </div>
      </div>
    </>
  );
}
