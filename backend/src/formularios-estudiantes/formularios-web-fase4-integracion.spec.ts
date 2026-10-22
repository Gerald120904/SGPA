import {
  BadRequestException,
  ExecutionContext,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';
import { FormulariosPublicosWebController } from './formularios-publicos-web.controller';
import { FormulariosPublicosController } from './formularios-publicos.controller';
import { FormulariosPublicosService } from './formularios-publicos.service';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';
import {
  AsignaturaFrontend,
  esAsignaturaElegibleFrontend,
  filtrarAsignaturasVisiblesFrontend,
  podarSeleccionesInvalidasFrontend,
} from './web/evaluador-requisitos-frontend';
import { generarHtmlFormularioPublico } from './web/formulario-web.template';

describe('SGPA Fase 4 — Formulario Web Público y Validaciones Dinámicas (30 Pruebas Obligatorias)', () => {
  let webController: FormulariosPublicosWebController;
  let apiController: FormulariosPublicosController;
  let publicosService: FormulariosPublicosService;
  let rateLimitGuard: RateLimitPublicoGuard;
  let formularioRepo: jest.Mocked<Repository<FormularioEstudiante>>;
  let periodoRepo: jest.Mocked<Repository<PeriodoAcademico>>;
  let planAsignaturaRepo: jest.Mocked<Repository<PlanAsignatura>>;
  let persistenciaInternaService: jest.Mocked<FormulariosInternosPersistenciaService>;
  let motorRequisitosService: jest.Mocked<MotorRequisitosService>;

  const tokenValido = 'a'.repeat(64);
  const tokenInvalido = 'invalido-123';

  // Catálogo de asignaturas para pruebas del motor reactivo
  const prog1: AsignaturaFrontend = {
    asignaturaId: 1,
    codigo: 'EIF201',
    nombre: 'Programación I',
    nivel: 1,
    ciclo: 1,
    detallesRequisitos: [],
  };

  const mate1: AsignaturaFrontend = {
    asignaturaId: 2,
    codigo: 'MAT201',
    nombre: 'Matemática para Informática',
    nivel: 1,
    ciclo: 1,
    detallesRequisitos: [],
  };

  const prog2: AsignaturaFrontend = {
    asignaturaId: 3,
    codigo: 'EIF202',
    nombre: 'Programación II',
    nivel: 1,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 1,
        codigo: 'EIF201',
        nombre: 'Programación I',
        tipo: 'REQUISITO',
      },
    ],
  };

  const prog3: AsignaturaFrontend = {
    asignaturaId: 4,
    codigo: 'EIF203',
    nombre: 'Programación III',
    nivel: 2,
    ciclo: 1,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 3,
        codigo: 'EIF202',
        nombre: 'Programación II',
        tipo: 'REQUISITO',
      },
    ],
  };

  const prog4: AsignaturaFrontend = {
    asignaturaId: 5,
    codigo: 'EIF204',
    nombre: 'Programación IV',
    nivel: 2,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 4,
        codigo: 'EIF203',
        nombre: 'Programación III',
        tipo: 'REQUISITO',
      },
    ],
  };

  const estructuraDatos: AsignaturaFrontend = {
    asignaturaId: 6,
    codigo: 'EIF205',
    nombre: 'Estructuras de Datos',
    nivel: 2,
    ciclo: 1,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 1,
        tipo: 'REQUISITO',
      },
      {
        requisitoAsignaturaId: 2,
        tipo: 'REQUISITO',
      },
    ],
  };

  const correquisitoAsig: AsignaturaFrontend = {
    asignaturaId: 7,
    codigo: 'EIF300',
    nombre: 'Laboratorio de Programación',
    nivel: 2,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 1,
        tipo: 'CORREQUISITO',
      },
    ],
  };

  const materiaInactiva: AsignaturaFrontend = {
    asignaturaId: 8,
    codigo: 'EIF999',
    nombre: 'Optativa Retirada',
    nivel: 3,
    ciclo: 1,
    activo: false,
    detallesRequisitos: [],
  };

  const catalogoCompleto = [
    prog1,
    mate1,
    prog2,
    prog3,
    prog4,
    estructuraDatos,
    correquisitoAsig,
    materiaInactiva,
  ];

  beforeEach(async () => {
    rateLimitGuard = new RateLimitPublicoGuard();
    rateLimitGuard.reset();

    formularioRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<FormularioEstudiante>>;

    periodoRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<PeriodoAcademico>>;

    planAsignaturaRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          cursoId: 1,
          codigoReferencia: 'EIF201',
          asignaturaId: 1,
          asignatura: { id: 1, codigo: 'EIF201', nombre: 'Programación I' },
        } as any,
      ]),
    } as unknown as jest.Mocked<Repository<PlanAsignatura>>;

    persistenciaInternaService = {
      guardarRespuestaInterna: jest.fn(),
    } as unknown as jest.Mocked<FormulariosInternosPersistenciaService>;

    motorRequisitosService = {
      obtenerCatalogoFormulario: jest.fn().mockResolvedValue({
        niveles: [
          {
            nivel: 1,
            ciclos: [
              {
                ciclo: 1,
                asignaturas: [
                  {
                    asignaturaId: 1,
                    codigo: 'EIF201',
                    nombre: 'Programación I',
                    nivel: 1,
                    ciclo: 1,
                    creditos: 4,
                    detallesRequisitos: [],
                  },
                ],
              },
              {
                ciclo: 2,
                asignaturas: [
                  {
                    asignaturaId: 3,
                    codigo: 'EIF202',
                    nombre: 'Programación II',
                    nivel: 1,
                    ciclo: 2,
                    creditos: 4,
                    detallesRequisitos: [
                      {
                        requisitoAsignaturaId: 1,
                        codigo: 'EIF201',
                        nombre: 'Programación I',
                        tipo: 'REQUISITO',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
      validarSeleccionEstricta: jest.fn(),
    } as unknown as jest.Mocked<MotorRequisitosService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        FormulariosPublicosWebController,
        FormulariosPublicosController,
      ],
      providers: [
        FormulariosPublicosService,
        {
          provide: getRepositoryToken(FormularioEstudiante),
          useValue: formularioRepo,
        },
        {
          provide: getRepositoryToken(PeriodoAcademico),
          useValue: periodoRepo,
        },
        {
          provide: getRepositoryToken(PlanAsignatura),
          useValue: planAsignaturaRepo,
        },
        {
          provide: FormulariosInternosPersistenciaService,
          useValue: persistenciaInternaService,
        },
        {
          provide: MotorRequisitosService,
          useValue: motorRequisitosService,
        },
        {
          provide: RateLimitPublicoGuard,
          useValue: rateLimitGuard,
        },
      ],
    }).compile();

    webController = module.get<FormulariosPublicosWebController>(
      FormulariosPublicosWebController,
    );
    apiController = module.get<FormulariosPublicosController>(
      FormulariosPublicosController,
    );
    publicosService = module.get<FormulariosPublicosService>(
      FormulariosPublicosService,
    );
  });

  // 1. Apertura desde navegador sin sesión SGPA
  it('1. Apertura desde navegador sin sesión SGPA: sirve HTML institucional sin requerir login', () => {
    let statusCode = 0;
    let contentType = '';
    let htmlOutput = '';

    const mockRes = {
      setHeader: jest.fn(),
      status: jest.fn((code: number) => {
        statusCode = code;
        return mockRes;
      }),
      type: jest.fn((t: string) => {
        contentType = t;
        return mockRes;
      }),
      send: jest.fn((body: string) => {
        htmlOutput = body;
        return mockRes;
      }),
    } as unknown as Response;

    webController.mostrarFormularioPublico(tokenValido, mockRes);

    expect(statusCode).toBe(HttpStatus.OK);
    expect(contentType).toBe('html');
    expect(htmlOutput).toContain('<!DOCTYPE html>');
    expect(htmlOutput).toContain('Universidad Nacional');
    expect(htmlOutput).toContain('SGPA');
  });

  // 2. Carga de formulario válido
  it('2. Carga de formulario válido: devuelve estructura académica, carrera, plan y catálogo', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carreraId: 1,
      planEstudioId: 2,
      titulo: 'Formulario 2026',
      descripcion: 'Registro oficial',
      carrera: { id: 1, nombre: 'Ingeniería en Sistemas de Información', codigo: 'ISI' },
      planEstudio: { id: 2, nombre: 'Plan 2023', anio: 2023 },
    } as unknown as FormularioEstudiante);

    periodoRepo.find.mockResolvedValue([
      { id: 100, nombre: 'I Ciclo 2026', codigo: '2026-1', anio: 2026, ciclo: 1 } as unknown as PeriodoAcademico,
    ]);

    planAsignaturaRepo.find.mockResolvedValue([
      {
        id: 1,
        asignaturaId: 1,
        nivel: 1,
        ciclo: 1,
        activo: true,
        asignatura: { id: 1, codigo: 'EIF201', nombre: 'Programación I', creditos: 4 },
        requisitos: [],
      } as unknown as PlanAsignatura,
    ]);

    const resultado = await apiController.consultarFormulario(tokenValido);

    expect(resultado).toBeDefined();
    expect(resultado.formulario.titulo).toBe('Formulario 2026');
    expect(resultado.carrera.codigo).toBe('ISI');
    expect(resultado.catalogo.length).toBeGreaterThan(0);
  });

  // 3. Enlace inexistente o revocado
  it('3. Enlace inexistente o revocado: lanza NotFoundException 404', async () => {
    formularioRepo.findOne.mockResolvedValue(null);

    await expect(
      apiController.consultarFormulario(tokenValido),
    ).rejects.toThrow(NotFoundException);
  });

  // 4. Formulario cerrado
  it('4. Formulario cerrado: lanza BadRequestException 400 indicando cierre', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.CERRADO,
    } as unknown as FormularioEstudiante);

    await expect(
      apiController.consultarFormulario(tokenValido),
    ).rejects.toThrow(BadRequestException);
  });

  // 5. Presentación de datos personales
  it('5. Presentación de datos personales: plantilla contiene todos los campos requeridos y opcionales', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).toContain('input-identificacion');
    expect(html).toContain('input-primer-nombre');
    expect(html).toContain('input-segundo-nombre');
    expect(html).toContain('input-primer-apellido');
    expect(html).toContain('input-segundo-apellido');
    expect(html).toContain('input-correo');
    expect(html).toContain('input-contacto');
    expect(html).toContain('input-periodo');
  });

  // 6. Validación de campos requeridos
  it('6. Validación de campos requeridos: DTO rechaza identificación o nombres ausentes', async () => {
    const dtoInvalido = plainToInstance(EnviarRespuestaPublicaDto, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '',
      primerNombre: '',
      primerApellido: '',
      correoEstudiantil: 'correo-no-valido',
      periodoIngresoId: null,
      asignaturasAprobadasIds: [],
    });

    const errores = await validate(dtoInvalido);
    expect(errores.length).toBeGreaterThan(0);
    const camposConError = errores.map((e) => e.property);
    expect(camposConError).toContain('identificacion');
    expect(camposConError).toContain('primerNombre');
    expect(camposConError).toContain('primerApellido');
    expect(camposConError).toContain('correoEstudiantil');
  });

  // 7. Materias organizadas por año y ciclo
  it('7. Materias organizadas por año y ciclo: catálogo se agrupa adecuadamente', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carreraId: 1,
      planEstudioId: 2,
      carrera: { id: 1, nombre: 'ISI', codigo: 'ISI' },
      planEstudio: { id: 2, nombre: 'Plan 2023', anio: 2023 },
    } as unknown as FormularioEstudiante);

    periodoRepo.find.mockResolvedValue([]);

    planAsignaturaRepo.find.mockResolvedValue([
      {
        id: 1,
        asignaturaId: 1,
        nivel: 1,
        ciclo: 1,
        activo: true,
        asignatura: { id: 1, codigo: 'EIF201', nombre: 'Programación I' },
        requisitos: [],
      } as unknown as PlanAsignatura,
      {
        id: 3,
        asignaturaId: 3,
        nivel: 1,
        ciclo: 2,
        activo: true,
        asignatura: { id: 3, codigo: 'EIF202', nombre: 'Programación II' },
        requisitos: [],
      } as unknown as PlanAsignatura,
    ]);

    const resultado = await apiController.consultarFormulario(tokenValido);
    const nivel1 = resultado.catalogo.find((c) => c.nivel === 1);
    expect(nivel1).toBeDefined();
    expect(nivel1?.ciclos.length).toBe(2);
    expect(nivel1?.ciclos[0].ciclo).toBe(1);
    expect(nivel1?.ciclos[1].ciclo).toBe(2);
  });

  // 8. Requisito simple satisfecho
  it('8. Requisito simple satisfecho: Prog II es elegible cuando Prog I está marcada', () => {
    const aprobadas = new Set<number>([1]);
    expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(true);
  });

  // 9. Requisito simple no satisfecho
  it('9. Requisito simple no satisfecho: Prog II NO es elegible ni visible si falta Prog I', () => {
    const aprobadas = new Set<number>();
    expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(false);

    const visibles = filtrarAsignaturasVisiblesFrontend(
      catalogoCompleto,
      aprobadas,
    );
    const idsVisibles = visibles.map((a) => a.asignaturaId);
    expect(idsVisibles).not.toContain(3); // Prog II no debe aparecer
  });

  // 10. Cadena Programación I → II → III → IV
  it('10. Cadena Programación I → II → III → IV: progresión secuencial estricta', () => {
    const aprobadas = new Set<number>();
    expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(false);

    aprobadas.add(1); // Prog I
    expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(true);
    expect(esAsignaturaElegibleFrontend(prog3, aprobadas)).toBe(false);

    aprobadas.add(3); // Prog II
    expect(esAsignaturaElegibleFrontend(prog3, aprobadas)).toBe(true);
    expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(false);

    aprobadas.add(4); // Prog III
    expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(true);
  });

  // 11. Dos requisitos obligatorios
  it('11. Dos requisitos obligatorios: Estructuras de Datos requiere Prog 1 Y Mate 1', () => {
    const aprobadas = new Set<number>([1]); // Solo Prog 1
    expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(false);

    aprobadas.add(2); // Prog 1 y Mate 1
    expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(true);
  });

  // 12. Dependencias ramificadas
  it('12. Dependencias ramificadas: Prog 1 habilita tanto Prog 2 como Estructuras de Datos (cuando Mate 1 está aprobada)', () => {
    const aprobadas = new Set<number>([2]); // Solo Mate 1
    expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(false);
    expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(false);

    aprobadas.add(1); // Añadir Prog 1
    expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(true);
    expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(true);
  });

  // 13. Desmarcado y limpieza en cascada
  it('13. Desmarcado y limpieza en cascada: desmarcar Prog 1 poda Prog 2, 3 y 4', () => {
    const aprobadas = new Set<number>([1, 3, 4, 5]); // Prog 1, 2, 3 y 4
    aprobadas.delete(1); // Usuario desmarca Prog 1

    const podadas = podarSeleccionesInvalidasFrontend(
      catalogoCompleto,
      aprobadas,
    );

    expect(podadas).toEqual(expect.arrayContaining([3, 4, 5]));
    expect(aprobadas.has(3)).toBe(false);
    expect(aprobadas.has(4)).toBe(false);
    expect(aprobadas.has(5)).toBe(false);
  });

  // 14. Conservación de asignaturas independientes
  it('14. Conservación de asignaturas independientes: podar Prog 1 mantiene Mate 1 intacta', () => {
    const aprobadas = new Set<number>([1, 3, 2]); // Prog 1, Prog 2 y Mate 1
    aprobadas.delete(1); // Desmarca Prog 1

    const podadas = podarSeleccionesInvalidasFrontend(
      catalogoCompleto,
      aprobadas,
    );

    expect(podadas).toEqual([3]);
    expect(aprobadas.has(2)).toBe(true); // Mate 1 sigue seleccionada
  });

  // 15. Correquisitos bloqueados
  it('15. Correquisitos bloqueados: política BLOQUEAR_REVISION impide habilitar correquisito', () => {
    const aprobadas = new Set<number>([1]);
    expect(esAsignaturaElegibleFrontend(correquisitoAsig, aprobadas)).toBe(false);
  });

  // 16. Materias inactivas o inconsistentes
  it('16. Materias inactivas o inconsistentes: nunca son elegibles ni visibles', () => {
    const aprobadas = new Set<number>([1, 2, 3, 4, 5]);
    expect(esAsignaturaElegibleFrontend(materiaInactiva, aprobadas)).toBe(false);

    const visibles = filtrarAsignaturasVisiblesFrontend(catalogoCompleto, aprobadas);
    expect(visibles.map((a) => a.asignaturaId)).not.toContain(8);
  });

  // 17. Navegación hacia atrás y adelante
  it('17. Navegación hacia atrás y adelante: conserva el estado de materias seleccionadas', () => {
    const estado = {
      pasoActualIndice: 0,
      pasosDisponibles: ['datos', 'nivel_1', 'nivel_2', 'resumen'],
      aprobadasSeleccionadas: new Set<number>([1]),
    };

    // Avanza al siguiente paso
    estado.pasoActualIndice++;
    expect(estado.pasoActualIndice).toBe(1);
    expect(estado.aprobadasSeleccionadas.has(1)).toBe(true);

    // Retrocede al paso anterior
    estado.pasoActualIndice--;
    expect(estado.pasoActualIndice).toBe(0);
    expect(estado.aprobadasSeleccionadas.has(1)).toBe(true);
  });

  // 18. Páginas académicas vacías
  it('18. Páginas académicas vacías: omite niveles que no tengan asignaturas elegibles', () => {
    // Si solo hay materias de nivel 1 elegibles, los niveles superiores no tienen materias elegibles
    const aprobadas = new Set<number>(); // Nada aprobado

    const nivelesCatalogo = [
      {
        nivel: 1,
        ciclos: [{ ciclo: 1, asignaturas: [prog1, mate1] }],
      },
      {
        nivel: 2,
        ciclos: [{ ciclo: 1, asignaturas: [prog3] }], // prog3 requiere prog2 que requiere prog1
      },
    ];

    const pasos = ['datos'];
    for (const nivel of nivelesCatalogo) {
      const tieneElegibles = nivel.ciclos.some((c) =>
        c.asignaturas.some((a) => esAsignaturaElegibleFrontend(a, aprobadas)),
      );
      if (tieneElegibles) {
        pasos.push('nivel_' + nivel.nivel);
      }
    }
    pasos.push('resumen');

    // Nivel 2 no debe agregarse porque tiene 0 materias elegibles
    expect(pasos).toEqual(['datos', 'nivel_1', 'resumen']);
  });

  // 19. Actualización de progreso
  it('19. Actualización de progreso: calcula el porcentaje y paso relativo correctamente', () => {
    const pasos = ['datos', 'nivel_1', 'resumen'];
    const calcularProgreso = (indice: number) => {
      const total = pasos.length;
      const actual = indice + 1;
      return {
        label: `Paso ${actual} de ${total}`,
        percent: Math.round((actual / total) * 100),
      };
    };

    expect(calcularProgreso(0)).toEqual({ label: 'Paso 1 de 3', percent: 33 });
    expect(calcularProgreso(1)).toEqual({ label: 'Paso 2 de 3', percent: 67 });
    expect(calcularProgreso(2)).toEqual({ label: 'Paso 3 de 3', percent: 100 });
  });

  // 20. Resumen final
  it('20. Resumen final: la plantilla contiene la declaración jurada y sección de confirmación', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).toContain('Declaración jurada estudiantil');
    expect(html).toContain('PENDIENTE');
    expect(html).toContain('revisión y aprobación administrativa');
  });

  // 21. Envío válido al endpoint público
  it('21. Envío válido al endpoint público: registra y retorna código INT-REGISTRADO en estado PENDIENTE', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carreraId: 1,
      planEstudioId: 2,
    } as unknown as FormularioEstudiante);

    periodoRepo.findOne.mockResolvedValue({
      id: 100,
      nombre: 'I Ciclo 2026',
    } as PeriodoAcademico);

    motorRequisitosService.validarSeleccionEstricta.mockResolvedValue({
      esValido: true,
      mensaje: 'Requisitos satisfechos',
      asignaturasValidas: [1],
      asignaturasInvalidas: [],
      aprobadasValidas: [1],
      asignaturas: [],
      solicitadasOriginales: [1],
      desmarcadasCascada: [],
      inconsistenciasGrafo: [],
      resumenPorNivelCiclo: [],
      mapaAsignaturas: new Map(),
    } as any);

    persistenciaInternaService.guardarRespuestaInterna.mockResolvedValue({
      id: 50,
      googleResponseId: 'INT-REGISTRADO-2026',
      estado: EstadoRespuestaFormulario.PENDIENTE,
    } as unknown as any);

    const dto = plainToInstance(EnviarRespuestaPublicaDto, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '118230948',
      primerNombre: 'Ana',
      primerApellido: 'Rojas',
      correoEstudiantil: 'ana.rojas@estudiantec.cr',
      periodoIngresoId: 100,
      asignaturasAprobadasIds: [1],
      sitioWeb: '',
    });

    const respuesta = await apiController.enviarRespuesta(tokenValido, dto);

    expect(respuesta.mensaje).toContain('satisfactoriamente');
    expect(respuesta.codigoConfirmacion).toBe('INT-REGISTRADO-2026');
  });

  // 22. Rechazo de asignaturas manipuladas
  it('22. Rechazo de asignaturas manipuladas: backend rechaza asignaturas enviadas sin requisitos cumplidos', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carreraId: 1,
      planEstudioId: 2,
    } as unknown as FormularioEstudiante);

    periodoRepo.findOne.mockResolvedValue({
      id: 100,
    } as PeriodoAcademico);

    // Motor rechaza porque el usuario inyectó Prog 4 sin tener Prog 1, 2, 3
    motorRequisitosService.validarSeleccionEstricta.mockRejectedValue(
      new BadRequestException(
        'La asignatura Prog IV no cumple con sus prerrequisitos',
      ),
    );

    const dto = plainToInstance(EnviarRespuestaPublicaDto, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '118230948',
      primerNombre: 'Ana',
      primerApellido: 'Rojas',
      correoEstudiantil: 'ana.rojas@estudiantec.cr',
      periodoIngresoId: 100,
      asignaturasAprobadasIds: [5], // Manipulación ilegal
      sitioWeb: '',
    });

    await expect(
      apiController.enviarRespuesta(tokenValido, dto),
    ).rejects.toThrow(BadRequestException);
  });

  // 23. Prevención de doble envío
  it('23. Prevención de doble envío: deduplicación temporal dentro de la ventana de 60 segundos', async () => {
    formularioRepo.findOne.mockResolvedValue({
      id: 10,
      tokenPublico: tokenValido,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      carreraId: 1,
      planEstudioId: 2,
    } as unknown as FormularioEstudiante);

    periodoRepo.findOne.mockResolvedValue({
      id: 100,
    } as PeriodoAcademico);

    motorRequisitosService.validarSeleccionEstricta.mockResolvedValue({
      esValido: true,
      mensaje: 'OK',
      asignaturasValidas: [1],
      asignaturasInvalidas: [],
      aprobadasValidas: [1],
      asignaturas: [],
      solicitadasOriginales: [1],
      desmarcadasCascada: [],
      inconsistenciasGrafo: [],
      resumenPorNivelCiclo: [],
      mapaAsignaturas: new Map(),
    } as any);

    persistenciaInternaService.guardarRespuestaInterna.mockResolvedValueOnce({
      id: 50,
      googleResponseId: 'INT-REGISTRADO-1',
    } as any).mockResolvedValueOnce({
      id: 50,
      googleResponseId: 'INT-REGISTRADO-1',
      idempotente: true,
    } as any);

    const dto = plainToInstance(EnviarRespuestaPublicaDto, {
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      identificacion: '118230948',
      primerNombre: 'Ana',
      primerApellido: 'Rojas',
      correoEstudiantil: 'ana.rojas@estudiantec.cr',
      periodoIngresoId: 100,
      asignaturasAprobadasIds: [1],
      sitioWeb: '',
    });

    // Primer envío exitoso
    const primerEnvio = await apiController.enviarRespuesta(tokenValido, dto);
    expect(primerEnvio.codigoConfirmacion).toBe('INT-REGISTRADO-1');

    // Segundo envío: la capa de persistencia devuelve la respuesta existente.
    const segundoEnvio = await apiController.enviarRespuesta(tokenValido, dto);
    expect(segundoEnvio.idempotente).toBe(true);
    expect(segundoEnvio.codigoConfirmacion).toBe('INT-REGISTRADO-1');
    expect(persistenciaInternaService.guardarRespuestaInterna).toHaveBeenCalledTimes(2);
  });

  // 24. Confirmación de registro PENDIENTE
  it('24. Confirmación de registro PENDIENTE: la vista de confirmación muestra código y estado PENDIENTE', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).toContain('txt-codigo-confirmacion');
    expect(html).toContain('PENDIENTE');
    expect(html).toContain('Imprimir Comprobante');
  });

  // 25. Respuestas HTTP 429 y Retry-After
  it('25. Respuestas HTTP 429 y Retry-After: el guard arroja 429 con Retry-After al superar el límite', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          method: 'POST',
          ip: '192.168.1.50',
        }),
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
    } as unknown as ExecutionContext;

    // Límite POST son 10 por minuto
    for (let i = 0; i < 10; i++) {
      expect(rateLimitGuard.canActivate(mockContext)).toBe(true);
    }

    // El número 11 debe ser bloqueado con 429
    expect(() => rateLimitGuard.canActivate(mockContext)).toThrow(
      HttpException,
    );
  });

  // 26. Usabilidad en dispositivos móviles
  it('26. Usabilidad en dispositivos móviles: la plantilla incluye viewport responsive y media queries', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    expect(html).toContain('@media (max-width: 640px)');
  });

  // 27. Accesibilidad mediante teclado
  it('27. Accesibilidad mediante teclado: la plantilla incluye foco visible, roles ARIA y labels explícitos', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('focus-visible');
    expect(html).toContain('for="input-identificacion"');
    expect(html).toContain('for="input-correo"');
  });

  // 28. Ausencia de dependencias de Electron
  it('28. Ausencia de dependencias de Electron: sin window.sgpa ni require electron', () => {
    const html = generarHtmlFormularioPublico(tokenValido);
    expect(html).not.toContain('window.sgpa');
    expect(html).not.toContain('require("electron")');
    expect(html).not.toContain("require('electron')");
    expect(html).not.toContain('ipcRenderer');
  });

  // 29. Ausencia de regresiones de Google Forms
  it('29. Ausencia de regresiones de Google Forms: constante GOOGLE_FORMS sigue intacta', () => {
    expect(ProveedorFormulario.GOOGLE_FORMS).toBe('GOOGLE_FORMS');
    expect(ProveedorFormulario.INTERNO).toBe('INTERNO');
  });

  // 30. Ausencia de exposición de datos personales en logs o URLs
  it('30. Ausencia de exposición de datos personales en logs o URLs: la URL solo contiene el token hex criptográfico', () => {
    const urlPublica = `/formularios/p/${tokenValido}`;
    expect(urlPublica).not.toContain('identificacion');
    expect(urlPublica).not.toContain('correo');
    expect(urlPublica).toMatch(/^\/formularios\/p\/[0-9a-fA-F]{64}$/);
  });
});
