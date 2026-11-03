import { BandejaRevisionEstudiantesService } from './bandeja-revision-estudiantes.service';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { RegistroImportacionEstudiante } from './entities/registro-importacion-estudiante.entity';
import { ForbiddenException } from '@nestjs/common';

describe('BandejaRevisionEstudiantesService', () => {
  let service: BandejaRevisionEstudiantesService;
  let loteRepo: any;
  let registroRepo: any;
  let estudianteRepo: any;
  let historialRepo: any;
  let carreraRepo: any;
  let planRepo: any;
  let planAsignaturaRepo: any;
  let periodoRepo: any;
  let importacionService: any;
  let estructuraAcademicaService: any;
  let dataSource: any;
  let alcanceJerarquico: any;

  beforeEach(() => {
    loteRepo = {
      create: jest.fn().mockImplementation((d) => ({ id: 10, ...d })),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 10, ...d })),
      findOne: jest.fn(),
    };
    registroRepo = {
      create: jest.fn().mockImplementation((d) => ({ id: 1, ...d })),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 1, ...d })),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    estudianteRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
    };
    historialRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
    };
    carreraRepo = { findOne: jest.fn() };
    planRepo = { findOne: jest.fn() };
    planAsignaturaRepo = { find: jest.fn(), findOne: jest.fn() };
    periodoRepo = { findOne: jest.fn() };
    importacionService = {
      validar: jest.fn().mockResolvedValue({
        carreraId: 1,
        planEstudioId: 2,
        resumen: { total: 2, procesables: 2 },
        filas: [
          {
            fila: 2,
            cedula: '111',
            accion: 'CREAR',
            errores: [],
            estudianteId: null,
            periodoIngresoId: 1,
            datos: { nombres: 'Ana', apellido1: 'Soto', apellido2: null, correoInstitucional: 'ana@una.ac.cr', telefono: null },
            cambiosDatos: [],
            aprobacionesNuevas: [],
          },
          {
            fila: 3,
            cedula: '222',
            accion: 'ACTUALIZAR',
            errores: [],
            estudianteId: 50,
            periodoIngresoId: 1,
            datos: { nombres: 'Carlos', apellido1: 'Mora', apellido2: null, correoInstitucional: 'carlos@una.ac.cr', telefono: null },
            cambiosDatos: [{ campo: 'telefono', actual: null, nuevo: '8888-8888' }],
            aprobacionesNuevas: [],
          },
        ],
      }),
    };
    estructuraAcademicaService = {
      tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
      obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([1]),
    };
    alcanceJerarquico = {
      tipoCuentaJerarquica: jest.fn().mockResolvedValue('COORDINADOR'),
      puedeEjecutar: jest.fn().mockResolvedValue(true),
      obtenerCarrerasAutorizadas: jest.fn().mockResolvedValue([1]),
    };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const manager = {
          getRepository: (entity: any) => {
            if (entity === loteRepo || entity?.name === 'LoteImportacionEstudiante') return loteRepo;
            if (entity === registroRepo || entity?.name === 'RegistroImportacionEstudiante') return registroRepo;
            if (entity === estudianteRepo || entity?.name === 'Estudiante') return estudianteRepo;
            if (entity === historialRepo || entity?.name === 'HistorialAcademicoEstudiante') return historialRepo;
            return { findOne: jest.fn(), save: jest.fn(), update: jest.fn(), create: jest.fn((d) => d) };
          },
        };
        return cb(manager);
      }),
    };

    service = new BandejaRevisionEstudiantesService(
      loteRepo,
      registroRepo,
      estudianteRepo,
      historialRepo,
      carreraRepo,
      planRepo,
      planAsignaturaRepo,
      periodoRepo,
      importacionService,
      estructuraAcademicaService,
      dataSource,
      alcanceJerarquico,
    );
  });

  it('cargarLoteExcel almacena en staging persistente sin modificar expedientes', async () => {
    const dto: any = {
      carreraId: 1,
      planEstudioId: 2,
      estudiantes: [{ fila: 2, cedula: '111' }, { fila: 3, cedula: '222' }],
    };

    const res = await service.cargarLoteExcel(10, dto, 'alumnos.xlsx');

    expect(res.loteId).toBe(10);
    expect(res.totalFilas).toBe(2);
    expect(loteRepo.save).toHaveBeenCalled();
    expect(registroRepo.save).toHaveBeenCalledTimes(2);
    // Verificar que NO se modificó la tabla estudiantes directamente
    expect(estudianteRepo.save).not.toHaveBeenCalled();
    expect(estudianteRepo.update).not.toHaveBeenCalled();
  });

  it('aprobarMasivo aprueba exclusivamente los IDs seleccionados y los aplica a expedientes', async () => {
    const regMock = {
      id: 100,
      carreraId: 1,
      planEstudioId: 2,
      cedula: '111',
      accion: 'CREAR',
      datosJson: { nombres: 'Ana', apellido1: 'Soto', apellido2: null, correoInstitucional: 'ana@una.ac.cr', telefono: null, periodoIngresoId: 1 },
      aprobacionesNuevasJson: [],
      estado: 'PENDIENTE',
    };
    registroRepo.findOne.mockResolvedValue(regMock);
    estudianteRepo.findOne.mockResolvedValue(null);
    estudianteRepo.save.mockResolvedValue({ id: 501, cedula: '111' });

    const res = await service.aprobarMasivo(10, { registroIds: [100] });

    expect(res.aprobados).toBe(1);
    expect(res.fallidos).toHaveLength(0);
    expect(regMock.estado).toBe('APROBADO');
    expect(estudianteRepo.save).toHaveBeenCalled();
  });

  it('rechazarMasivo exige motivo individual por registro y no altera expedientes', async () => {
    const regMock = {
      id: 101,
      carreraId: 1,
      planEstudioId: 2,
      estado: 'PENDIENTE',
      motivoRechazo: null,
    };
    registroRepo.findOne.mockResolvedValue(regMock);

    const res = await service.rechazarMasivo(10, {
      rechazos: [{ id: 101, motivo: 'Identificación no coincide con padrón' }],
    });

    expect(res.rechazados).toBe(1);
    expect(regMock.estado).toBe('RECHAZADO');
    expect(regMock.motivoRechazo).toBe('Identificación no coincide con padrón');
    expect(estudianteRepo.save).not.toHaveBeenCalled();
  });

  it('revierte el expediente cuando falla su historial y procesa el siguiente registro', async () => {
    const expedientes: number[] = [];
    const registros = [100, 101].map((id) => ({ id, carreraId: 1, planEstudioId: 2,
      cedula: String(id), accion: 'CREAR', estado: 'PENDIENTE',
      datosJson: { nombres: 'Ana', apellido1: 'Soto', correoInstitucional: `${id}@una.ac.cr`, periodoIngresoId: 1 },
      aprobacionesNuevasJson: [{ planAsignaturaId: 50 }] }));
    dataSource.transaction.mockImplementation(async (cb: any) => {
      const pendientes: number[] = [];
      const manager = { getRepository: (entity: any) => {
        if (entity.name === 'RegistroImportacionEstudiante') return {
          findOne: jest.fn(({ where }) => Promise.resolve(registros.find((r) => r.id === where.id))),
          save: jest.fn((r) => Promise.resolve(r)),
        };
        if (entity.name === 'Estudiante') return {
          findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d) => d),
          save: jest.fn((d) => { pendientes.push(Number(d.cedula)); return Promise.resolve({ id: Number(d.cedula), ...d }); }),
        };
        if (entity.name === 'HistorialAcademicoEstudiante') return {
          findOne: jest.fn().mockResolvedValue(null), create: jest.fn((d) => d),
          save: jest.fn((d) => d.estudianteId === 100 ? Promise.reject(new Error('historial fallido')) : Promise.resolve(d)),
        };
        return { findOne: jest.fn().mockResolvedValue(null) };
      } };
      const result = await cb(manager);
      expedientes.push(...pendientes);
      return result;
    });
    const res = await service.aprobarMasivo(10, { registroIds: [100, 101] });
    expect(res.aprobados).toBe(1);
    expect(res.fallidos).toEqual([{ id: 100, error: 'historial fallido' }]);
    expect(expedientes).toEqual([101]);
    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('asistente estudiantil no puede aprobar directamente', async () => {
    alcanceJerarquico.tipoCuentaJerarquica.mockResolvedValue('ASISTENTE_ESTUDIANTIL');
    registroRepo.findOne.mockResolvedValue({ id: 100, carreraId: 1, estado: 'PENDIENTE' });

    const res = await service.aprobarMasivo(99, { registroIds: [100] });
    expect(res.aprobados).toBe(0);
    expect(res.fallidos[0].error).toContain('asistente estudiantil no puede aprobar o rechazar directamente');
  });

  it('coordinador no puede aprobar registros de otra carrera aunque conozca su ID', async () => {
    alcanceJerarquico.puedeEjecutar.mockResolvedValue(false);
    registroRepo.findOne.mockResolvedValue({ id: 105, carreraId: 99, estado: 'PENDIENTE' });
    const res = await service.aprobarMasivo(10, { registroIds: [105] });
    expect(res.aprobados).toBe(0);
    expect(res.fallidos[0].error).toContain('No posee permiso de gestión');
    expect(estudianteRepo.save).not.toHaveBeenCalled();
  });

  it('aplicarRevisionDesdeSolicitud procesa 20 registros (18 aprobados, 2 rechazados con motivos)', async () => {
    alcanceJerarquico.tipoCuentaJerarquica.mockResolvedValue('COORDINADOR');
    const registros: Record<number, any> = {};

    // 18 registros para aprobar
    const aprobarIds = Array.from({ length: 18 }, (_, i) => i + 1);
    for (const id of aprobarIds) {
      registros[id] = {
        id,
        carreraId: 1,
        planEstudioId: 2,
        cedula: `CED-${id}`,
        accion: 'CREAR',
        datosJson: { nombres: `Estudiante ${id}`, apellido1: 'Perez', apellido2: null, correoInstitucional: `e${id}@una.ac.cr`, telefono: null, periodoIngresoId: 1 },
        aprobacionesNuevasJson: [],
        estado: 'PENDIENTE',
      };
    }

    // 2 registros para rechazar con motivos individuales
    const rechazarItems = [
      { id: 19, motivo: 'Cédula no coincide con padrón electoral' },
      { id: 20, motivo: 'Asignaturas no pertenecen al plan de estudios' },
    ];
    for (const item of rechazarItems) {
      registros[item.id] = {
        id: item.id,
        carreraId: 1,
        planEstudioId: 2,
        cedula: `CED-${item.id}`,
        accion: 'CREAR',
        datosJson: { nombres: `Estudiante ${item.id}`, apellido1: 'Gomez', apellido2: null, correoInstitucional: `e${item.id}@una.ac.cr`, telefono: null, periodoIngresoId: 1 },
        aprobacionesNuevasJson: [],
        estado: 'PENDIENTE',
        motivoRechazo: null,
      };
    }

    const mockManager: any = {
      getRepository: (entity: any) => {
        if (entity === RegistroImportacionEstudiante || entity?.name === 'RegistroImportacionEstudiante') {
          return {
            findOne: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(registros[where.id])),
            save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
          };
        }
        if (entity === Estudiante || entity?.name === 'Estudiante') {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 900 + (e.id || 1), ...e })),
            update: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockImplementation((d) => d),
          };
        }
        if (entity === HistorialAcademicoEstudiante || entity?.name === 'HistorialAcademicoEstudiante') {
          return {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockImplementation((h) => Promise.resolve(h)),
            create: jest.fn().mockImplementation((d) => d),
          };
        }
        return { findOne: jest.fn(), save: jest.fn() };
      },
      query: jest.fn().mockResolvedValue([]),
    };

    const dto = {
      carreraId: 1,
      planEstudioId: 2,
      aprobarRegistroIds: aprobarIds,
      rechazarRegistros: rechazarItems,
    };

    const res = await service.aplicarRevisionDesdeSolicitud(10, dto, mockManager);

    expect(res.solicitados).toBe(20);
    expect(res.aprobados).toBe(18);
    expect(res.rechazados).toBe(2);
    expect(res.fallidos).toHaveLength(0);

    // Los 18 registros aprobados quedaron en APROBADO
    for (const id of aprobarIds) {
      expect(registros[id].estado).toBe('APROBADO');
      expect(registros[id].revisadoPorUsuarioId).toBe(10);
    }

    // Los 2 rechazados quedaron en RECHAZADO con sus motivos individuales
    expect(registros[19].estado).toBe('RECHAZADO');
    expect(registros[19].motivoRechazo).toBe('Cédula no coincide con padrón electoral');
    expect(registros[20].estado).toBe('RECHAZADO');
    expect(registros[20].motivoRechazo).toBe('Asignaturas no pertenecen al plan de estudios');
  });

  it('marcarDevueltosDesdeSolicitud marca los 20 registros en DEVUELTO_PARA_CORRECCION', async () => {
    const registros: Record<number, any> = {};
    const aprobarIds = Array.from({ length: 18 }, (_, i) => i + 1);
    const rechazarItems = [{ id: 19, motivo: 'm1' }, { id: 20, motivo: 'm2' }];

    for (let i = 1; i <= 20; i++) {
      registros[i] = { id: i, estado: 'PENDIENTE', motivoRechazo: null };
    }

    const mockManager: any = {
      getRepository: () => ({
        findOne: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(registros[where.id])),
        save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
      }),
    };

    const res = await service.marcarDevueltosDesdeSolicitud(
      10,
      { carreraId: 1, aprobarRegistroIds: aprobarIds, rechazarRegistros: rechazarItems },
      'Por favor verificar cédulas y anexar padrón oficial',
      mockManager,
    );

    expect(res.devueltos).toBe(20);
    for (let i = 1; i <= 20; i++) {
      expect(registros[i].estado).toBe('DEVUELTO_PARA_CORRECCION');
      expect(registros[i].motivoRechazo).toBe('Por favor verificar cédulas y anexar padrón oficial');
      expect(registros[i].revisadoPorUsuarioId).toBe(10);
    }
  });

  it('registrarRespuestaFormularioEnStaging crea staging sin modificar expedientes oficiales', async () => {
    loteRepo.findOne.mockResolvedValue(null);
    estudianteRepo.findOne.mockResolvedValue(null);

    const formulario = {
      id: 5,
      titulo: 'Formulario de Admisión',
      carreraId: 1,
      planEstudioId: 2,
      proveedor: 'INTERNO',
      creadoPorUsuarioId: 10,
    };

    const respuesta = {
      id: 99,
      estado: 'PENDIENTE',
      datosNormalizadosJson: {
        identificacion: '401110222',
        primerNombre: 'Lucía',
        segundoNombre: 'Elena',
        primerApellido: 'Vargas',
        segundoApellido: 'Solis',
        correoEstudiantil: 'lucia.vargas@est.una.ac.cr',
        contacto: '8888-9999',
        periodoIngreso: '2026-1',
        asignaturasAprobadas: [{ planAsignaturaId: 12, codigo: 'MAT101', nombre: 'Matemática I' }],
      },
    };

    const staging = await service.registrarRespuestaFormularioEnStaging(formulario, respuesta);

    expect(staging).toBeDefined();
    expect(loteRepo.save).toHaveBeenCalled();
    expect(registroRepo.save).toHaveBeenCalled();
    // Expediente oficial NO debe haber sido modificado
    expect(estudianteRepo.save).not.toHaveBeenCalled();
    expect(estudianteRepo.update).not.toHaveBeenCalled();
  });
});

