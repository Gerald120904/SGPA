import {
  ErrorNormalizacionGoogleForms,
  extraerCodigoAsignatura,
  normalizarRespuestaGoogleForms,
} from './normalizador-google-forms';

describe('NormalizadorGoogleForms', () => {
  it('normaliza una respuesta nueva completa con campos estándar', () => {
    const payload = {
      'Número de identificación': ' 001234567 ',
      Nombres: ' Ana María ',
      'Primer apellido': ' Solís ',
      'Segundo apellido': ' Pérez ',
      'Correo estudiantil': 'ANA.SOLIS@UNA.CR',
      'Número telefónico': 88889999,
      'Período de ingreso': ' 2026-c1 ',
      'Asignaturas aprobadas': [
        'EIF200 Fundamentos de Informática',
        'MAT030 Matemática para Informática',
        'EIF201 Programación I',
      ],
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 2);

    expect(resultado).toEqual({
      fila: 2,
      cedula: '001234567',
      nombres: 'Ana María',
      apellido1: 'Solís',
      apellido2: 'Pérez',
      correoInstitucional: 'ana.solis@una.cr',
      telefono: '88889999',
      periodoIngresoCodigo: '2026-C1',
      asignaturasAprobadas: ['EIF200', 'MAT030', 'EIF201'],
    });
  });

  it('convierte el correo institucional a minúsculas y elimina espacios', () => {
    const payload = {
      cedula: '111',
      nombres: 'Carlos',
      apellido1: 'Mora',
      correoInstitucional: '  CARLOS.MORA@UNA.AC.CR  ',
      periodoIngresoCodigo: '2025-C2',
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 3);
    expect(resultado.correoInstitucional).toBe('carlos.mora@una.ac.cr');
  });

  it('trata el teléfono como string cuando viene como número o texto', () => {
    const payload = {
      cedula: '111',
      nombres: 'Carlos',
      apellido1: 'Mora',
      correoInstitucional: 'carlos@una.cr',
      telefono: 87654321,
      periodoIngresoCodigo: '2025-C2',
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 3);
    expect(resultado.telefono).toBe('87654321');
    expect(typeof resultado.telefono).toBe('string');
  });

  it('trata la cédula como string limpio', () => {
    const payload = {
      cedula: 102340567,
      nombres: 'Laura',
      apellido1: 'Vargas',
      correoInstitucional: 'laura@una.cr',
      periodoIngresoCodigo: '2025-C1',
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 4);
    expect(resultado.cedula).toBe('102340567');
    expect(typeof resultado.cedula).toBe('string');
  });

  it('extrae la lista de aprobadas correctamente de opciones compuestas y strings separados', () => {
    const payload = {
      cedula: '222',
      nombres: 'David',
      apellido1: 'Castro',
      correoInstitucional: 'david@una.cr',
      periodoIngresoCodigo: '2026-C1',
      asignaturasAprobadas:
        'EIF200 Fundamentos de Informática, MAT030 - Matemática, EIF201',
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 5);
    expect(resultado.asignaturasAprobadas).toEqual([
      'EIF200',
      'MAT030',
      'EIF201',
    ]);
  });

  it('maneja cero aprobadas devolviendo un arreglo vacío', () => {
    const payload = {
      cedula: '333',
      nombres: 'Elena',
      apellido1: 'Rojas',
      correoInstitucional: 'elena@una.cr',
      periodoIngresoCodigo: '2026-C1',
      asignaturasAprobadas: [],
    };

    const resultado = normalizarRespuestaGoogleForms(payload, 6);
    expect(resultado.asignaturasAprobadas).toEqual([]);
  });

  it('divide Nombre completo de 2, 3 o 4 palabras', () => {
    // 2 palabras
    const dosPalabras = normalizarRespuestaGoogleForms(
      {
        cedula: '1',
        'Nombre completo': 'Ana Solís',
        correo: 'ana@una.cr',
        periodo: '2026-C1',
      },
      7,
    );
    expect(dosPalabras.nombres).toBe('Ana');
    expect(dosPalabras.apellido1).toBe('Solís');
    expect(dosPalabras.apellido2).toBeNull();

    // 3 palabras
    const tresPalabras = normalizarRespuestaGoogleForms(
      {
        cedula: '2',
        'Nombre completo': 'Ana María Solís',
        correo: 'ana2@una.cr',
        periodo: '2026-C1',
      },
      8,
    );
    expect(tresPalabras.nombres).toBe('Ana');
    expect(tresPalabras.apellido1).toBe('María');
    expect(tresPalabras.apellido2).toBe('Solís');

    // 4 palabras
    const cuatroPalabras = normalizarRespuestaGoogleForms(
      {
        cedula: '3',
        'Nombre completo': 'Ana María Solís Pérez',
        correo: 'ana3@una.cr',
        periodo: '2026-C1',
      },
      9,
    );
    expect(cuatroPalabras.nombres).toBe('Ana María');
    expect(cuatroPalabras.apellido1).toBe('Solís');
    expect(cuatroPalabras.apellido2).toBe('Pérez');
  });

  it('lanza error para revisión manual cuando el nombre completo es de 5 o más palabras', () => {
    const payload = {
      cedula: '444',
      'Nombre completo': 'Juan Pablo De la Cruz Mora',
      correo: 'juan@una.cr',
      periodo: '2026-C1',
    };

    expect(() => normalizarRespuestaGoogleForms(payload, 10)).toThrow(
      ErrorNormalizacionGoogleForms,
    );
  });

  it('lanza error si falta el período de ingreso o es solo espacios', () => {
    const payloadSinPeriodo = {
      cedula: '555',
      nombres: 'Pedro',
      apellido1: 'Gómez',
      correo: 'pedro@una.cr',
    };

    expect(() => normalizarRespuestaGoogleForms(payloadSinPeriodo, 11)).toThrow(
      'El período de ingreso es obligatorio.',
    );

    const payloadPeriodoEspacios = {
      ...payloadSinPeriodo,
      'Período de ingreso': '   ',
    };
    expect(() =>
      normalizarRespuestaGoogleForms(payloadPeriodoEspacios, 12),
    ).toThrow('El código de período de ingreso no puede contener solo espacios.');
  });

  it('extraerCodigoAsignatura maneja diferentes formatos', () => {
    expect(extraerCodigoAsignatura('EIF200 Fundamentos')).toBe('EIF200');
    expect(extraerCodigoAsignatura('MAT 030')).toBe('MAT030');
    expect(extraerCodigoAsignatura('EIF-201 Programación')).toBe('EIF201');
    expect(extraerCodigoAsignatura('HUM101')).toBe('HUM101');
    expect(extraerCodigoAsignatura('')).toBeNull();
  });
});
