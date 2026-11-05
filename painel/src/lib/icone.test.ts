import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { metadata } from '../app/layout';

const ASSINATURA_PNG = '89504e470d0a1a0a';

/** Lê largura e altura do cabeçalho do PNG. */
function lerPng(caminho: string) {
  const arquivo = readFileSync(resolve(process.cwd(), caminho));
  return {
    assinatura: arquivo.subarray(0, 8).toString('hex'),
    largura: arquivo.readUInt32BE(16),
    altura: arquivo.readUInt32BE(20),
  };
}

describe('ícone das páginas', () => {
  it('os painéis da coordenação e da plataforma apontam para o ícone', () => {
    expect(metadata.icons).toEqual({ icon: '/marca/icone.png' });
    expect(lerPng('public/marca/icone.png')).toEqual({
      assinatura: ASSINATURA_PNG,
      largura: 96,
      altura: 96,
    });
  });

  it('o site principal tem o ícone no tamanho de aba', () => {
    expect(lerPng('../app/assets/favicon.png')).toEqual({
      assinatura: ASSINATURA_PNG,
      largura: 48,
      altura: 48,
    });
  });
});
