'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Botao, MolduraEntrada } from '@/componentes/ui';
import { ErroApi } from '@/lib/cliente';
import { usePlataforma } from '@/lib/plataforma';

export default function EntrarPlataforma() {
  const { estado, entrar } = usePlataforma();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (estado.tipo === 'logado') router.replace('/plataforma');
  }, [estado, router]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MolduraEntrada
      rotulo="Plataforma"
      chamada="Faculdades parceiras e métricas gerais do Pátio."
      titulo="Área da equipe"
      descricao="Acesso restrito à equipe do Pátio."
    >
      <form onSubmit={enviar} className="space-y-5">
        <label className="block">
          <span className="rotulo">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="campo"
          />
        </label>
        <label className="block">
          <span className="rotulo">Senha</span>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="campo"
          />
        </label>
        {erro ? (
          <p
            role="alert"
            className="rounded-xl bg-erro-suave p-3 text-sm font-medium text-erro"
          >
            {erro}
          </p>
        ) : null}
        <Botao type="submit" carregando={enviando} className="w-full py-3">
          Entrar
        </Botao>
      </form>
    </MolduraEntrada>
  );
}
