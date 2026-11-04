'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { definirPreferencia, usePreferencia, type Preferencia } from '@/lib/tema';

type Variante = 'principal' | 'contorno' | 'perigo' | 'neutro';

const VARIANTES: Record<Variante, string> = {
  principal: 'bg-marca text-sobre-marca hover:bg-marca-forte shadow-sm shadow-marca/20',
  contorno: 'bg-marca-suave text-marca hover:bg-marca/15',
  perigo: 'bg-erro-suave text-erro hover:bg-erro hover:text-white',
  neutro: 'border border-borda-forte text-texto hover:bg-elevado',
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold whitespace-nowrap transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
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
      className={`rounded-2xl border border-borda bg-superficie p-5 shadow-cartao ${className}`}
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
    <header className="mb-7">
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
        {children}
      </h1>
      {descricao ? <p className="mt-1.5 max-w-2xl text-suave">{descricao}</p> : null}
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
    neutro: 'bg-elevado text-suave',
    alerta: 'bg-alerta-suave text-alerta',
    perigo: 'bg-erro-suave text-erro',
    ok: 'bg-sucesso-suave text-sucesso',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cores[tom]}`}
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
  if (carregando)
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Carregando">
        <span className="size-7 animate-spin rounded-full border-[3px] border-marca/25 border-t-marca" />
      </div>
    );
  if (erro)
    return (
      <p className="rounded-xl bg-erro-suave p-4 text-sm font-medium text-erro">
        {erro.message}
      </p>
    );
  if (vazio)
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-marca-suave text-marca">
          <Icone nome="caixa" />
        </span>
        <p className="text-suave">{textoVazio ?? 'Nada por aqui.'}</p>
      </div>
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
      <span className="text-suave">
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

/** Logo do Pátio: letreiro escuro no tema claro e branco no escuro. */
export function Logo({ altura = 36 }: { altura?: number }) {
  const largura = Math.round(altura * (176 / 82));
  return (
    <span className="inline-block" style={{ height: altura, width: largura }}>
      <img
        src="/marca/logo-escura.png"
        alt="Pátio"
        width={largura}
        height={altura}
        className="logo-claro"
      />
      <img
        src="/marca/logo-clara.png"
        alt="Pátio"
        width={largura}
        height={altura}
        className="logo-escuro"
      />
    </span>
  );
}

const OPCOES_TEMA: { valor: Preferencia; rotulo: string; icone: NomeIcone }[] = [
  { valor: 'sistema', rotulo: 'Automático', icone: 'monitor' },
  { valor: 'claro', rotulo: 'Claro', icone: 'sol' },
  { valor: 'escuro', rotulo: 'Escuro', icone: 'lua' },
];

/** Escolha do tema (automático segue o sistema). */
export function SeletorDeTema({ compacto = false }: { compacto?: boolean }) {
  const preferencia = usePreferencia();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="flex gap-1 rounded-xl bg-elevado p-1"
    >
      {OPCOES_TEMA.map((o) => {
        const ativo = preferencia === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            aria-label={`Tema ${o.rotulo}`}
            title={o.rotulo}
            onClick={() => definirPreferencia(o.valor)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${ativo ? 'bg-superficie text-texto shadow-sm' : 'text-suave hover:text-texto'}`}
          >
            <Icone nome={o.icone} tamanho={15} />
            {compacto ? null : o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export type NomeIcone =
  | 'resumo'
  | 'denuncia'
  | 'alunos'
  | 'cursos'
  | 'publicacoes'
  | 'avisos'
  | 'auditoria'
  | 'conta'
  | 'sair'
  | 'sol'
  | 'lua'
  | 'monitor'
  | 'caixa'
  | 'predio'
  | 'mais';

// Ícones de traço (24×24), desenhados no estilo dos ícones do app.
const TRACOS: Record<NomeIcone, ReactNode> = {
  resumo: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </>
  ),
  denuncia: (
    <>
      <path d="M5 21V4h11l-1.5 4L16 12H5" />
    </>
  ),
  alunos: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2" />
    </>
  ),
  cursos: (
    <>
      <path d="M2 9l10-5 10 5-10 5-10-5z" />
      <path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </>
  ),
  publicacoes: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9h10M7 13h10M7 17h6" />
    </>
  ),
  avisos: (
    <>
      <path d="M3 10v4h3l7 4V6L6 10H3z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  auditoria: (
    <>
      <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  conta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4.3-6 8-6s7 2 8 6" />
    </>
  ),
  sair: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  lua: <path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  caixa: (
    <>
      <path d="M3 13l3-8h12l3 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </>
  ),
  predio: (
    <>
      <path d="M3 21h18M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6M9 11h.01M15 11h.01" />
    </>
  ),
  mais: <path d="M12 5v14M5 12h14" />,
};

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACOS[nome]}
    </svg>
  );
}

/**
 * Moldura das telas de entrada: no computador, painel da marca à esquerda e
 * formulário à direita; no celular, só o formulário com o logo.
 */
export function MolduraEntrada({
  rotulo,
  titulo,
  descricao,
  chamada,
  children,
}: {
  rotulo: string;
  titulo: string;
  descricao: string;
  chamada: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#0e1330] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span className="absolute -top-32 -right-24 size-[420px] rounded-full bg-[#2a44c4]/70 blur-[2px]" />
        <span className="absolute -bottom-40 -left-24 size-[360px] rounded-full bg-[#2a44c4]/35" />
        <span className="absolute top-[38%] left-[12%] h-2 w-8 -rotate-[28deg] rounded-full bg-[#f4c82e]" />
        <span className="absolute top-[42%] left-[16%] h-2 w-5 rotate-[18deg] rounded-full bg-[#f4c82e]" />
        <span className="absolute right-[18%] bottom-[30%] h-2 w-7 rotate-[24deg] rounded-full bg-[#f4c82e]" />
        <img
          src="/marca/logo-clara.png"
          alt="Pátio"
          width={150}
          height={70}
          className="relative"
        />
        <div className="relative max-w-md">
          <p className="text-[13px] font-bold tracking-widest text-[#f4c82e] uppercase">
            {rotulo}
          </p>
          <p className="mt-3 text-[40px] leading-[1.1] font-extrabold tracking-tight">
            {chamada}
          </p>
        </div>
        <p className="relative text-sm text-white/60">
          Pátio · rede acadêmica das faculdades parceiras
        </p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center justify-between">
            <span className="lg:invisible">
              <Logo altura={38} />
            </span>
            <SeletorDeTema compacto />
          </div>
          <p className="text-xs font-bold tracking-widest text-marca uppercase lg:hidden">
            {rotulo}
          </p>
          <h1 className="mt-1 text-[30px] leading-tight font-extrabold tracking-tight">
            {titulo}
          </h1>
          <p className="mt-2 text-suave">{descricao}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
