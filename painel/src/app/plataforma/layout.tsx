import type { ReactNode } from 'react';
import { ProvedorPlataforma } from '@/lib/plataforma';

export const metadata = { title: 'Pátio · Plataforma' };

export default function LayoutPlataforma({ children }: { children: ReactNode }) {
  return <ProvedorPlataforma>{children}</ProvedorPlataforma>;
}
