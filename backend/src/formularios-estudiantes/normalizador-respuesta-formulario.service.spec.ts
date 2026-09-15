import { BadRequestException } from '@nestjs/common';
import { NormalizadorRespuestaFormularioService } from './normalizador-respuesta-formulario.service';
import { MapaPreguntasFormulario } from './types/mapa-preguntas-formulario.type';

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
          textAnswers: { answers: [{ value: ' carlos@estudiante.una.ac.cr ' }] },
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

    expect(() =>
      service.normalizar(sinEmail as never, mockMapa),
    ).toThrow(BadRequestException);
    expect(() =>
      service.normalizar(sinEmail as never, mockMapa),
    ).toThrow('La respuesta no contiene todos los datos obligatorios');
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
});
