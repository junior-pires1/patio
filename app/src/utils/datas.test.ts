import {
  dataBrParaIso,
  dataDoEvento,
  dataHoraBrParaIso,
  mascaraData,
  mascaraHora,
  quando,
} from './datas';

describe('datas', () => {
  test('converte data brasileira válida e recusa inválida', () => {
    expect(dataBrParaIso('15/01/2000')).toBe('2000-01-15');
    expect(dataBrParaIso(' 29/02/2004 ')).toBe('2004-02-29');
    expect(dataBrParaIso('29/02/2003')).toBeNull();
    expect(dataBrParaIso('31/04/2000')).toBeNull();
    expect(dataBrParaIso('2000-01-15')).toBeNull();
  });

  test('máscara coloca as barras enquanto digita', () => {
    expect(mascaraData('15')).toBe('15');
    expect(mascaraData('1501')).toBe('15/01');
    expect(mascaraData('15012000999')).toBe('15/01/2000');
    expect(mascaraData('15/a01')).toBe('15/01');
  });

  test('quando mostra tempo relativo curto', () => {
    const agora = new Date(2026, 9, 29, 15, 0, 0);
    const ha = (ms: number) => new Date(agora.getTime() - ms).toISOString();
    expect(quando(ha(10_000), agora)).toBe('agora');
    expect(quando(ha(5 * 60_000), agora)).toBe('5 min');
    expect(quando(new Date(2026, 9, 29, 9, 7).toISOString(), agora)).toBe('09:07');
    expect(quando(new Date(2026, 9, 28, 22, 0).toISOString(), agora)).toBe('ontem');
    expect(quando(new Date(2026, 9, 12, 8, 0).toISOString(), agora)).toBe('12/10');
  });

  test('data e hora de evento', () => {
    const iso = dataHoraBrParaIso('10/11/2026', '19:30');
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect([d.getDate(), d.getMonth(), d.getHours(), d.getMinutes()]).toEqual([
      10, 10, 19, 30,
    ]);
    expect(dataHoraBrParaIso('10/11/2026', '25:00')).toBeNull();
    expect(dataHoraBrParaIso('31/02/2026', '10:00')).toBeNull();
    expect(mascaraHora('1930')).toBe('19:30');
    expect(mascaraHora('9')).toBe('9');
    expect(dataDoEvento(new Date(2026, 10, 10, 19, 5).toISOString())).toBe(
      'ter, 10/11 às 19:05',
    );
  });
});
