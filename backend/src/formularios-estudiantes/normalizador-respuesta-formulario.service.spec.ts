import { BadRequestException } from '@nestjs/common';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';
import {
  MapaPreguntasFormulario,
  MapaPreguntasFormularioV2,
} from './types/mapa-preguntas-formulario.type';

describe('NormalizadorRespuestaFormularioService', () => {
  let service: NormalizadorRespuestaFormularioService;

  const mockMapa: MapaPreguntasFormulario = {
    primerNombre: { questionId: 'q-nombre1' },
    segundoNombre: { questionId: 'q-nombre2' },
    primerApellido: { questionId: 'q-apellido1' },
    segundoApellido: { questionId: 'q-apellido2' },
    identificacion: { questionId: 'q-cedula' },
    correoEstudiantil: { questionId: 'q-email' },
    contacto: { questionId: 'q-tel' },
    periodoIngreso: {
      questionId: 'q-periodo',
      opciones: {
        '2026-C1 - I Ciclo 2026': 10,
        '2025-C2 - II Ciclo 2025': 9,
      },
    },
    asignaturasAprobadas: {
      questionId: 'q-materias',
      opciones: {
        'EIF201 - Programación I': {
          planAsignaturaId: 101,
          cursoId: 201,
          codigo: 'EIF201',
        },
        'MAT001 - Cálculo I': {
          planAsignaturaId: 102,
          cursoId: 202,
          codigo: 'MAT001',
        },
      },
    },
    optativasNoDisciplinarias: { questionId: 'q-optativas' },
  };

  beforeEach(() => {
    service = new NormalizadorRespuestaFormularioService();
  });

  it('obtiene texto por questionId y normaliza una respuesta completa', () => {
    const respuestaGoogle = {
      responseId: 'resp-1',
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: ' Carlos ' }] } },
        'q-nombre2': { textAnswers: { answers: [{ value: ' Andrés ' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: ' Perez ' }] } },
        'q-apellido2': { textAnswers: { answers: [{ value: ' Gomez ' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: ' 402220333 ' }] } },
        'q-email': {
          textAnswers: {
            answers: [{ value: ' carlos@estudiante.una.ac.cr ' }],
          },
        },
        'q-tel': { textAnswers: { answers: [{ value: ' 88887777 ' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: ' 2026-C1 - I Ciclo 2026 ' }] },
        },
        'q-materias': {
          textAnswers: {
            answers: [
              { value: ' EIF201 - Programación I ' },
              { value: ' MAT001 - Cálculo I ' },
            ],
          },
        },
        'q-optativas': { textAnswers: { answers: [{ value: '' }] } },
      },
    };

    const resultado = service.normalizar(respuestaGoogle as never, mockMapa);

    expect(resultado).toEqual({
      primerNombre: 'Carlos',
      segundoNombre: 'Andrés',
      primerApellido: 'Perez',
      segundoApellido: 'Gomez',
      identificacion: '402220333',
      correoEstudiantil: 'carlos@estudiante.una.ac.cr',
      contacto: '88887777',
      periodoIngresoId: 10,
      asignaturasAprobadas: [
        { planAsignaturaId: 101, cursoId: 201, codigo: 'EIF201' },
        { planAsignaturaId: 102, cursoId: 202, codigo: 'MAT001' },
      ],
      optativasNoDisciplinarias: null,
      requiereRevisionOptativas: false,
    });
  });

  it('combina correctamente las selecciones checkbox múltiples', () => {
    const respuestaGoogle = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
        'q-materias': {
          textAnswers: {
            answers: [
              { value: 'EIF201 - Programación I' },
              { value: 'MAT001 - Cálculo I' },
            ],
          },
        },
      },
    };

    const resultado = service.normalizar(respuestaGoogle as never, mockMapa);

    expect(resultado.asignaturasAprobadas).toHaveLength(2);
    expect(resultado.asignaturasAprobadas[0].codigo).toBe('EIF201');
    expect(resultado.asignaturasAprobadas[1].codigo).toBe('MAT001');
  });

  it('ausencia de segundo nombre es válida (devuelve null)', () => {
    const respuestaGoogle = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
      },
    };

    const resultado = service.normalizar(respuestaGoogle as never, mockMapa);

    expect(resultado.segundoNombre).toBeNull();
  });

  it('ausencia de contacto es válida (devuelve null)', () => {
    const respuestaGoogle = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
      },
    };

    const resultado = service.normalizar(respuestaGoogle as never, mockMapa);

    expect(resultado.contacto).toBeNull();
  });

  it('cero asignaturas aprobadas es completamente válido (devuelve arreglo vacío)', () => {
    const respuestaGoogle = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
      },
    };

    const resultado = service.normalizar(respuestaGoogle as never, mockMapa);

    expect(resultado.asignaturasAprobadas).toEqual([]);
  });

  it('falla con BadRequestException si falta algún campo obligatorio', () => {
    const sinEmail = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
      },
    };

    expect(() => service.normalizar(sinEmail as never, mockMapa)).toThrow(
      BadRequestException,
    );
    expect(() => service.normalizar(sinEmail as never, mockMapa)).toThrow(
      'La respuesta no contiene todos los datos obligatorios',
    );
  });

  it('falla con BadRequestException si el período seleccionado no está en el mapa de opciones', () => {
    const periodoInvalido = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '1999-C1 - Periodo Antiguo' }] },
        },
      },
    };

    expect(() =>
      service.normalizar(periodoInvalido as never, mockMapa),
    ).toThrow(BadRequestException);
    expect(() =>
      service.normalizar(periodoInvalido as never, mockMapa),
    ).toThrow(
      'El período "1999-C1 - Periodo Antiguo" no pertenece al formulario original',
    );
  });

  it('falla con BadRequestException si alguna asignatura seleccionada no está en el mapa de opciones', () => {
    const asignaturaInvalida = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
        'q-materias': {
          textAnswers: {
            answers: [{ value: 'CURSO-INEXISTENTE - Curso Raro' }],
          },
        },
      },
    };

    expect(() =>
      service.normalizar(asignaturaInvalida as never, mockMapa),
    ).toThrow(BadRequestException);
    expect(() =>
      service.normalizar(asignaturaInvalida as never, mockMapa),
    ).toThrow(
      'La asignatura "CURSO-INEXISTENTE - Curso Raro" no pertenece al formulario original',
    );
  });

  it('optativa no disciplinaria libre activa requiereRevisionOptativas=true', () => {
    const conOptativa = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
        'q-optativas': {
          textAnswers: { answers: [{ value: ' Arte y Comunicación ' }] },
        },
      },
    };

    const resultado = service.normalizar(conOptativa as never, mockMapa);

    expect(resultado.optativasNoDisciplinarias).toBe('Arte y Comunicación');
    expect(resultado.requiereRevisionOptativas).toBe(true);
  });

  it('optativa con "Ninguna", "No", "N/A" se normaliza como null y no requiere revisión', () => {
    const conNinguna = {
      answers: {
        'q-nombre1': { textAnswers: { answers: [{ value: 'Ana' }] } },
        'q-apellido1': { textAnswers: { answers: [{ value: 'Solano' }] } },
        'q-cedula': { textAnswers: { answers: [{ value: '1111' }] } },
        'q-email': { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        'q-periodo': {
          textAnswers: { answers: [{ value: '2026-C1 - I Ciclo 2026' }] },
        },
        'q-optativas': {
          textAnswers: { answers: [{ value: ' Ninguna ' }] },
        },
      },
    };

    const resultado = service.normalizar(conNinguna as never, mockMapa);

    expect(resultado.optativasNoDisciplinarias).toBeNull();
    expect(resultado.requiereRevisionOptativas).toBe(false);
  });
});

describe('NormalizadorRespuestaFormularioService V2', () => {
  const service = new NormalizadorRespuestaFormularioService();
  const mapa: MapaPreguntasFormularioV2 = {
    version: 2,
    primerNombre: { questionId: 'nombre' },
    segundoNombre: { questionId: 'nombre2' },
    primerApellido: { questionId: 'apellido' },
    segundoApellido: { questionId: 'apellido2' },
    identificacion: { questionId: 'id' },
    correoEstudiantil: { questionId: 'correo' },
    contacto: { questionId: 'contacto' },
    ingreso: {
      anio: { questionId: 'anio' },
      ciclo: { questionId: 'ciclo' },
      periodos: { '2019:1': 14, '2020:2': 15 },
    },
    asignaturasAprobadas: {
      grupos: [
        {
          nivel: 1,
          ciclo: 1,
          questionId: 'materias-1-1',
          opciones: {
            'EIF101 - Programación I': {
              planAsignaturaId: 101,
              cursoId: 201,
              codigo: 'EIF101',
            },
          },
        },
        {
          nivel: 1,
          ciclo: 2,
          questionId: 'materias-1-2',
          opciones: {
            'EIF111 - Programación II': {
              planAsignaturaId: 102,
              cursoId: 202,
              codigo: 'EIF111',
            },
          },
        },
        {
          nivel: 2,
          ciclo: 1,
          questionId: 'materias-2-1',
          opciones: {
            'EIF201 - Estructuras': {
              planAsignaturaId: 103,
              cursoId: 203,
              codigo: 'EIF201',
            },
          },
        },
      ],
    },
    optativasNoDisciplinarias: { questionId: 'optativas' },
  };

  function respuestaBase() {
    return {
      answers: {
        nombre: { textAnswers: { answers: [{ value: 'Ana' }] } },
        apellido: { textAnswers: { answers: [{ value: 'Solano' }] } },
        id: { textAnswers: { answers: [{ value: '1111' }] } },
        correo: { textAnswers: { answers: [{ value: 'ana@est.cr' }] } },
        anio: { textAnswers: { answers: [{ value: '2019' }] } },
        ciclo: { textAnswers: { answers: [{ value: 'Ciclo 1' }] } },
      },
    };
  }

  it('resuelve año y ciclo al periodoIngresoId del mapa', () => {
    expect(service.normalizar(respuestaBase() as never, mapa)).toMatchObject({
      periodoIngresoId: 14,
      segundoNombre: null,
      contacto: null,
    });
  });

  it('combina grupos en el orden del formulario', () => {
    const respuesta = respuestaBase();
    Object.assign(respuesta.answers, {
      'materias-1-1': {
        textAnswers: { answers: [{ value: 'EIF101 - Programación I' }] },
      },
      'materias-1-2': {
        textAnswers: { answers: [{ value: 'EIF111 - Programación II' }] },
      },
      'materias-2-1': {
        textAnswers: { answers: [{ value: 'EIF201 - Estructuras' }] },
      },
    });

    expect(
      service
        .normalizar(respuesta as never, mapa)
        .asignaturasAprobadas.map((item) => item.codigo),
    ).toEqual(['EIF101', 'EIF111', 'EIF201']);
  });

  it('acepta grupos sin respuesta como cero asignaturas', () => {
    expect(
      service.normalizar(respuestaBase() as never, mapa).asignaturasAprobadas,
    ).toEqual([]);
  });

  it.each([
    ['anio', 'La respuesta no contiene el año y ciclo'],
    ['ciclo', 'La respuesta no contiene el año y ciclo'],
  ])('rechaza ingreso sin %s', (campo, mensaje) => {
    const respuesta = respuestaBase();
    delete respuesta.answers[campo as 'anio' | 'ciclo'];
    expect(() => service.normalizar(respuesta as never, mapa)).toThrow(mensaje);
  });

  it('rechaza una combinación año/ciclo inexistente', () => {
    const respuesta = respuestaBase();
    respuesta.answers.ciclo.textAnswers.answers[0].value = 'Ciclo 2';
    expect(() => service.normalizar(respuesta as never, mapa)).toThrow(
      'no corresponde a un período académico válido',
    );
  });

  it('rechaza una opción de asignatura manipulada', () => {
    const respuesta = respuestaBase();
    Object.assign(respuesta.answers, {
      'materias-1-1': {
        textAnswers: { answers: [{ value: 'CURSO FALSO' }] },
      },
    });
    expect(() => service.normalizar(respuesta as never, mapa)).toThrow(
      'no pertenece al formulario original',
    );
  });

  it('normaliza Ninguna y marca optativas libres para revisión', () => {
    const ninguna = respuestaBase();
    Object.assign(ninguna.answers, {
      optativas: { textAnswers: { answers: [{ value: 'Ninguna' }] } },
    });
    expect(service.normalizar(ninguna as never, mapa)).toMatchObject({
      optativasNoDisciplinarias: null,
      requiereRevisionOptativas: false,
    });

    const libre = respuestaBase();
    Object.assign(libre.answers, {
      optativas: { textAnswers: { answers: [{ value: 'Arte' }] } },
    });
    expect(service.normalizar(libre as never, mapa)).toMatchObject({
      optativasNoDisciplinarias: 'Arte',
      requiereRevisionOptativas: true,
    });
  });

  it('deduplica defensivamente por planAsignaturaId', () => {
    const duplicado: MapaPreguntasFormularioV2 = {
      ...mapa,
      asignaturasAprobadas: {
        grupos: [
          mapa.asignaturasAprobadas.grupos[0],
          {
            ...mapa.asignaturasAprobadas.grupos[0],
            questionId: 'materias-duplicadas',
          },
        ],
      },
    };
    const respuesta = respuestaBase();
    Object.assign(respuesta.answers, {
      'materias-1-1': {
        textAnswers: { answers: [{ value: 'EIF101 - Programación I' }] },
      },
      'materias-duplicadas': {
        textAnswers: { answers: [{ value: 'EIF101 - Programación I' }] },
      },
    });
    expect(
      service.normalizar(respuesta as never, duplicado).asignaturasAprobadas,
    ).toHaveLength(1);
  });
});
