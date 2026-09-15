import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../../estructura-academica/estructura-academica.service';
import { EstudiantesImportacionService } from '../estudiantes-importacion.service';
import { EstadoImportacionGoogle } from './constants/estado-importacion-google.constant';
import { ConfiguracionFormularioEstudiantes } from './entities/configuracion-formulario-estudiantes.entity';
import { ImportacionGoogleEstudiante } from './entities/importacion-google-estudiante.entity';
import { GoogleFormsSyncService } from './google-forms-sync.service';

describe('GoogleFormsSyncService', () => {
  let service: GoogleFormsSyncService;
  let configRepo: jest.Mocked<Repository<ConfiguracionFormularioEstudiantes>>;
  let importacionRepo: jest.Mocked<Repository<ImportacionGoogleEstudiante>>;
  let importadorService: jest.Mocked<EstudiantesImportacionService>;
  let estructuraService: jest.Mocked<EstructuraAcademicaService>;

  const configMock = {
    id: 1,
    nombre: 'Formulario Informática',
    googleFormId: 'form-123',
    googleSheetId: 'sheet-456',
    carreraId: 10,
    planEstudioId: 20,
    activo: true,
    ultimaFilaProcesada: 1,
  } as ConfiguracionFormularioEstudiantes;

  beforeEach(() => {
    configRepo = {
      findOne: jest.fn().mockResolvedValue({ ...configMock }),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
    } as unknown as jest.Mocked<Repository<ConfiguracionFormularioEstudiantes>>;

    importacionRepo = {
      create: jest.fn().mockImplementation((val) => ({ ...val, id: 100 })),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
    } as unknown as jest.Mocked<Repository<ImportacionGoogleEstudiante>>;

    importadorService = {
      ejecutar: jest.fn(),
      validar: jest.fn(),
    } as unknown as jest.Mocked<EstudiantesImportacionService>;

    estructuraService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<EstructuraAcademicaService>;

    service = new GoogleFormsSyncService(
      configRepo,
      importacionRepo,
      importadorService,
      estructuraService,
    );
  });

  it('procesa una respuesta nueva completa y la marca como PROCESADO', async () => {
    importadorService.ejecutar.mockResolvedValue({
      creados: 1,
      actualizados: 0,
      aprobacionesNuevas: 2,
      sinCambios: 0,
      errores: 0,
      filas: [
        {
          fila: 2,
          cedula: '001234567',
          accion: 'CREAR',
          errores: [],
          estudianteId: 50,
          periodoIngresoId: 1,
          cambiosDatos: [],
          aprobacionesNuevas: [
            { codigo: 'EIF200', planAsignaturaId: 1 },
            { codigo: 'MAT030', planAsignaturaId: 2 },
          ],
        },
      ],
    });

    const respuestasCrudas = [
      {
        identificadorExterno: 'resp-001',
        filaOrigen: 2,
        payload: {
          'Número de identificación': '001234567',
          Nombres: 'Ana',
          'Primer apellido': 'Solís',
          'Correo estudiantil': 'ana@una.cr',
          'Número telefónico': '88880000',
          'Período de ingreso': '2026-C1',
          'Asignaturas aprobadas': [
            'EIF200 Fundamentos',
            'MAT030 Matemática',
          ],
        },
      },
    ];

    const resultado = await service.sincronizarRespuestasCrudas(
      5,
      1,
      respuestasCrudas,
    );

    expect(resultado.totalRecibidas).toBe(1);
    expect(resultado.creados).toBe(1);
    expect(resultado.procesadas).toBe(1);
    expect(resultado.errores).toBe(0);
    expect(resultado.filas[0].estado).toBe(EstadoImportacionGoogle.PROCESADO);
    expect(importadorService.ejecutar).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        carreraId: 10,
        planEstudioId: 20,
        estudiantes: [
          expect.objectContaining({
            fila: 2,
            cedula: '001234567',
            correoInstitucional: 'ana@una.cr',
            periodoIngresoCodigo: '2026-C1',
            asignaturasAprobadas: ['EIF200', 'MAT030'],
          }),
        ],
      }),
    );
    expect(configRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ ultimaFilaProcesada: 2 }),
    );
  });

  it('deja la respuesta en estado ERROR si falta el período de ingreso', async () => {
    const respuestasCrudas = [
      {
        filaOrigen: 3,
        payload: {
          cedula: '999',
          nombres: 'Pedro',
          apellido1: 'Gómez',
          correoInstitucional: 'pedro@una.cr',
          // Sin período
        },
      },
    ];

    const resultado = await service.sincronizarRespuestasCrudas(
      5,
      1,
      respuestasCrudas,
    );

    expect(resultado.errores).toBe(1);
    expect(resultado.procesadas).toBe(0);
    expect(resultado.filas[0].estado).toBe(EstadoImportacionGoogle.ERROR);
    expect(resultado.filas[0].error).toContain('período de ingreso');
    expect(importadorService.ejecutar).not.toHaveBeenCalled();
  });

  it('registra ERROR cuando el importador reporta curso desconocido o período inexistente', async () => {
    importadorService.ejecutar.mockResolvedValue({
      creados: 0,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 0,
      errores: 1,
      filas: [
        {
          fila: 4,
          cedula: '888',
          accion: 'ERROR',
          errores: ['La asignatura NOEXISTE no pertenece al plan.'],
          estudianteId: null,
          periodoIngresoId: null,
          cambiosDatos: [],
          aprobacionesNuevas: [],
        },
      ],
    });

    const respuestasCrudas = [
      {
        filaOrigen: 4,
        payload: {
          cedula: '888',
          nombres: 'Carlos',
          apellido1: 'Mora',
          correoInstitucional: 'carlos@una.cr',
          periodoIngresoCodigo: '2026-C1',
          asignaturasAprobadas: ['NOEXISTE'],
        },
      },
    ];

    const resultado = await service.sincronizarRespuestasCrudas(
      5,
      1,
      respuestasCrudas,
    );

    expect(resultado.errores).toBe(1);
    expect(resultado.filas[0].estado).toBe(EstadoImportacionGoogle.ERROR);
    expect(resultado.filas[0].error).toContain('no pertenece al plan');
  });

  it('marca como PROCESADO cuando un estudiante existente agrega nuevas asignaturas aprobadas', async () => {
    importadorService.ejecutar.mockResolvedValue({
      creados: 0,
      actualizados: 1,
      aprobacionesNuevas: 1,
      sinCambios: 0,
      errores: 0,
      filas: [
        {
          fila: 5,
          cedula: '001234567',
          accion: 'ACTUALIZAR',
          errores: [],
          estudianteId: 50,
          periodoIngresoId: 1,
          cambiosDatos: [],
          aprobacionesNuevas: [{ codigo: 'EIF201', planAsignaturaId: 3 }],
        },
      ],
    });

    const respuestasCrudas = [
      {
        filaOrigen: 5,
        payload: {
          cedula: '001234567',
          nombres: 'Ana',
          apellido1: 'Solís',
          correoInstitucional: 'ana@una.cr',
          periodoIngresoCodigo: '2026-C1',
          asignaturasAprobadas: ['EIF201'],
        },
      },
    ];

    const resultado = await service.sincronizarRespuestasCrudas(
      5,
      1,
      respuestasCrudas,
    );

    expect(resultado.actualizados).toBe(1);
    expect(resultado.filas[0].estado).toBe(EstadoImportacionGoogle.PROCESADO);
  });

  it('marca como DUPLICADO cuando una segunda respuesta no aporta cambios', async () => {
    importadorService.ejecutar.mockResolvedValue({
      creados: 0,
      actualizados: 0,
      aprobacionesNuevas: 0,
      sinCambios: 1,
      errores: 0,
      filas: [
        {
          fila: 6,
          cedula: '001234567',
          accion: 'SIN_CAMBIOS',
          errores: [],
          estudianteId: 50,
          periodoIngresoId: 1,
          cambiosDatos: [],
          aprobacionesNuevas: [],
        },
      ],
    });

    const respuestasCrudas = [
      {
        filaOrigen: 6,
        payload: {
          cedula: '001234567',
          nombres: 'Ana',
          apellido1: 'Solís',
          correoInstitucional: 'ana@una.cr',
          periodoIngresoCodigo: '2026-C1',
          asignaturasAprobadas: ['EIF200'],
        },
      },
    ];

    const resultado = await service.sincronizarRespuestasCrudas(
      5,
      1,
      respuestasCrudas,
    );

    expect(resultado.sinCambios).toBe(1);
    expect(resultado.filas[0].estado).toBe(EstadoImportacionGoogle.DUPLICADO);
  });

  it('rechaza la sincronización si el usuario no tiene alcance académico', async () => {
    estructuraService.tieneAlcanceSobreCarrera.mockResolvedValue(false);

    await expect(
      service.sincronizarRespuestasCrudas(5, 1, []),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza si la configuración no existe', async () => {
    configRepo.findOne.mockResolvedValue(null);

    await expect(
      service.sincronizarRespuestasCrudas(5, 999, []),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
