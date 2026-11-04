'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Icone, Logo, SeletorDeTema, type NomeIcone } from '@/componentes/ui';
import { useSessao } from '@/lib/sessao';

const MENU: { href: string; rotulo: string; icone: NomeIcone }[] = [
  { href: '/', rotulo: 'Resumo', icone: 'resumo' },
  { href: '/denuncias', rotulo: 'Denúncias', icone: 'denuncia' },
  { href: '/alunos', rotulo: 'Alunos', icone: 'alunos' },
  { href: '/cursos', rotulo: 'Cursos e disciplinas', icone: 'cursos' },
  { href: '/publicacoes', rotulo: 'Publicações', icone: 'publicacoes' },
  { href: '/avisos', rotulo: 'Avisos', icone: 'avisos' },
  { href: '/auditoria', rotulo: 'Auditoria', icone: 'auditoria' },
  { href: '/conta', rotulo: 'Minha conta', icone: 'conta' },
];

/** Moldura do painel: menu lateral com a identidade do Pátio. Sem sessão, vai ao login. */
export default function LayoutPainel({ children }: { children: ReactNode }) {
  const { estado, sair } = useSessao();
  const router = useRouter();
  const caminho = usePathname();

  useEffect(() => {
    if (estado.tipo === 'anonimo') router.replace('/entrar');
  }, [estado, router]);

  if (estado.tipo !== 'logado') {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <span className="size-8 animate-spin rounded-full border-[3px] border-marca/25 border-t-marca" />
      </div>
    );
  }
  const { usuario } = estado;
  const inicial = usuario.nome.trim().charAt(0).toUpperCase();

  return (
    <div
      className="min-h-screen md:flex"
      style={{ '--cor-faculdade': usuario.instituicao.corPrimaria } as CSSProperties}
    >
      <aside className="sticky top-0 z-10 border-b border-borda bg-superficie/90 backdrop-blur md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:bg-superficie">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <Logo altura={34} />
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-texto"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--cor-faculdade) 14%, transparent)',
            }}
            title={usuario.instituicao.nome}
          >
            <span className="size-2 rounded-full bg-[var(--cor-faculdade)]" />
            {usuario.instituicao.sigla}
          </span>
        </div>
        <p className="hidden px-5 pb-2 text-[11px] font-bold tracking-wider text-fraco uppercase md:block">
          Coordenação
        </p>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
          {MENU.map((item) => {
            const ativo =
              item.href === '/' ? caminho === '/' : caminho.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition ${ativo ? 'bg-marca-suave text-marca' : 'text-suave hover:bg-elevado hover:text-texto'}`}
              >
                <Icone nome={item.icone} tamanho={19} />
                {item.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="hidden space-y-4 border-t border-borda p-4 md:block">
          <SeletorDeTema compacto />
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca-suave text-sm font-extrabold text-marca">
              {inicial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{usuario.nome}</p>
              <p className="truncate text-xs text-suave">{usuario.email}</p>
            </div>
            <button
              onClick={() => void sair()}
              className="grid size-9 place-items-center rounded-lg text-suave transition hover:bg-erro-suave hover:text-erro"
              aria-label="Sair"
              title="Sair"
            >
              <Icone nome="sair" tamanho={18} />
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-6xl">{children}</div>
        <div className="mt-10 flex items-center justify-between gap-3 border-t border-borda pt-4 md:hidden">
          <SeletorDeTema compacto />
          <button onClick={() => void sair()} className="text-sm font-bold text-erro">
            Sair
          </button>
        </div>
      </main>
    </div>
  );
}
