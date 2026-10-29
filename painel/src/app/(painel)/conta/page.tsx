'use client';

import { useState, type FormEvent } from 'react';
import { Botao, Cartao, Titulo } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { useSessao, useUsuario } from '@/lib/sessao';

/** Minha conta: trocar a senha (inclusive a provisória recebida da plataforma). */
export default function PaginaConta() {
  const { api } = useSessao();
  const usuario = useUsuario();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setCampos({});
    setOk(false);
    setEnviando(true);
    try {
      await api.trocarSenha(atual, nova);
      setAtual('');
      setNova('');
      setOk(true);
    } catch (falha) {
      setCampos(
        falha instanceof ErroApi
          ? { ...falha.campos, _: falha.message }
          : { _: 'Não foi possível trocar.' },
      );
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    'w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[var(--cor)]';
  return (
    <>
      <Titulo descricao={`${usuario.nome} · ${usuario.email}`}>Minha conta</Titulo>
      <Cartao className="max-w-md">
        <form onSubmit={enviar} className="space-y-3">
          <h2 className="font-semibold">Trocar senha</h2>
          <p className="text-sm text-slate-600">
            Recebeu uma senha provisória da equipe do Pátio? Troque por uma só sua.
          </p>
          <label className="block text-sm">
            Senha atual
            <input
              type="password"
              className={campo}
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              required
            />
            {campos.senhaAtual ? (
              <span className="text-red-600">{campos.senhaAtual}</span>
            ) : null}
          </label>
          <label className="block text-sm">
            Nova senha
            <input
              type="password"
              className={campo}
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              required
            />
            <span className="block text-xs text-slate-500">
              Pelo menos 8 caracteres, com letras e números.
            </span>
            {campos.novaSenha ? (
              <span className="text-red-600">{campos.novaSenha}</span>
            ) : null}
          </label>
          {campos._ ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{campos._}</p>
          ) : null}
          {ok ? (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
            >
              Senha trocada!
            </p>
          ) : null}
          <Botao type="submit" carregando={enviando}>
            Trocar senha
          </Botao>
        </form>
      </Cartao>
    </>
  );
}
