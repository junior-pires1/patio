/** "15/01/2000" → "2000-01-15". Devolve null se a data não existir. */
export function dataBrParaIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  const valida =
    data.getUTCFullYear() === Number(ano) &&
    data.getUTCMonth() === Number(mes) - 1 &&
    data.getUTCDate() === Number(dia);
  return valida ? `${ano}-${mes}-${dia}` : null;
}

/** Coloca as barras enquanto a pessoa digita: "15012000" → "15/01/2000". */
export function mascaraData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** Horário curto para listas e mensagens: "agora", "5 min", "14:32", "ontem", "12/10". */
export function quando(iso: string, agora = new Date()): string {
  const data = new Date(iso);
  const segundos = Math.floor((agora.getTime() - data.getTime()) / 1000);
  if (segundos < 60) return 'agora';
  if (segundos < 3600) return `${Math.floor(segundos / 60)} min`;

  const inicioDoDia = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(data)) / 86_400_000);
  if (dias === 0)
    return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
  if (dias === 1) return 'ontem';
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}`;
}

/** "10/11/2026" + "19:00" → instante no fuso do aparelho (ISO). Null se inválido. */
export function dataHoraBrParaIso(data: string, hora: string): string | null {
  const dia = dataBrParaIso(data);
  const h = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hora.trim());
  if (!dia || !h) return null;
  const [ano, mes, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(ano, mes - 1, d, Number(h[1]), Number(h[2])).toISOString();
}

/** Coloca os dois-pontos enquanto digita: "1930" → "19:30". */
export function mascaraHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Data do evento: "ter, 10/11 às 19:00". */
export function dataDoEvento(iso: string): string {
  const d = new Date(iso);
  return `${DIAS_DA_SEMANA[d.getDay()]}, ${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)} às ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
}
