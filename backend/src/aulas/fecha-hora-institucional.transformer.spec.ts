import {
  fechaHoraInstitucionalDesdeTextoLocal,
  fechaHoraInstitucionalTransformer,
} from './fecha-hora-institucional.transformer';

describe('fechas DATETIME institucionales de Aulas', () => {
  const zonaOriginal = process.env.TZ;

  afterAll(() => {
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  it.each(['America/Costa_Rica', 'UTC'])(
    'conserva la hora local al escribir y leer en %s',
    (zona) => {
      process.env.TZ = zona;
      const instante = new Date('2099-12-20T08:00:00-06:00');
      const valorDriver = fechaHoraInstitucionalTransformer.to(instante) as Date;
      expect(valorDriver.getHours()).toBe(8);
      expect(valorDriver.getDate()).toBe(20);

      const historica = new Date(2099, 11, 20, 8, 0, 0);
      const leida = fechaHoraInstitucionalTransformer.from(historica) as Date;
      expect(leida.toISOString()).toBe('2099-12-20T14:00:00.000Z');
      expect(
        fechaHoraInstitucionalDesdeTextoLocal('2099-12-20T08:00:00')
          .toISOString(),
      ).toBe('2099-12-20T14:00:00.000Z');
    },
  );

  it('mantiene el cambio de día en una hora cercana a medianoche', () => {
    process.env.TZ = 'UTC';
    expect(
      fechaHoraInstitucionalDesdeTextoLocal('2099-12-24T23:30:00')
        .toISOString(),
    ).toBe('2099-12-25T05:30:00.000Z');
  });
});
