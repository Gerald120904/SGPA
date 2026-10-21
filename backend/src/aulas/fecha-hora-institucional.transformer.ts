import { ValueTransformer } from 'typeorm';

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Costa_Rica',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

type Partes = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function partesCostaRica(fecha: Date): Partes {
  const partes = Object.fromEntries(
    formatter.formatToParts(fecha).map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: partes.year,
    month: partes.month,
    day: partes.day,
    hour: partes.hour,
    minute: partes.minute,
    second: partes.second,
    millisecond: fecha.getUTCMilliseconds(),
  };
}

function milisegundosCalendario(partes: Partes): number {
  return Date.UTC(
    partes.year,
    partes.month - 1,
    partes.day,
    partes.hour,
    partes.minute,
    partes.second,
    partes.millisecond,
  );
}

function instanteCostaRica(partes: Partes): Date {
  const objetivo = milisegundosCalendario(partes);
  const normalizada = new Date(objetivo);
  if (
    normalizada.getUTCFullYear() !== partes.year ||
    normalizada.getUTCMonth() + 1 !== partes.month ||
    normalizada.getUTCDate() !== partes.day ||
    normalizada.getUTCHours() !== partes.hour ||
    normalizada.getUTCMinutes() !== partes.minute ||
    normalizada.getUTCSeconds() !== partes.second
  ) {
    throw new Error('Fecha institucional inválida.');
  }
  let instante = objetivo + 6 * 60 * 60 * 1000;
  for (let intento = 0; intento < 3; intento++) {
    instante += objetivo - milisegundosCalendario(partesCostaRica(new Date(instante)));
  }
  const resultado = new Date(instante);
  if (milisegundosCalendario(partesCostaRica(resultado)) !== objetivo) {
    throw new Error('Fecha institucional inválida en DATETIME.');
  }
  return resultado;
}

export function fechaHoraInstitucionalDesdeTextoLocal(valor: string): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(
      valor,
    );
  if (!match) throw new Error('Fecha institucional inválida.');
  return instanteCostaRica({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
    millisecond: Number((match[7] ?? '0').slice(0, 3).padEnd(3, '0')),
  });
}

// MySQL DATETIME guarda la hora de pared; el driver usa la zona local del proceso.
export const fechaHoraInstitucionalTransformer: ValueTransformer = {
  to(valor: Date | null): Date | null {
    if (valor == null) return valor;
    const partes = partesCostaRica(valor);
    return new Date(
      partes.year,
      partes.month - 1,
      partes.day,
      partes.hour,
      partes.minute,
      partes.second,
      partes.millisecond,
    );
  },
  from(valor: Date | null): Date | null {
    if (valor == null) return valor;
    return instanteCostaRica({
      year: valor.getFullYear(),
      month: valor.getMonth() + 1,
      day: valor.getDate(),
      hour: valor.getHours(),
      minute: valor.getMinutes(),
      second: valor.getSeconds(),
      millisecond: valor.getMilliseconds(),
    });
  },
};
