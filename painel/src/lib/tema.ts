'use client';

import { useSyncExternalStore } from 'react';
import { CHAVE_TEMA as CHAVE, EVENTO_TEMA as EVENTO } from './tema-script';

/** "sistema" segue o computador/celular; claro e escuro fixam o tema. */
export type Preferencia = 'sistema' | 'claro' | 'escuro';

function ler(): Preferencia {
  const p = document.documentElement.dataset.preferencia;
  return p === 'claro' || p === 'escuro' ? p : 'sistema';
}

function assinar(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributeFilter: ['data-preferencia'] });
  return () => observador.disconnect();
}

export function definirPreferencia(p: Preferencia) {
  try {
    localStorage.setItem(CHAVE, p);
  } catch {
    // sem armazenamento: vale até recarregar a página
    document.documentElement.dataset.preferencia = p;
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function usePreferencia(): Preferencia {
  return useSyncExternalStore(assinar, ler, () => 'sistema');
}
