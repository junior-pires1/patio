'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'principal' | 'contorno' | 'perigo' | 'neutro';

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-[var(--cor)] text-white hover:opacity-90',
  contorno: 'border border-[var(--cor)] text-[var(--cor)] hover:bg-[var(--cor)]/10',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  neutro: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
};

export function Botao({
  variante = 'principal',
  carregando,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  carregando?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Cartao({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Titulo({
  children,
  descricao,
}: {
  children: ReactNode;
  descricao?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold">{children}</h1>
      {descricao ? <p className="mt-1 text-slate-600">{descricao}</p> : null}
    </header>
  );
}

export function Selo({
  children,
  tom = 'neutro',
}: {
  children: ReactNode;
  tom?: 'neutro' | 'alerta' | 'perigo' | 'ok';
}) {
  const cores = {
    neutro: 'bg-slate-100 text-slate-700',
    alerta: 'bg-amber-100 text-amber-800',
    perigo: 'bg-red-100 text-red-700',
    ok: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cores[tom]}`}
    >
      {children}
    </span>
  );
}

export function Estado({
  carregando,
  erro,
  vazio,
  textoVazio,
}: {
  carregando?: boolean;
  erro?: Error | null;
  vazio?: boolean;
  textoVazio?: string;
}) {
  if (carregando) return <p className="py-10 text-center text-slate-500">Carregando…</p>;
  if (erro) return <p className="rounded-lg bg-red-50 p-4 text-red-700">{erro.message}</p>;
  if (vazio)
    return (
      <p className="py-10 text-center text-slate-500">{textoVazio ?? 'Nada por aqui.'}</p>
    );
  return null;
}

export function Paginacao({
  pagina,
  total,
  porPagina,
  mudar,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  mudar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas === 1) return null;
  return (
    <nav
      className="mt-4 flex items-center justify-end gap-2 text-sm"
      aria-label="Paginação"
    >
      <Botao variante="neutro" disabled={pagina <= 1} onClick={() => mudar(pagina - 1)}>
        Anterior
      </Botao>
      <span className="text-slate-600">
        Página {pagina} de {paginas}
      </span>
      <Botao
        variante="neutro"
        disabled={pagina >= paginas}
        onClick={() => mudar(pagina + 1)}
      >
        Próxima
      </Botao>
    </nav>
  );
}
