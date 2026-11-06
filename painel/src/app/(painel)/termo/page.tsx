'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Botao, Cartao, Estado, Selo, Titulo } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { useSessao } from '@/lib/sessao';
import { dataHora } from '@/lib/textos';

type Termo = {
  versao: number;
  texto: string;
  publicadoEm: string | null;
  padrao: boolean;
  faculdade: { nome: string; sigla: string };
};
type Dados = {
  atual: Termo;
  versoes: { versao: number; publicadoEm: string; autor: { apelido: string } | null }[];
  aceitaram: number;
  alunos: number;
};

/** Termo de uso e privacidade (LGPD) da faculdade: texto atual, edição e versões. */
export default function PaginaTermo() {
  const { api } = useSessao();
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [vendo, setVendo] = useState<{ versao: number; texto: string } | null>(null);

  const termo = useQuery({
    queryKey: ['termo'],
    queryFn: () => api.get<Dados>('/coordenacao/termo'),
  });
  const publicar = useMutation({
    mutationFn: (texto: string) =>
      api.post<{ versao: number }>('/coordenacao/termo', { texto }),
    onSuccess: () => {
      setRascunho(null);
      setCampos({});
      void queryClient.invalidateQueries({ queryKey: ['termo'] });
    },
    onError: (e) =>
      setCampos(e instanceof ErroApi ? { _: e.message, ...e.campos } : { _: e.message }),
  });
  const abrirVersao = useMutation({
    mutationFn: (versao: number) =>
      api.get<{ versao: number; texto: string }>(`/coordenacao/termo/${versao}`),
    onSuccess: setVendo,
  });

  if (!termo.data) {
    return (
      <>
        <Titulo>Termo LGPD</Titulo>
        <Estado carregando={termo.isPending} erro={termo.error} />
      </>
    );
  }
  const { atual, versoes, aceitaram, alunos } = termo.data;
  const texto = rascunho ?? atual.texto;
  const mudou = rascunho !== null && rascunho.trim() !== atual.texto.trim();

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (
      confirm(
        `Publicar a versão ${atual.versao + 1} do termo? Ela passa a valer para os próximos cadastros; as versões anteriores ficam guardadas.`,
      )
    )
      publicar.mutate(texto);
  }

  return (
    <>
      <Titulo descricao="Os alunos precisam marcar o aceite deste termo para criar a conta no aplicativo. Ao publicar um texto novo, ele vira uma nova versão e vale para os próximos cadastros.">
        Termo de uso e privacidade (LGPD)
      </Titulo>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Cartao>
          <form onSubmit={enviar} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Versão {atual.versao}</h2>
              {atual.padrao ? <Selo>Modelo padrão do Pátio</Selo> : null}
              {atual.publicadoEm ? (
                <span className="text-sm text-suave">
                  publicada em {dataHora(atual.publicadoEm)}
                </span>
              ) : null}
            </div>
            {atual.padrao ? (
              <p className="rounded-lg bg-destaque-suave p-3 text-sm text-texto">
                Este é um modelo de referência. Revise com o jurídico ou o encarregado de
                dados (DPO) da faculdade e inclua o contato oficial antes de usar.
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-texto">
                Texto do termo
              </span>
              <textarea
                value={texto}
                maxLength={20000}
                rows={22}
                onChange={(e) => setRascunho(e.target.value)}
                className="campo text-sm leading-relaxed"
              />
              <span className="text-xs text-suave">
                {texto.length.toLocaleString('pt-BR')}/20.000
              </span>
              {campos.texto ? (
                <span className="block text-sm text-erro">{campos.texto}</span>
              ) : null}
            </label>
            {campos._ && !campos.texto ? (
              <p className="text-sm text-erro">{campos._}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Botao type="submit" carregando={publicar.isPending} disabled={!mudou}>
                Publicar versão {atual.versao + 1}
              </Botao>
              {rascunho !== null ? (
                <Botao type="button" variante="neutro" onClick={() => setRascunho(null)}>
                  Descartar alterações
                </Botao>
              ) : null}
            </div>
          </form>
        </Cartao>

        <div className="space-y-4">
          <Cartao>
            <h2 className="font-semibold">Aceites da versão atual</h2>
            <p className="mt-2 text-3xl font-extrabold">
              {aceitaram}
              <span className="text-base font-medium text-suave"> de {alunos} alunos</span>
            </p>
            <p className="mt-1 text-sm text-suave">
              Contas antigas (anteriores ao termo) não precisam aceitar. Alunos cadastrados
              pelo painel aceitam no primeiro acesso.
            </p>
          </Cartao>
          <Cartao>
            <h2 className="mb-2 font-semibold">Versões</h2>
            <ul className="divide-y divide-borda">
              {versoes.map((v) => (
                <li key={v.versao} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">Versão {v.versao}</p>
                    <p className="text-sm text-suave">
                      {dataHora(v.publicadoEm)}
                      {v.autor ? ` · ${v.autor.apelido}` : ''}
                    </p>
                  </div>
                  <Botao variante="neutro" onClick={() => abrirVersao.mutate(v.versao)}>
                    Ver texto
                  </Botao>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-medium">Versão 1</p>
                  <p className="text-sm text-suave">Modelo padrão do Pátio</p>
                </div>
                <Botao variante="neutro" onClick={() => abrirVersao.mutate(1)}>
                  Ver texto
                </Botao>
              </li>
            </ul>
          </Cartao>
          {vendo ? (
            <Cartao>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">Texto da versão {vendo.versao}</h2>
                <Botao variante="neutro" onClick={() => setVendo(null)}>
                  Fechar
                </Botao>
              </div>
              <p className="max-h-96 overflow-auto text-sm whitespace-pre-line text-texto">
                {vendo.texto}
              </p>
            </Cartao>
          ) : null}
        </div>
      </div>
    </>
  );
}
