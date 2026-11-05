/**
 * Texto digitado na busca usado num `contains` (LIKE) do Prisma: o Prisma não
 * escapa `%` e `_`, então "%" acharia tudo. Escapa os curingas e a barra.
 */
export const semCuringas = (termo: string) => termo.replace(/[\\%_]/g, (c) => `\\${c}`);
