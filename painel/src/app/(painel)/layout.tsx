'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useSessao } from '@/lib/sessao';

const MENU = [
  { href: '/', rotulo: 'Resumo' },
  { href: '/denuncias', rotulo: 'Denúncias' },
  { href: '/alunos', rotulo: 'Alunos' },
  { href: '/publicacoes', rotulo: 'Publicações' },
  { href: '/avisos', rotulo: 'Avisos' },
  { href: '/auditoria', rotulo: 'Auditoria' },
  { href: '/conta', rotulo: 'Minha conta' },
] as const;

/** Moldura do painel: menu lateral com a cor da faculdade. Sem sessão, vai ao login. */
export default function LayoutPainel({ children }: { children: ReactNode }) {
  const { estado, sair } = useSessao();
  const router = useRouter();
  const caminho = usePathname();

  useEffect(() => {
    if (estado.tipo === 'anonimo') router.replace('/entrar');
  }, [estado, router]);

  if (estado.tipo !== 'logado') {
    return <p className="p-10 text-center text-slate-500">Carregando…</p>;
  }
  const { usuario } = estado;

  return (
    <div
      className="min-h-screen md:flex"
      style={{ '--cor': usuario.instituicao.corPrimaria } as CSSProperties}
    >
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-60 md:border-r md:border-b-0">
        <div className="p-5">
          <p className="text-2xl font-extrabold text-[var(--cor)]">Pátio</p>
          <p className="mt-1 text-sm font-semibold">{usuario.instituicao.sigla}</p>
          <p className="text-xs text-slate-500">{usuario.instituicao.nome}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {MENU.map((item) => {
            const ativo =
              item.href === '/' ? caminho === '/' : caminho.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${ativo ? 'bg-[var(--cor)] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="hidden border-t border-slate-200 p-5 md:block">
          <p className="text-sm font-medium">{usuario.nome}</p>
          <p className="truncate text-xs text-slate-500">{usuario.email}</p>
          <button
            onClick={() => void sair()}
            className="mt-3 text-sm font-semibold text-red-600 hover:underline"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
