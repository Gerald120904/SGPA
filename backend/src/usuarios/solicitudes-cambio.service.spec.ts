import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { CursosService } from '../cursos/cursos.service';
import { CursoRequisitosService } from '../cursos/curso-requisitos.service';
import { PlanesEstudioService } from '../planes-estudio/planes-estudio.service';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { AuditoriaJerarquia } from './entities/auditoria-jerarquia.entity';
import { DependenciaUsuario } from './entities/dependencia-usuario.entity';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';
import { Usuario } from './entities/usuario.entity';
import { SolicitudesCambioService } from './solicitudes-cambio.service';

describe('SolicitudesCambioService', () => {
  let solicitudes: SolicitudCambio[];
  let solicitudRepo: { save: jest.Mock; findOne: jest.Mock; find: jest.Mock };
  let alcance: { puedeEjecutar: jest.Mock; puedeAdministrarAsistente: jest.Mock };
  let estudiantes: { crearDesdeSolicitud: jest.Mock; obtenerPorId: jest.Mock;
    huellaEstudiante: jest.Mock; actualizarDesdeSolicitud: jest.Mock;
    cambiarEstadoDesdeSolicitud: jest.Mock };
  let service: SolicitudesCambioService;
  let cursos: { contextoCreacion: jest.Mock; obtenerCursoCompleto: jest.Mock;
    huellaCurso: jest.Mock; validarDelegacionCompleta: jest.Mock; crearDesdeSolicitud: jest.Mock;
    actualizarDesdeSolicitud: jest.Mock; cambiarEstadoDesdeSolicitud: jest.Mock };
  let requisitosCursos: { contextoEliminacion: jest.Mock; crearDesdeSolicitud: jest.Mock;
    eliminarDesdeSolicitud: jest.Mock };
  let planes: { validarDelegacionCompleta: jest.Mock; obtenerPlanCompleto: jest.Mock;
    huellaPlan: jest.Mock; crearDesdeSolicitud: jest.Mock; actualizarDesdeSolicitud: jest.Mock;
    cambiarEstadoDesdeSolicitud: jest.Mock };
  let planAsignaturas: {
    obtenerAsignaturaParaSolicitud: jest.Mock;
    huellaAsignatura: jest.Mock;
    crearDesdeSolicitud: jest.Mock;
    actualizarDesdeSolicitud: jest.Mock;
    cambiarEstadoDesdeSolicitud: jest.Mock;
    cargaMasivaDesdeSolicitud: jest.Mock;
  };
  let planRequisitos: {
    obtenerRelacionParaSolicitud: jest.Mock;
    crearDesdeSolicitud: jest.Mock;
    eliminarDesdeSolicitud: jest.Mock;
    cargaMasivaDesdeSolicitud: jest.Mock;
  };
  let salidasAcademicas: {
    obtenerSalidaParaSolicitud: jest.Mock;
    huellaSalida: jest.Mock;
    crearDesdeSolicitud: jest.Mock;
    actualizarDesdeSolicitud: jest.Mock;
    cambiarEstadoDesdeSolicitud: jest.Mock;
    reemplazarAsignaturasDesdeSolicitud: jest.Mock;
  };
  let planReglasOptativas: {
    obtenerReglaParaSolicitud: jest.Mock;
    huellaRegla: jest.Mock;
    guardarDesdeSolicitud: jest.Mock;
    eliminarDesdeSolicitud: jest.Mock;
  };
  let planImportacion: {
    validar: jest.Mock;
    importarDesdeSolicitud: jest.Mock;
  };
  let optativas: {
    obtenerOptativaParaSolicitud: jest.Mock;
    huellaOptativa: jest.Mock;
    validarDelegacionCompleta: jest.Mock;
    crearDesdeSolicitud: jest.Mock;
    actualizarDesdeSolicitud: jest.Mock;
    cambiarEstadoDesdeSolicitud: jest.Mock;
  };
  let estudiantesImportacion: {
    validar: jest.Mock;
    importarDesdeSolicitud: jest.Mock;
  };

  beforeEach(() => {
    solicitudes = [];
    solicitudRepo = {
      save: jest.fn(async (datos) => {
        if (!datos.id) datos.id = solicitudes.length + 1;
        const index = solicitudes.findIndex((s) => s.id === datos.id);
        if (index < 0) solicitudes.push(datos);
        else solicitudes[index] = datos;
        return datos;
      }),
      findOne: jest.fn(async ({ where }) => solicitudes.find((s) => s.id === where.id) ?? null),
      find: jest.fn(async ({ where }) => solicitudes.filter((s) =>
        Object.entries(where).every(([k, v]) => s[k as keyof SolicitudCambio] === v))),
    };
    const auditoriaRepo = { save: jest.fn(async (dato) => dato) };
    const dependenciasRepo = { findOne: jest.fn(async () => ({ coordinadorId: 1, asistenteId: 3, activo: true })) };
    const manager = { getRepository: (entidad: unknown) => entidad === SolicitudCambio ? solicitudRepo :
      entidad === Usuario ? { findOne: jest.fn().mockResolvedValue({ id: 1 }) } : auditoriaRepo };
    const dataSource = { transaction: jest.fn(async (fn) => fn(manager)) };
    alcance = {
      puedeEjecutar: jest.fn().mockResolvedValue(true),
      puedeAdministrarAsistente: jest.fn().mockResolvedValue(true),
    };
    estudiantes = {
      crearDesdeSolicitud: jest.fn().mockResolvedValue(42),
      obtenerPorId: jest.fn().mockResolvedValue({ id: 42, carreraId: 10, correoInstitucional: 'original@una.cr' }),
      huellaEstudiante: jest.fn().mockReturnValue('a'.repeat(64)),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(42),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(42),
      cambiarPlanDesdeSolicitud: jest.fn().mockResolvedValue(42),
      registrarResultadoDesdeSolicitud: jest.fn().mockResolvedValue(1001),
    };
    cursos = {
      contextoCreacion: jest.fn().mockResolvedValue({ carreraId: 10 }),
      obtenerCursoCompleto: jest.fn().mockResolvedValue({ id: 55, carreras: [{ id: 10 }], descripcion: 'Antes' }),
      huellaCurso: jest.fn().mockReturnValue('b'.repeat(64)),
      validarDelegacionCompleta: jest.fn().mockResolvedValue(undefined),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(55),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(55),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(55),
    };
    requisitosCursos = {
      contextoEliminacion: jest.fn().mockResolvedValue({ id: 9, cursoId: 55,
        requisitoCursoId: 56, tipo: 'REQUISITO' }),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(9),
      eliminarDesdeSolicitud: jest.fn().mockResolvedValue(9),
    };
    planes = {
      validarDelegacionCompleta: jest.fn().mockResolvedValue(undefined),
      obtenerPlanCompleto: jest.fn().mockResolvedValue({ id: 70, carreraId: 10, codigo: 'P-1',
        nombre: 'Plan QA', grado: 'BACHILLERATO', descripcion: null, activo: true }),
      huellaPlan: jest.fn().mockReturnValue('c'.repeat(64)),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(70),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(70),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(70),
    };
    planAsignaturas = {
      obtenerAsignaturaParaSolicitud: jest.fn().mockResolvedValue({
        id: 101, codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática I',
      }),
      huellaAsignatura: jest.fn().mockReturnValue('d'.repeat(64)),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(101),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(101),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(101),
      cargaMasivaDesdeSolicitud: jest.fn().mockResolvedValue({ total: 5 }),
    };
    planRequisitos = {
      obtenerRelacionParaSolicitud: jest.fn().mockResolvedValue({
        id: 201, asignaturaId: 101, requisitoAsignaturaId: 102, tipo: 'REQUISITO',
        asignatura: { codigoReferencia: 'MAT-2', nombreReferencia: 'Matemática II' },
        requisitoAsignatura: { codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática I' },
      }),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(201),
      eliminarDesdeSolicitud: jest.fn().mockResolvedValue(201),
      cargaMasivaDesdeSolicitud: jest.fn().mockResolvedValue({ total: 3 }),
    };
    salidasAcademicas = {
      obtenerSalidaParaSolicitud: jest.fn().mockResolvedValue({
        id: 301, codigo: 'SAL-1', nombre: 'Diplomado',
      }),
      huellaSalida: jest.fn().mockReturnValue('e'.repeat(64)),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(301),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(301),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(301),
      reemplazarAsignaturasDesdeSolicitud: jest.fn().mockResolvedValue(301),
    };
    planReglasOptativas = {
      obtenerReglaParaSolicitud: jest.fn().mockResolvedValue({
        id: 401, cantidadDisciplinarias: 3, cantidadAbiertas: 2, cantidadSede: 1,
      }),
      huellaRegla: jest.fn().mockReturnValue('f'.repeat(64)),
      guardarDesdeSolicitud: jest.fn().mockResolvedValue(401),
      eliminarDesdeSolicitud: jest.fn().mockResolvedValue(70),
    };
    planImportacion = {
      validar: jest.fn().mockResolvedValue({
        puedeImportar: true,
        valido: true,
        resumen: { asignaturas: 10, requisitos: 5, salidas: 2, asignacionesSalidas: 4 },
      }),
      importarDesdeSolicitud: jest.fn().mockResolvedValue({
        asignaturas: 10, requisitos: 5, salidas: 2, asignacionesSalidas: 4,
      }),
    };
    optativas = {
      obtenerOptativaParaSolicitud: jest.fn().mockResolvedValue({
        id: 501,
        codigo: 'EIF472',
        nombre: 'Seguridad Informática',
        tipo: 'DISCIPLINARIA',
        carreraOrigenId: 10,
        activo: true,
      }),
      huellaOptativa: jest.fn().mockReturnValue('g'.repeat(64)),
      validarDelegacionCompleta: jest.fn().mockResolvedValue(undefined),
      crearDesdeSolicitud: jest.fn().mockResolvedValue(501),
      actualizarDesdeSolicitud: jest.fn().mockResolvedValue(501),
      cambiarEstadoDesdeSolicitud: jest.fn().mockResolvedValue(501),
    };
    estudiantesImportacion = {
      validar: jest.fn().mockResolvedValue({
        resumen: { total: 2, creados: 2 },
        filas: [
          { fila: 2, accion: 'CREAR' },
          { fila: 3, accion: 'CREAR' },
        ],
      }),
      importarDesdeSolicitud: jest.fn().mockResolvedValue({
        creados: 2,
        actualizados: 0,
        aprobacionesNuevas: 0,
      }),
    };
    service = new SolicitudesCambioService(
      dataSource as unknown as DataSource,
      solicitudRepo as unknown as Repository<SolicitudCambio>,
      dependenciasRepo as unknown as Repository<DependenciaUsuario>,
      alcance as unknown as AlcanceJerarquicoService,
      estudiantes as unknown as EstudiantesService,
      cursos as unknown as CursosService,
      requisitosCursos as unknown as CursoRequisitosService,
      planes as unknown as PlanesEstudioService,
      planAsignaturas as unknown as any,
      planRequisitos as unknown as any,
      salidasAcademicas as unknown as any,
      planReglasOptativas as unknown as any,
      planImportacion as unknown as any,
      optativas as unknown as any,
      estudiantesImportacion as unknown as any,
    );
  });

  it('crea un plan solamente al aprobar la solicitud del asistente', async () => {
    const dto = { carreraId: 10, grado: 'BACHILLERATO', codigo: 'P-1', nombre: 'Plan QA' } as any;
    const solicitud = await service.proponerCrearPlan(3, dto);
    expect(solicitud.modulo).toBe('PLANES_ESTUDIO');
    expect(planes.crearDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, solicitud.id);
    expect(planes.crearDesdeSolicitud).toHaveBeenCalledWith(1, 3, dto, expect.anything());
  });

  it('aplica actualizaciÃ³n y estado de plan con su huella original', async () => {
    const actualizacion = await service.proponerActualizarPlan(3, 70, { nombre: 'Plan nuevo' });
    await service.aprobar(1, actualizacion.id);
    expect(planes.actualizarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70,
      expect.objectContaining({ nombre: 'Plan nuevo' }), 'c'.repeat(64), expect.anything());
    const estado = await service.proponerCambiarEstadoPlan(3, 70, false);
    await service.aprobar(1, estado.id);
    expect(planes.cambiarEstadoDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, false,
      'c'.repeat(64), expect.anything());
  });

  const propuesta = { carreraId: 10, cedula: '123', nombres: 'Ana', apellido1: 'Mora',
    correoInstitucional: 'ana@una.cr', planEstudioId: 4, periodoIngresoId: 2 } as any;

  it('una propuesta queda pendiente y no crea el estudiante antes de aprobarse', async () => {
    const solicitud = await service.proponerCrearEstudiante(3, propuesta);
    expect(solicitud.estado).toBe('PENDIENTE');
    expect(solicitud.coordinadorId).toBe(1);
    expect(estudiantes.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('solo el responsable aprueba y la segunda aprobación no duplica la escritura', async () => {
    await service.proponerCrearEstudiante(3, propuesta);
    await expect(service.aprobar(2, 1)).rejects.toThrow(ForbiddenException);
    const aprobada = await service.aprobar(1, 1);
    expect(aprobada.resultadoAplicado).toEqual({ estudianteId: 42 });
    expect(estudiantes.crearDesdeSolicitud).toHaveBeenCalledTimes(1);
    expect(solicitudRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 }, lock: { mode: 'pessimistic_write' } });
    await expect(service.aprobar(1, 1)).rejects.toThrow(ConflictException);
    expect(estudiantes.crearDesdeSolicitud).toHaveBeenCalledTimes(1);
  });

  it('revocación invalida la solicitud sin aplicar datos oficiales', async () => {
    await service.proponerCrearEstudiante(3, propuesta);
    alcance.puedeEjecutar.mockResolvedValue(false);
    const resultado = await service.aprobar(1, 1);
    expect(resultado.estado).toBe('INVALIDADA');
    expect(estudiantes.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('rechazo conserva el motivo y no modifica estudiantes', async () => {
    await service.proponerCrearEstudiante(3, propuesta);
    const rechazada = await service.rechazar(1, 1, 'Datos incorrectos');
    expect(rechazada.estado).toBe('RECHAZADA');
    expect(rechazada.motivoRechazo).toBe('Datos incorrectos');
    expect(estudiantes.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('la actualización del asistente queda pendiente hasta la aprobación', async () => {
    const solicitud = await service.proponerActualizarEstudiante(3, 42, { correoInstitucional: 'nuevo@una.cr' });
    expect(solicitud.operacion).toBe('ACTUALIZAR');
    expect(solicitud.huellaOriginal).toBe('a'.repeat(64));
    expect(estudiantes.actualizarDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, solicitud.id);
    expect(estudiantes.actualizarDesdeSolicitud).toHaveBeenCalledWith(1, 42, 10,
      { correoInstitucional: 'nuevo@una.cr' }, 'a'.repeat(64), expect.anything());
    expect(estudiantes.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('un conflicto de versión impide resolver o aplicar parcialmente la propuesta', async () => {
    const solicitud = await service.proponerActualizarEstudiante(3, 42, { nombres: 'Nuevo' });
    estudiantes.actualizarDesdeSolicitud.mockRejectedValue(new ConflictException('Versión obsoleta'));
    await expect(service.aprobar(1, solicitud.id)).rejects.toThrow(ConflictException);
    expect(solicitud.estado).toBe('PENDIENTE');
    expect(estudiantes.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('el estado oficial solo cambia tras aprobar la propuesta del asistente', async () => {
    const solicitud = await service.proponerCambiarEstadoEstudiante(3, 42, { estado: 'INACTIVO' as any });
    expect(solicitud.operacion).toBe('CAMBIAR_ESTADO');
    expect(estudiantes.cambiarEstadoDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, solicitud.id);
    expect(estudiantes.cambiarEstadoDesdeSolicitud).toHaveBeenCalledWith(1, 42, 10,
      'INACTIVO', 'a'.repeat(64), expect.anything());
  });

  it('la creación de curso queda pendiente y solo se aplica por su coordinador', async () => {
    const solicitud = await service.proponerCrearCurso(3, { planAsignaturaId: 17, descripcion: 'Curso' });
    expect(solicitud.modulo).toBe('CURSOS');
    expect(solicitud.datosPropuestos.carrerasAfectadas).toEqual([10]);
    expect(cursos.crearDesdeSolicitud).not.toHaveBeenCalled();
    await expect(service.aprobar(2, solicitud.id)).rejects.toThrow(ForbiddenException);
    const aprobada = await service.aprobar(1, solicitud.id);
    expect(aprobada.resultadoAplicado).toEqual({ cursoId: 55 });
    expect(cursos.crearDesdeSolicitud).toHaveBeenCalledTimes(1);
    await expect(service.aprobar(1, solicitud.id)).rejects.toThrow(ConflictException);
  });

  it('rechazar un curso no aplica cambios oficiales', async () => {
    const solicitud = await service.proponerActualizarCurso(3, 55, { descripcion: 'Nueva' });
    await service.rechazar(1, solicitud.id, 'No procede');
    expect(cursos.actualizarDesdeSolicitud).not.toHaveBeenCalled();
    expect(solicitud.estado).toBe('RECHAZADA');
  });

  it('revocar un permiso invalida la solicitud de curso antes de aplicar', async () => {
    const solicitud = await service.proponerCambiarEstadoCurso(3, 55, false);
    alcance.puedeEjecutar.mockResolvedValue(false);
    const resultado = await service.aprobar(1, solicitud.id);
    expect(resultado.estado).toBe('INVALIDADA');
    expect(cursos.cambiarEstadoDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('la edición de curso compartido guarda todas las carreras y aplica solo tras aprobar', async () => {
    cursos.obtenerCursoCompleto.mockResolvedValue({ id: 55, codigo: 'EIF201', nombre: 'Curso',
      descripcion: 'Anterior', carreras: [{ id: 10 }, { id: 20 }] });
    const solicitud = await service.proponerActualizarCurso(3, 55, { descripcion: 'Nueva' });
    expect(cursos.validarDelegacionCompleta).toHaveBeenCalledWith(1, 3, [10, 20]);
    expect(solicitud.datosPropuestos.carrerasAfectadas).toEqual([10, 20]);
    expect(cursos.actualizarDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, solicitud.id);
    expect(cursos.actualizarDesdeSolicitud).toHaveBeenCalledTimes(1);
  });

  it('el requisito propuesto no se escribe hasta aprobarlo y conserva la misma solicitud', async () => {
    const solicitud = await service.proponerAgregarRequisitoCurso(3, 55,
      { requisitoCursoId: 56, tipo: 'REQUISITO' as any });
    expect(solicitud.operacion).toBe('AGREGAR_REQUISITO');
    expect(requisitosCursos.crearDesdeSolicitud).not.toHaveBeenCalled();
    const aprobada = await service.aprobar(1, solicitud.id);
    expect(aprobada.resultadoAplicado).toEqual({ cursoId: 55, relacionId: 9 });
    expect(requisitosCursos.crearDesdeSolicitud).toHaveBeenCalledTimes(1);
  });

  it('la eliminación propuesta conserva el requisito mientras está pendiente', async () => {
    const solicitud = await service.proponerEliminarRequisitoCurso(3, 55, 9);
    expect(solicitud.operacion).toBe('ELIMINAR_REQUISITO');
    expect(requisitosCursos.eliminarDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, solicitud.id);
    expect(requisitosCursos.eliminarDesdeSolicitud).toHaveBeenCalledTimes(1);
  });

  it('agrega asignatura del plan solo tras aprobar propuesta y bloquea concurrencia', async () => {
    const dto = { nivel: 1, ciclo: 1, creditos: 4, tipo: 'REGULAR', codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática I' } as any;
    const solicitud = await service.proponerAgregarAsignatura(3, 70, dto);
    expect(solicitud.modulo).toBe('PLANES_ESTUDIO');
    expect(solicitud.operacion).toBe('AGREGAR_ASIGNATURA');
    expect(solicitud.estado).toBe('PENDIENTE');
    expect(planAsignaturas.crearDesdeSolicitud).not.toHaveBeenCalled();

    const aprobada = await service.aprobar(1, solicitud.id);
    expect(aprobada.resultadoAplicado).toEqual({ planId: 70, asignaturaId: 101 });
    expect(planAsignaturas.crearDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.objectContaining(dto), expect.anything());
  });

  it('actualiza y cambia estado de asignatura del plan con huella original', async () => {
    const actuDto = { creditos: 5 } as any;
    const actu = await service.proponerActualizarAsignatura(3, 70, 101, actuDto);
    expect(actu.huellaOriginal).toBe('d'.repeat(64));
    expect(planAsignaturas.actualizarDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, actu.id);
    expect(planAsignaturas.actualizarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 101, expect.objectContaining(actuDto), 'd'.repeat(64), expect.anything());

    const estado = await service.proponerCambiarEstadoAsignatura(3, 70, 101, false);
    expect(planAsignaturas.cambiarEstadoDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, estado.id);
    expect(planAsignaturas.cambiarEstadoDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 101, false, 'd'.repeat(64), expect.anything());
  });

  it('carga masiva de asignaturas del plan aplica solo al aprobar', async () => {
    const dto = { asignaturas: [{ nivel: 1, ciclo: 1, orden: 1, creditos: 4, tipo: 'REGULAR', codigoReferencia: 'C1', nombreReferencia: 'N1' }] } as any;
    const solicitud = await service.proponerCargaMasivaAsignaturas(3, 70, dto);
    expect(solicitud.operacion).toBe('CARGA_MASIVA_ASIGNATURAS');
    expect(planAsignaturas.cargaMasivaDesdeSolicitud).not.toHaveBeenCalled();
    const res = await service.aprobar(1, solicitud.id);
    expect(res.resultadoAplicado).toEqual({ planId: 70, totalAsignaturas: 5 });
    expect(planAsignaturas.cargaMasivaDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());
  });

  it('agrega, elimina y carga masivamente requisitos del plan mediante solicitudes transaccionales', async () => {
    const agregar = await service.proponerAgregarRequisitoPlan(3, 70, { asignaturaId: 101, requisitoAsignaturaId: 102, tipo: 'REQUISITO' as any });
    expect(agregar.operacion).toBe('AGREGAR_REQUISITO');
    expect(planRequisitos.crearDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, agregar.id);
    expect(planRequisitos.crearDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());

    const eliminar = await service.proponerEliminarRequisitoPlan(3, 70, 201);
    expect(eliminar.operacion).toBe('ELIMINAR_REQUISITO');
    expect(planRequisitos.eliminarDesdeSolicitud).not.toHaveBeenCalled();
    await service.aprobar(1, eliminar.id);
    expect(planRequisitos.eliminarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 201, expect.objectContaining({ asignaturaId: 101, requisitoAsignaturaId: 102 }), expect.anything());

    const masiva = await service.proponerCargaMasivaRequisitosPlan(3, 70, { requisitos: [] } as any);
    await service.aprobar(1, masiva.id);
    expect(planRequisitos.cargaMasivaDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());
  });

  it('gestiona salidas académicas y sus asignaturas mediante propuestas aprobables', async () => {
    const crear = await service.proponerCrearSalida(3, 70, { codigo: 'SAL-1', nombre: 'Diplomado', tipo: 'DIPLOMADO' as any, creditosRequeridos: 60, orden: 1 });
    expect(crear.operacion).toBe('CREAR_SALIDA');
    await service.aprobar(1, crear.id);
    expect(salidasAcademicas.crearDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());

    const actu = await service.proponerActualizarSalida(3, 70, 301, { nombre: 'Nuevo diplomado' });
    expect(actu.huellaOriginal).toBe('e'.repeat(64));
    await service.aprobar(1, actu.id);
    expect(salidasAcademicas.actualizarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 301, expect.anything(), 'e'.repeat(64), expect.anything());

    const estado = await service.proponerCambiarEstadoSalida(3, 70, 301, false);
    await service.aprobar(1, estado.id);
    expect(salidasAcademicas.cambiarEstadoDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 301, false, 'e'.repeat(64), expect.anything());

    const asignar = await service.proponerAsignarAsignaturasSalida(3, 70, 301, { asignaturaIds: [101, 102] });
    await service.aprobar(1, asignar.id);
    expect(salidasAcademicas.reemplazarAsignaturasDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, 301, expect.anything(), expect.anything());
  });

  it('gestiona reglas optativas del plan mediante propuestas', async () => {
    const guardar = await service.proponerGuardarReglaOptativa(3, 70, { cantidadDisciplinarias: 4, cantidadAbiertas: 2, cantidadSede: 1 });
    expect(guardar.operacion).toBe('GUARDAR_REGLA_OPTATIVA');
    expect(guardar.huellaOriginal).toBe('f'.repeat(64));
    await service.aprobar(1, guardar.id);
    expect(planReglasOptativas.guardarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());

    const eliminar = await service.proponerEliminarReglaOptativa(3, 70);
    expect(eliminar.operacion).toBe('ELIMINAR_REGLA_OPTATIVA');
    await service.aprobar(1, eliminar.id);
    expect(planReglasOptativas.eliminarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything());
  });

  it('importación masiva del plan pre-valida y aplica atómicamente al aprobar', async () => {
    const dto = { asignaturas: [], requisitos: [], salidas: [], salidaAsignaturas: [] } as any;
    const solicitud = await service.proponerImportarPlan(3, 70, dto);
    expect(solicitud.operacion).toBe('IMPORTAR_PLAN');
    expect(planImportacion.validar).toHaveBeenCalledWith(70, dto);
    expect(planImportacion.importarDesdeSolicitud).not.toHaveBeenCalled();

    const aprobada = await service.aprobar(1, solicitud.id);
    expect(aprobada.resultadoAplicado).toEqual(expect.objectContaining({ planId: 70, asignaturas: 10 }));
    expect(planImportacion.importarDesdeSolicitud).toHaveBeenCalledWith(1, 3, 70, expect.anything(), expect.anything());
  });

  it('rechazo de propuesta de asignatura conserva datos oficiales intactos', async () => {
    const dto = { nivel: 1, ciclo: 1, creditos: 4, tipo: 'REGULAR', codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática I' } as any;
    const solicitud = await service.proponerAgregarAsignatura(3, 70, dto);
    await service.rechazar(1, solicitud.id, 'No cumple requisitos curriculares');
    expect(planAsignaturas.crearDesdeSolicitud).not.toHaveBeenCalled();
    expect(solicitud.estado).toBe('RECHAZADA');
    expect(solicitud.motivoRechazo).toBe('No cumple requisitos curriculares');
  });

  it('revocación de permiso de planes invalida la solicitud sin aplicar', async () => {
    const dto = { nivel: 1, ciclo: 1, creditos: 4, tipo: 'REGULAR', codigoReferencia: 'MAT-1', nombreReferencia: 'Matemática I' } as any;
    const solicitud = await service.proponerAgregarAsignatura(3, 70, dto);
    alcance.puedeEjecutar.mockResolvedValue(false);
    const resultado = await service.aprobar(1, solicitud.id);
    expect(resultado.estado).toBe('INVALIDADA');
    expect(planAsignaturas.crearDesdeSolicitud).not.toHaveBeenCalled();
  });

  it('gestiona optativas disciplinarias mediante propuestas y aprobaciones atómicas', async () => {
    const dtoCrear = {
      codigo: 'EIF472',
      nombre: 'Seguridad Informática',
      tipo: 'DISCIPLINARIA',
      carreraOrigenId: 10,
    } as any;
    const crear = await service.proponerCrearOptativa(3, dtoCrear);
    expect(crear.operacion).toBe('CREAR');
    expect(crear.carreraId).toBe(10);
    expect(optativas.crearDesdeSolicitud).not.toHaveBeenCalled();

    await service.aprobar(1, crear.id);
    expect(optativas.crearDesdeSolicitud).toHaveBeenCalledWith(expect.anything(), 10, dtoCrear);

    const actu = await service.proponerActualizarOptativa(3, 501, { nombre: 'Seguridad de Redes' });
    expect(actu.operacion).toBe('ACTUALIZAR');
    expect(actu.huellaOriginal).toBe('g'.repeat(64));
    await service.aprobar(1, actu.id);
    expect(optativas.actualizarDesdeSolicitud).toHaveBeenCalledWith(
      expect.anything(),
      10,
      501,
      expect.objectContaining({ nombre: 'Seguridad de Redes' }),
      'g'.repeat(64),
    );

    const estado = await service.proponerCambiarEstadoOptativa(3, 501, false);
    expect(estado.operacion).toBe('CAMBIAR_ESTADO');
    await service.aprobar(1, estado.id);
    expect(optativas.cambiarEstadoDesdeSolicitud).toHaveBeenCalledWith(
      expect.anything(),
      10,
      501,
      false,
      'g'.repeat(64),
    );
  });

  it('gestiona cambio de plan, resultado académico e importación de estudiantes mediante propuestas', async () => {
    // 1. Cambio de plan
    const dtoPlan = { planNuevoId: 70, periodoCambioId: 5, motivo: 'Traslado vocacional' } as any;
    const cambioPlan = await service.proponerCambiarPlanEstudiante(3, 42, dtoPlan);
    expect(cambioPlan.operacion).toBe('CAMBIAR_PLAN');
    expect(cambioPlan.huellaOriginal).toBe('a'.repeat(64));
    await service.aprobar(1, cambioPlan.id);
    expect(estudiantes.cambiarPlanDesdeSolicitud).toHaveBeenCalledWith(
      1,
      42,
      10,
      expect.objectContaining({ planNuevoId: 70 }),
      'a'.repeat(64),
      expect.anything(),
    );

    // 2. Resultado académico
    const dtoRes = { planAsignaturaId: 101, periodoId: 5, resultado: 'APROBADO', origenAcademico: 'REGULAR' } as any;
    const resultado = await service.proponerRegistrarResultadoEstudiante(3, 42, dtoRes);
    expect(resultado.operacion).toBe('REGISTRAR_RESULTADO');
    expect(resultado.huellaOriginal).toBe('a'.repeat(64));
    await service.aprobar(1, resultado.id);
    expect(estudiantes.registrarResultadoDesdeSolicitud).toHaveBeenCalledWith(
      1,
      42,
      10,
      expect.objectContaining({ planAsignaturaId: 101 }),
      'a'.repeat(64),
      expect.anything(),
    );

    // 3. Importación masiva de estudiantes
    const dtoImp = { carreraId: 10, planEstudioId: 70, estudiantes: [{ fila: 2, accion: 'CREAR' }] } as any;
    const importacion = await service.proponerImportarEstudiantes(3, dtoImp);
    expect(importacion.operacion).toBe('IMPORTAR_ESTUDIANTES');
    expect(estudiantesImportacion.validar).toHaveBeenCalledWith(3, dtoImp);
    await service.aprobar(1, importacion.id);
    expect(estudiantesImportacion.importarDesdeSolicitud).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ carreraId: 10, planEstudioId: 70 }),
      expect.anything(),
    );
  });
});
