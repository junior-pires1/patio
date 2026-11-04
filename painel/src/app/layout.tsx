import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provedores } from '@/lib/sessao';
import { SCRIPT_TEMA } from '@/lib/tema-script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pátio · Painel da coordenação',
  description: 'Moderação, avisos e indicadores da sua faculdade no Pátio.',
  icons: { icon: '/marca/icone.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Tema antes da primeira pintura (sem piscar branco no modo escuro). */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
