import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Provedores } from '@/lib/sessao';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pátio · Painel da coordenação',
  description: 'Moderação, avisos e indicadores da sua faculdade no Pátio.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
