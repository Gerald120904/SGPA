import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { CrearFormularioEstudianteDto } from './dto/crear-formulario-estudiante.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosEstudiantesService } from './formularios-estudiantes.service';

describe('FormulariosEstudiantesService', () => {
  let service: FormulariosEstudiantesService;

  let formularioRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let respuestaRepo: {
    createQueryBuilder: jest.Mock;
  };
  let carreraRepo: {
    findOne: jest.Mock;
  };
  let planEstudioRepo: {
    findOne: jest.Mock;
  };
  let planAsignaturaRepo: {
    find: jest.Mock;
  };
  let periodoRepo: {
    find: jest.Mock;
  };
  let googleFormsClient: {
    crearFormulario: jest.Mock;
    actualizarFormulario: jest.Mock;
    publicarFormulario: jest.Mock;
    obtenerFormulario: jest.Mock;
    cerrarFormulario: jest.Mock;
  };
  let googleDriveClient: {
    permitirCualquieraConEnlaceResponder: jest.Mock;
  };
  let estructuraAcademicaService: {
    tieneAlcanceSobreCarrera: jest.Mock;
    obtenerCarreraIdsConAlcance: jest.Mock;
  };

  const usuarioId = 10;
  const dto: CrearFormularioEstudianteDto = {
    titulo: 'Formulario Admisión 2026',
    carreraId: 1,
    planEstudioId: 2,
  };

  const mockCarrera = {
    id: 1,
    codigo: 'INF',
    nombre: 'Ingeniería en Informática',
    activo: true,
  };

  const mockPlan = {
    id: 2,
    carreraId: 1,
    codigo: 'PLAN-2024',
    nombre: 'Plan 2024',
    activo: true,
  };

  const mockPlanAsignaturas = [
    {
      id: 101,
      planEstudioId: 2,
      cursoId: 201,
      nivel: 1,
      ciclo: 1,
      orden: 1,
      activo: true,
      curso: {
        id: 201,
        codigo: 'EIF201',
        nombre: 'Programación I',
      },
    },
    {
      id: 102,
      planEstudioId: 2,
      cursoId: 202,
      nivel: 1,
      ciclo: 1,
      orden: 2,
      activo: true,
      curso: {
        id: 202,
        codigo: 'MAT001',
        nombre: 'Cálculo I',
      },
    },
    {
      id: 103,
      planEstudioId: 2,
      cursoId: null,
      nivel: 2,
      ciclo: 1,
      orden: 3,
      activo: true,
      curso: null,
    },
  ];

  const mockPeriodos = [
    {
      id: 11,
      codigo: 'I-2026',
      nombre: 'I Ciclo 2026',
      anio: 2026,
      ciclo: 1,
    },
    {
      id: 10,
      codigo: 'II-2025',
      nombre: 'II Ciclo 2025',
      anio: 2025,
      ciclo: 2,
    },
  ];

  beforeEach(() => {
    formularioRepo = {
      create: jest.fn((datos) => ({
        id: 99,
        ...datos,
      })),
      save: jest.fn(async (entidad) => ({
        ...entidad,
        id: entidad.id ?? 99,
      })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    respuestaRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    carreraRepo = {
      findOne: jest.fn().mockResolvedValue(mockCarrera),
    };

    planEstudioRepo = {
      findOne: jest.fn().mockResolvedValue(mockPlan),
    };

    planAsignaturaRepo = {
      find: jest.fn().mockResolvedValue(mockPlanAsignaturas),
    };

    periodoRepo = {
      find: jest.fn().mockResolvedValue(mockPeriodos),
    };

    googleFormsClient = {
      crearFormulario: jest.fn().mockResolvedValue({
        formId: 'google-form-123',
      }),
      actualizarFormulario: jest.fn().mockResolvedValue({
        replies: [
          { createItem: { itemId: 'item-0', questionId: ['q-0'] } },
          { createItem: { itemId: 'item-1', questionId: ['q-1'] } },
          { createItem: { itemId: 'item-2', questionId: ['q-2'] } },
          { createItem: { itemId: 'item-3', questionId: ['q-3'] } },
          { createItem: { itemId: 'item-4', questionId: ['q-4'] } },
          { createItem: { itemId: 'item-5', questionId: ['q-5'] } },
          { createItem: { itemId: 'item-6', questionId: ['q-6'] } },
          { createItem: { itemId: 'item-7', questionId: ['q-7'] } },
          { createItem: { itemId: 'item-8', questionId: ['q-8'] } },
          { createItem: { itemId: 'item-9', questionId: ['q-9'] } },
        ],
      }),
      publicarFormulario: jest.fn().mockResolvedValue({}),
      obtenerFormulario: jest.fn().mockResolvedValue({
        formId: 'google-form-123',
        responderUri: 'https://docs.google.com/forms/d/e/abc/viewform',
      }),
      cerrarFormulario: jest.fn().mockResolvedValue({}),
    };

    googleDriveClient = {
      permitirCualquieraConEnlaceResponder: jest.fn().mockResolvedValue({}),
    };

    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([1]),
    };

    service = new FormulariosEstudiantesService(
      formularioRepo as never,
      respuestaRepo as never,
      carreraRepo as never,
      planEstudioRepo as never,
      planAsignaturaRepo as never,
      periodoRepo as never,
      googleFormsClient as never,
      googleDriveClient as never,
      estructuraAcademicaService as never,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('crear', () => {
    it('falla con NotFoundException si la carrera no existe o está inactiva', async () => {
      carreraRepo.findOne.mockResolvedValue(null);

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'La carrera indicada no existe o está inactiva',
      );
      expect(googleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException si el plan no existe, no pertenece a la carrera o está inactivo', async () => {
      planEstudioRepo.findOne.mockResolvedValue(null);

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'El plan de estudio no pertenece a la carrera o está inactivo',
      );
      expect(googleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('falla con ForbiddenException si el usuario no tiene alcance académico sobre la carrera', async () => {
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'No posee alcance académico sobre la carrera indicada.',
      );
      expect(googleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException si el plan de estudio no tiene asignaturas asociadas a cursos', async () => {
      planAsignaturaRepo.find.mockResolvedValue([
        {
          id: 103,
          planEstudioId: 2,
          cursoId: null,
          activo: true,
          curso: null,
        },
      ]);

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'El plan de estudio no posee asignaturas asociadas a cursos',
      );
      expect(googleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('falla con BadRequestException si no hay períodos académicos registrados', async () => {
      periodoRepo.find.mockResolvedValue([]);

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'No existen períodos académicos registrados',
      );
      expect(googleFormsClient.crearFormulario).not.toHaveBeenCalled();
    });

    it('crea el registro local en estado CREANDO antes de invocar a Google', async () => {
      await service.crear(usuarioId, dto);

      expect(formularioRepo.create).toHaveBeenCalledWith({
        titulo: dto.titulo,
        carreraId: 1,
        planEstudioId: 2,
        googleFormId: null,
        responderUri: null,
        estado: EstadoFormularioEstudiante.CREANDO,
        mapaPreguntas: null,
        ultimaSincronizacionAt: null,
        creadoPorUsuarioId: usuarioId,
        detalleError: null,
      });

      // Primer guardado debe ser en estado CREANDO
      expect(formularioRepo.save).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          estado: EstadoFormularioEstudiante.CREANDO,
          googleFormId: null,
        }),
      );
    });

    it('construye las 10 preguntas en orden exacto y con sus tipos/requerimientos correspondientes', async () => {
      await service.crear(usuarioId, dto);

      expect(googleFormsClient.actualizarFormulario).toHaveBeenCalledTimes(1);
      const [, , requests] =
        googleFormsClient.actualizarFormulario.mock.calls[0];

      expect(requests).toHaveLength(10);

      // 0: Primer nombre (requerida, texto corto)
      expect(requests[0].createItem.item.title).toBe('Primer nombre');
      expect(
        requests[0].createItem.item.questionItem.question.required,
      ).toBe(true);
      expect(
        requests[0].createItem.item.questionItem.question.textQuestion.paragraph,
      ).toBe(false);
      expect(requests[0].createItem.location.index).toBe(0);

      // 1: Segundo nombre (opcional, texto corto)
      expect(requests[1].createItem.item.title).toBe('Segundo nombre');
      expect(
        requests[1].createItem.item.questionItem.question.required,
      ).toBe(false);
      expect(requests[1].createItem.location.index).toBe(1);

      // 2: Primer apellido (requerida)
      expect(requests[2].createItem.item.title).toBe('Primer apellido');
      expect(
        requests[2].createItem.item.questionItem.question.required,
      ).toBe(true);
      expect(requests[2].createItem.location.index).toBe(2);

      // 3: Segundo apellido (opcional)
      expect(requests[3].createItem.item.title).toBe('Segundo apellido');
      expect(
        requests[3].createItem.item.questionItem.question.required,
      ).toBe(false);
      expect(requests[3].createItem.location.index).toBe(3);

      // 4: Número de identificación (requerida)
      expect(requests[4].createItem.item.title).toBe(
        'Número de identificación',
      );
      expect(
        requests[4].createItem.item.questionItem.question.required,
      ).toBe(true);
      expect(requests[4].createItem.location.index).toBe(4);

      // 5: Correo estudiantil (requerida)
      expect(requests[5].createItem.item.title).toBe('Correo estudiantil');
      expect(
        requests[5].createItem.item.questionItem.question.required,
      ).toBe(true);
      expect(requests[5].createItem.location.index).toBe(5);

      // 6: Número de contacto (opcional)
      expect(requests[6].createItem.item.title).toBe('Número de contacto');
      expect(
        requests[6].createItem.item.questionItem.question.required,
      ).toBe(false);
      expect(requests[6].createItem.location.index).toBe(6);

      // 7: Período de ingreso (requerida, DROP_DOWN con períodos)
      expect(requests[7].createItem.item.title).toBe('Período de ingreso');
      expect(
        requests[7].createItem.item.questionItem.question.required,
      ).toBe(true);
      expect(
        requests[7].createItem.item.questionItem.question.choiceQuestion.type,
      ).toBe('DROP_DOWN');
      expect(
        requests[7].createItem.item.questionItem.question.choiceQuestion
          .options,
      ).toEqual([
        { value: 'I-2026 - I Ciclo 2026' },
        { value: 'II-2025 - II Ciclo 2025' },
      ]);
      expect(requests[7].createItem.location.index).toBe(7);

      // 8: Asignaturas aprobadas (NO requerida, CHECKBOX, solo cursos concretos)
      expect(requests[8].createItem.item.title).toBe(
        '¿Cuáles asignaturas ha aprobado?',
      );
      expect(
        requests[8].createItem.item.questionItem.question.required,
      ).toBe(false);
      expect(
        requests[8].createItem.item.questionItem.question.choiceQuestion.type,
      ).toBe('CHECKBOX');
      expect(
        requests[8].createItem.item.questionItem.question.choiceQuestion
          .options,
      ).toEqual([
        { value: 'EIF201 - Programación I' },
        { value: 'MAT001 - Cálculo I' },
      ]);
      expect(requests[8].createItem.location.index).toBe(8);

      // 9: Optativas no disciplinarias (opcional, párrafo)
      expect(requests[9].createItem.item.title).toBe(
        '¿Cuál o cuáles optativas no disciplinarias ha llevado?',
      );
      expect(
        requests[9].createItem.item.questionItem.question.required,
      ).toBe(false);
      expect(
        requests[9].createItem.item.questionItem.question.textQuestion.paragraph,
      ).toBe(true);
      expect(requests[9].createItem.location.index).toBe(9);
    });

    it('construye mapaPreguntas con los questionIds y opciones mapeadas a IDs de base de datos', async () => {
      const resultado = await service.crear(usuarioId, dto);

      expect(resultado.mapaPreguntas).toEqual({
        primerNombre: { questionId: 'q-0' },
        segundoNombre: { questionId: 'q-1' },
        primerApellido: { questionId: 'q-2' },
        segundoApellido: { questionId: 'q-3' },
        identificacion: { questionId: 'q-4' },
        correoEstudiantil: { questionId: 'q-5' },
        contacto: { questionId: 'q-6' },
        periodoIngreso: {
          questionId: 'q-7',
          opciones: {
            'I-2026 - I Ciclo 2026': 11,
            'II-2025 - II Ciclo 2025': 10,
          },
        },
        asignaturasAprobadas: {
          questionId: 'q-8',
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
        optativasNoDisciplinarias: { questionId: 'q-9' },
      });
    });

    it('configura permisos en Drive, publica el formulario y guarda responderUri en estado PUBLICADO', async () => {
      const resultado = await service.crear(usuarioId, dto);

      expect(
        googleDriveClient.permitirCualquieraConEnlaceResponder,
      ).toHaveBeenCalledWith(usuarioId, 'google-form-123');

      expect(googleFormsClient.publicarFormulario).toHaveBeenCalledWith(
        usuarioId,
        'google-form-123',
      );

      expect(googleFormsClient.obtenerFormulario).toHaveBeenCalledWith(
        usuarioId,
        'google-form-123',
      );

      expect(resultado.responderUri).toBe(
        'https://docs.google.com/forms/d/e/abc/viewform',
      );
      expect(resultado.estado).toBe(EstadoFormularioEstudiante.PUBLICADO);
      expect(resultado.detalleError).toBeNull();
    });

    it('falla y cambia el estado a ERROR registrando detalleError si Google falla en la creación', async () => {
      googleFormsClient.crearFormulario.mockRejectedValue(
        new Error('Google API quota exceeded'),
      );

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'Google API quota exceeded',
      );

      // El último guardado debe tener estado ERROR y detalleError
      const llamadasGuardado = formularioRepo.save.mock.calls;
      const ultimoGuardado =
        llamadasGuardado[llamadasGuardado.length - 1][0];

      expect(ultimoGuardado.estado).toBe(EstadoFormularioEstudiante.ERROR);
      expect(ultimoGuardado.detalleError).toBe('Google API quota exceeded');
    });

    it('falla con InternalServerErrorException si Google no devuelve todos los replies', async () => {
      googleFormsClient.actualizarFormulario.mockResolvedValue({
        replies: [{ createItem: { itemId: 'item-0', questionId: ['q-0'] } }],
      });

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'Google no devolvió todos los identificadores de las preguntas',
      );

      const llamadasGuardado = formularioRepo.save.mock.calls;
      const ultimoGuardado =
        llamadasGuardado[llamadasGuardado.length - 1][0];
      expect(ultimoGuardado.estado).toBe(EstadoFormularioEstudiante.ERROR);
    });

    it('falla con InternalServerErrorException si Google no devuelve questionId para alguna pregunta', async () => {
      googleFormsClient.actualizarFormulario.mockResolvedValue({
        replies: [
          { createItem: { itemId: 'item-0', questionId: ['q-0'] } },
          { createItem: { itemId: 'item-1', questionId: [] } }, // Sin questionId
          { createItem: { itemId: 'item-2', questionId: ['q-2'] } },
          { createItem: { itemId: 'item-3', questionId: ['q-3'] } },
          { createItem: { itemId: 'item-4', questionId: ['q-4'] } },
          { createItem: { itemId: 'item-5', questionId: ['q-5'] } },
          { createItem: { itemId: 'item-6', questionId: ['q-6'] } },
          { createItem: { itemId: 'item-7', questionId: ['q-7'] } },
          { createItem: { itemId: 'item-8', questionId: ['q-8'] } },
          { createItem: { itemId: 'item-9', questionId: ['q-9'] } },
        ],
      });

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'Google no devolvió el questionId de la pregunta 1',
      );
    });

    it('falla con InternalServerErrorException si Google no devuelve responderUri al consultar el form', async () => {
      googleFormsClient.obtenerFormulario.mockResolvedValue({
        formId: 'google-form-123',
        responderUri: null,
      });

      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.crear(usuarioId, dto)).rejects.toThrow(
        'Google no devolvió la URL para responder el formulario',
      );
    });
  });

  describe('listar', () => {
    it('listar respeta alcance académico retornando [] si el usuario no tiene carreras con alcance', async () => {
      estructuraAcademicaService.obtenerCarreraIdsConAlcance.mockResolvedValue(
        [],
      );

      const resultado = await service.listar(usuarioId);

      expect(resultado).toEqual([]);
      expect(formularioRepo.find).not.toHaveBeenCalled();
    });

    it('ADMIN_GLOBAL puede listar todos los formularios de sus carreras con alcance', async () => {
      estructuraAcademicaService.obtenerCarreraIdsConAlcance.mockResolvedValue([
        1, 2, 3,
      ]);

      const mockFormularios = [
        {
          id: 1,
          titulo: 'Formulario 1',
          carreraId: 1,
          planEstudioId: 1,
          googleFormId: 'g-1',
          responderUri: 'https://form1',
          estado: EstadoFormularioEstudiante.PUBLICADO,
          mapaPreguntas: { algo: 'mapa' },
          carrera: { id: 1, nombre: 'Carrera 1' },
          planEstudio: { id: 1, nombre: 'Plan 1' },
        },
      ];
      formularioRepo.find.mockResolvedValue(mockFormularios);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { formularioId: '1', estado: 'PENDIENTE', cantidad: '2' },
          { formularioId: '1', estado: 'PROCESADO', cantidad: '3' },
        ]),
      };
      respuestaRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const resultado = await service.listar(usuarioId);

      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toEqual({
        id: 1,
        titulo: 'Formulario 1',
        carreraId: 1,
        planEstudioId: 1,
        googleFormId: 'g-1',
        responderUri: 'https://form1',
        estado: EstadoFormularioEstudiante.PUBLICADO,
        carrera: { id: 1, nombre: 'Carrera 1' },
        planEstudio: { id: 1, nombre: 'Plan 1' },
        totalRespuestas: 5,
        pendientes: 2,
        procesadas: 3,
        requierenRevision: 0,
        errores: 0,
      });
      // Verifica que mapaPreguntas no se devuelva en el listado
      expect((resultado[0] as any).mapaPreguntas).toBeUndefined();
    });
  });

  describe('obtenerPorId', () => {
    it('falla con NotFoundException si el formulario no existe', async () => {
      formularioRepo.findOne.mockResolvedValue(null);

      await expect(service.obtenerPorId(999, usuarioId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.obtenerPorId(999, usuarioId)).rejects.toThrow(
        'El formulario indicado no existe',
      );
    });

    it('falla con ForbiddenException si el usuario no tiene alcance académico sobre la carrera', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 1,
        carreraId: 5,
      });
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(service.obtenerPorId(1, usuarioId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.obtenerPorId(1, usuarioId)).rejects.toThrow(
        'No posee alcance académico sobre la carrera indicada.',
      );
    });

    it('devuelve el detalle del formulario completo con conteos correctos', async () => {
      const mockForm = {
        id: 1,
        titulo: 'Formulario 1',
        carreraId: 1,
        planEstudioId: 2,
        googleFormId: 'g-1',
        responderUri: 'https://form1',
        estado: EstadoFormularioEstudiante.PUBLICADO,
        mapaPreguntas: { algo: 'mapa' },
        detalleError: null,
        carrera: { id: 1, nombre: 'Carrera 1' },
        planEstudio: { id: 2, nombre: 'Plan 2' },
      };
      formularioRepo.findOne.mockResolvedValue(mockForm);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { estado: 'PENDIENTE', cantidad: '1' },
          { estado: 'PROCESADO', cantidad: '4' },
          { estado: 'REQUIERE_REVISION', cantidad: '2' },
          { estado: 'ERROR', cantidad: '1' },
        ]),
      };
      respuestaRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const resultado = await service.obtenerPorId(1, usuarioId);

      expect(resultado).toEqual({
        ...mockForm,
        totalRespuestas: 8,
        pendientes: 1,
        procesadas: 4,
        requierenRevision: 2,
        errores: 1,
      });
    });
  });

  describe('cerrar', () => {
    it('falla con NotFoundException si el formulario no existe', async () => {
      formularioRepo.findOne.mockResolvedValue(null);

      await expect(service.cerrar(999, usuarioId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('falla con ForbiddenException si el usuario no tiene alcance académico', async () => {
      formularioRepo.findOne.mockResolvedValue({
        id: 1,
        carreraId: 5,
      });
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        false,
      );

      await expect(service.cerrar(1, usuarioId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('cerrar CERRADO es idempotente y no vuelve a llamar a Google', async () => {
      const mockForm = {
        id: 1,
        carreraId: 1,
        googleFormId: 'g-1',
        estado: EstadoFormularioEstudiante.CERRADO,
      };
      formularioRepo.findOne.mockResolvedValue(mockForm);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      const resultado = await service.cerrar(1, usuarioId);

      expect(resultado).toBe(mockForm);
      expect(googleFormsClient.cerrarFormulario).not.toHaveBeenCalled();
      expect(formularioRepo.save).not.toHaveBeenCalled();
    });

    it('cerrar CREANDO falla con BadRequestException', async () => {
      const mockForm = {
        id: 1,
        carreraId: 1,
        googleFormId: 'g-1',
        estado: EstadoFormularioEstudiante.CREANDO,
      };
      formularioRepo.findOne.mockResolvedValue(mockForm);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      await expect(service.cerrar(1, usuarioId)).rejects.toThrow(
        BadRequestException,
      );
      expect(googleFormsClient.cerrarFormulario).not.toHaveBeenCalled();
    });

    it('cerrar ERROR falla con BadRequestException', async () => {
      const mockForm = {
        id: 1,
        carreraId: 1,
        googleFormId: 'g-1',
        estado: EstadoFormularioEstudiante.ERROR,
      };
      formularioRepo.findOne.mockResolvedValue(mockForm);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      await expect(service.cerrar(1, usuarioId)).rejects.toThrow(
        BadRequestException,
      );
      expect(googleFormsClient.cerrarFormulario).not.toHaveBeenCalled();
    });

    it('cerrar PUBLICADO llama Google y cambia estado a CERRADO', async () => {
      const mockForm = {
        id: 1,
        carreraId: 1,
        googleFormId: 'g-1',
        estado: EstadoFormularioEstudiante.PUBLICADO,
      };
      formularioRepo.findOne.mockResolvedValue(mockForm);
      estructuraAcademicaService.tieneAlcanceSobreCarrera.mockResolvedValue(
        true,
      );

      const resultado = await service.cerrar(1, usuarioId);

      expect(googleFormsClient.cerrarFormulario).toHaveBeenCalledWith(
        usuarioId,
        'g-1',
      );
      expect(mockForm.estado).toBe(EstadoFormularioEstudiante.CERRADO);
      expect(formularioRepo.save).toHaveBeenCalledWith(mockForm);
      expect(resultado.estado).toBe(EstadoFormularioEstudiante.CERRADO);
    });

    it('garantiza que no existe método de eliminación en el servicio', () => {
      expect((service as any).eliminar).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
      expect((service as any).borrar).toBeUndefined();
    });
  });
});
