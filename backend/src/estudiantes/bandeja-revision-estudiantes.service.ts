import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Like, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { EstadoEstudiante } from './constants/estado-estudiante.constant';
import { FuenteRegistroAcademico } from './constants/fuente-registro-academico.constant';
import { OrigenAcademico } from './constants/origen-academico.constant';
import { ResultadoAcademico } from './constants/resultado-academico.constant';
import { AprobarRevisionMasivaDto } from './dto/aprobar-revision-masiva.dto';
import { FiltrarBandejaRevisionDto } from './dto/filtrar-bandeja-revision.dto';
import { ImportarEstudiantesDto } from './dto/importar-estudiantes.dto';
import { ProponerRevisionBandejaDto } from './dto/proponer-revision-bandeja.dto';
import { RechazarRevisionMasivaDto } from './dto/rechazar-revision-masiva.dto';
import { Estudiante } from './entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from './entities/historial-academico-estudiante.entity';
import { LoteImportacionEstudiante } from './entities/lote-importacion-estudiante.entity';
import { RegistroImportacionEstudiante } from './entities/registro-importacion-estudiante.entity';
import { EstudiantesImportacionService } from './estudiantes-importacion.service';
import { crearDatosResultadoImportado } from './resultado-importado.factory';

@Injectable()
export class BandejaRevisionEstudiantesService {
  constructor(
    @InjectRepository(LoteImportacionEstudiante)
    private readonly loteRepo: Repository<LoteImportacionEstudiante>,
    @InjectRepository(RegistroImportacionEstudiante)
    private readonly registroRepo: Repository<RegistroImportacionEstudiante>,
    @InjectRepository(Estudiante)
    private readonly estudianteRepo: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialRepo: Repository<HistorialAcademicoEstudiante>,
    @InjectRepository(Carrera)
    private readonly carreraRepo: Repository<Carrera>,
    @InjectRepository(PlanEstudio)
    private readonly planRepo: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,
    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepo: Repository<PeriodoAcademico>,
    private readonly importacionService: EstudiantesImportacionService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly alcanceJerarquico?: AlcanceJerarquicoService,
  ) {}

  private async validarLecturaCarrera(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo) {
        const puede = await this.alcanceJerarquico.puedeEjecutar(
          usuarioId,
          PermisoSistema.ESTUDIANTES_VER,
          carreraId,
        );
        if (!puede) throw new ForbiddenException('No posee permisos de lectura sobre la carrera indicada.');
        return;
      }
    }
    const tiene = await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(usuarioId, carreraId);
    if (!tiene) throw new ForbiddenException('No posee alcance académico sobre la carrera indicada.');
  }

  private async validarEscrituraCarrera(usuarioId: number, carreraId: number): Promise<void> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException(
          'El asistente estudiantil no puede aprobar o rechazar directamente. Debe registrar una propuesta jerárquica.',
        );
      }
      if (tipo === 'COORDINADOR') {
        const puede = await this.alcanceJerarquico.puedeEjecutar(
          usuarioId,
          PermisoSistema.ESTUDIANTES_GESTIONAR,
          carreraId,
        );
        if (!puede) throw new ForbiddenException('No posee permiso de gestión sobre la carrera indicada.');
        return;
      }
    }
    const tiene = await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(usuarioId, carreraId);
    if (!tiene) throw new ForbiddenException('No posee alcance administrativo sobre la carrera indicada.');
  }

  async cargarLoteExcel(
    usuarioId: number,
    dto: ImportarEstudiantesDto,
    nombreArchivo?: string,
  ): Promise<{ loteId: number; resumen: any; totalFilas: number; mensaje: string }> {
    await this.validarLecturaCarrera(usuarioId, dto.carreraId);

    // Valida las filas utilizando el motor existente de validación
    const validacion = await this.importacionService.validar(usuarioId, dto);
    const filas = validacion.filas;

    const lote = await this.dataSource.transaction(async (manager) => {
      const loteNuevo = manager.getRepository(LoteImportacionEstudiante).create({
        carreraId: dto.carreraId,
        planEstudioId: dto.planEstudioId,
        fuente: FuenteRegistroAcademico.EXCEL,
        nombreArchivo: nombreArchivo || 'importacion.xlsx',
        totalFilas: filas.length,
        totalValidas: filas.filter((f) => f.accion !== 'ERROR').length,
        totalErrores: filas.filter((f) => f.accion === 'ERROR').length,
        estado: 'PENDIENTE',
        creadoPorUsuarioId: usuarioId,
      });
      const loteGuardado = await manager.getRepository(LoteImportacionEstudiante).save(loteNuevo);

      const regRepo = manager.getRepository(RegistroImportacionEstudiante);
      for (const fila of filas) {
        let datosExistentes: Record<string, unknown> | null = null;
        if (fila.estudianteId) {
          const actual = await manager.getRepository(Estudiante).findOne({
            where: { id: fila.estudianteId },
          });
          if (actual) {
            datosExistentes = {
              id: actual.id,
              cedula: actual.cedula,
              nombres: actual.nombres,
              apellido1: actual.apellido1,
              apellido2: actual.apellido2,
              correoInstitucional: actual.correoInstitucional,
              telefono: actual.telefono,
              estado: actual.estado,
            };
          }
        }

        const registro = regRepo.create({
          loteId: loteGuardado.id,
          carreraId: dto.carreraId,
          planEstudioId: dto.planEstudioId,
          fila: fila.fila,
          cedula: fila.cedula,
          accion: fila.accion,
          datosJson: {
            ...fila.datos,
            periodoIngresoCodigo: dto.estudiantes.find((e) => e.fila === fila.fila)?.periodoIngresoCodigo || '',
            periodoIngresoId: fila.periodoIngresoId,
            asignaturasAprobadas: fila.aprobacionesNuevas.map((a) => a.codigo),
          },
          datosExistentesJson: datosExistentes,
          cambiosDetectadosJson: fila.cambiosDatos && fila.cambiosDatos.length ? fila.cambiosDatos : null,
          aprobacionesNuevasJson: fila.aprobacionesNuevas && fila.aprobacionesNuevas.length ? fila.aprobacionesNuevas : null,
          erroresJson: fila.errores && fila.errores.length ? fila.errores : null,
          estado: fila.accion === 'ERROR' ? 'REQUIERE_REVISION' : 'PENDIENTE',
          motivoRechazo: null,
          revisadoPorUsuarioId: null,
          revisadoEn: null,
          estudianteIdAplicado: null,
        });

        await regRepo.save(registro);
      }

      return loteGuardado;
    });

    return {
      loteId: lote.id,
      resumen: validacion.resumen,
      totalFilas: filas.length,
      mensaje:
        'Los registros fueron cargados exitosamente en la bandeja de revisión y están pendientes de aprobación oficial.',
    };
  }

  async listarBandeja(usuarioId: number, filtros: FiltrarBandejaRevisionDto) {
    const tipo = this.alcanceJerarquico ? await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId) : null;
    const carrerasPermitidas = tipo && this.alcanceJerarquico
      ? (await Promise.all((await this.alcanceJerarquico.obtenerCarrerasAutorizadas(usuarioId))
          .map(async (id) => (await this.alcanceJerarquico!.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_VER, id)) ? id : null)))
          .filter((id): id is number => id !== null)
      : await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(usuarioId);

    if (!carrerasPermitidas.length || (filtros.carreraId && !carrerasPermitidas.includes(filtros.carreraId))) {
      return [];
    }

    const qb = this.registroRepo.createQueryBuilder('reg')
      .leftJoinAndSelect('reg.carrera', 'carrera')
      .leftJoinAndSelect('reg.planEstudio', 'planEstudio')
      .leftJoinAndSelect('reg.lote', 'lote')
      .leftJoinAndSelect('reg.revisadoPor', 'revisadoPor')
      .where('reg.carreraId IN (:...carreraIds)', {
        carreraIds: filtros.carreraId ? [filtros.carreraId] : carrerasPermitidas,
      });

    if (filtros.planEstudioId) {
      qb.andWhere('reg.planEstudioId = :planEstudioId', { planEstudioId: filtros.planEstudioId });
    }

    if (filtros.estado) {
      qb.andWhere('reg.estado = :estado', { estado: filtros.estado });
    } else {
      qb.andWhere('reg.estado IN (:...estadosPendientes)', {
        estadosPendientes: ['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'],
      });
    }

    if (filtros.fuente) {
      qb.andWhere('lote.fuente = :fuente', { fuente: filtros.fuente });
    }

    if (filtros.texto?.trim()) {
      const t = `%${filtros.texto.trim()}%`;
      qb.andWhere(
        '(reg.cedula LIKE :texto OR JSON_UNQUOTE(JSON_EXTRACT(reg.datosJson, "$.nombres")) LIKE :texto OR JSON_UNQUOTE(JSON_EXTRACT(reg.datosJson, "$.apellido1")) LIKE :texto OR JSON_UNQUOTE(JSON_EXTRACT(reg.datosJson, "$.correoInstitucional")) LIKE :texto)',
        { texto: t },
      );
    }

    qb.orderBy('reg.createdAt', 'DESC').addOrderBy('reg.fila', 'ASC');

    const registros = await qb.getMany();

    return registros.map((r) => ({
      id: r.id,
      loteId: r.loteId,
      fila: r.fila,
      cedula: r.cedula,
      nombreCompleto: [r.datosJson.nombres, r.datosJson.apellido1, r.datosJson.apellido2].filter(Boolean).join(' '),
      correoInstitucional: r.datosJson.correoInstitucional,
      telefono: r.datosJson.telefono,
      carreraId: r.carreraId,
      carreraNombre: r.carrera?.nombre || '—',
      carreraCodigo: r.carrera?.codigo || '—',
      planEstudioId: r.planEstudioId,
      planNombre: r.planEstudio?.nombre || '—',
      fuente: r.lote?.fuente || 'EXCEL',
      accion: r.accion,
      estado: r.estado,
      motivoRechazo: r.motivoRechazo,
      cambiosDetectados: r.cambiosDetectadosJson || [],
      aprobacionesNuevas: r.aprobacionesNuevasJson || [],
      errores: r.erroresJson || [],
      revisadoPor: r.revisadoPor
        ? { id: r.revisadoPor.id, nombre: `${r.revisadoPor.nombres} ${r.revisadoPor.apellido1}` }
        : null,
      revisadoEn: r.revisadoEn,
      createdAt: r.createdAt,
    }));
  }

  async obtenerDetalleRegistro(usuarioId: number, id: number) {
    const registro = await this.registroRepo.findOne({
      where: { id },
      relations: {
        carrera: true,
        planEstudio: true,
        lote: true,
        revisadoPor: true,
      },
    });

    if (!registro) throw new NotFoundException('Registro de importación no encontrado.');
    await this.validarLecturaCarrera(usuarioId, registro.carreraId);

    let estudianteActual: Estudiante | null = null;
    if (registro.cedula) {
      estudianteActual = await this.estudianteRepo.findOne({
        where: { carreraId: registro.carreraId, cedula: registro.cedula },
        relations: { planEstudio: true, periodoIngreso: true },
      });
    }

    return {
      registro,
      estudianteActual,
      esNuevo: !estudianteActual,
      cambiosPropuestos: registro.cambiosDetectadosJson || [],
      aprobacionesPropuestas: registro.aprobacionesNuevasJson || [],
      erroresValidacion: registro.erroresJson || [],
    };
  }

  async aprobarMasivo(
    usuarioId: number,
    dto: AprobarRevisionMasivaDto,
  ): Promise<{ solicitados: number; aprobados: number; fallidos: Array<{ id: number; error: string }> }> {
    const fallidos: Array<{ id: number; error: string }> = [];
    let aprobados = 0;

    for (const id of dto.registroIds) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const regRepo = manager.getRepository(RegistroImportacionEstudiante);
          const estRepo = manager.getRepository(Estudiante);
          const histRepo = manager.getRepository(HistorialAcademicoEstudiante);
          // Bloqueo pesimista para evitar procesamiento concurrente doble.
          const registro = await regRepo.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });

          if (!registro) throw new NotFoundException('Registro no encontrado.');

          if (!['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(registro.estado)) {
            throw new ConflictException(`El registro ya se encuentra en estado ${registro.estado}.`);
          }

          await this.validarEscrituraCarrera(usuarioId, registro.carreraId);

          let estudianteId: number;

          if (registro.accion === 'CREAR') {
            // Revalida duplicados
            const duplicado = await estRepo.findOne({
              where: { carreraId: registro.carreraId, cedula: registro.cedula },
            });
            if (duplicado) {
              // Si ya fue creado por otra vía concurrente, pasa a actualizar
              registro.accion = 'ACTUALIZAR';
              estudianteId = duplicado.id;
              await estRepo.update(estudianteId, {
                nombres: registro.datosJson.nombres,
                apellido1: registro.datosJson.apellido1,
                apellido2: registro.datosJson.apellido2,
                correoInstitucional: registro.datosJson.correoInstitucional,
                telefono: registro.datosJson.telefono,
              });
            } else {
              const planRepo = manager.getRepository(PlanEstudio);
              const plan = await planRepo.findOne({ where: { id: registro.planEstudioId } });
              let esEnTransicion = (plan as any)?.estado === 'EN_TRANSICION';
              if (!esEnTransicion && this.dataSource && typeof this.dataSource.query === 'function') {
                try {
                  const ult = await this.dataSource.query(
                    "SELECT valor_nuevo FROM auditoria_planes_estudio WHERE plan_estudio_id = ? AND tipo_modificacion IN ('CAMBIO_ESTADO', 'CIERRE', 'REAPERTURA') ORDER BY id DESC LIMIT 1",
                    [registro.planEstudioId],
                  );
                  if (ult?.[0]?.valor_nuevo === 'EN_TRANSICION') {
                    esEnTransicion = true;
                  }
                } catch {}
              }
              if (esEnTransicion) {
                throw new BadRequestException(
                  'El plan de estudio se encuentra EN TRANSICIÓN. No se admiten nuevos ingresos ordinarios.',
                );
              }

              const guardado = await estRepo.save(
                estRepo.create({
                  cedula: registro.cedula,
                  nombres: registro.datosJson.nombres,
                  apellido1: registro.datosJson.apellido1,
                  apellido2: registro.datosJson.apellido2,
                  correoInstitucional: registro.datosJson.correoInstitucional,
                  telefono: registro.datosJson.telefono,
                  carreraId: registro.carreraId,
                  planEstudioId: registro.planEstudioId,
                  periodoIngresoId: registro.datosJson.periodoIngresoId || 1,
                  estado: EstadoEstudiante.ACTIVO,
                }),
              );
              estudianteId = guardado.id;
            }
          } else {
            // ACTUALIZAR
            const existente = await estRepo.findOne({
              where: { carreraId: registro.carreraId, cedula: registro.cedula },
            });
            if (!existente) {
              throw new ConflictException('No se encontró el estudiante existente a actualizar.');
            }
            if (existente.estado === EstadoEstudiante.GRADUADO) {
              throw new ConflictException('No se puede actualizar el expediente de un estudiante graduado.');
            }
            estudianteId = existente.id;
            await estRepo.update(estudianteId, {
              nombres: registro.datosJson.nombres,
              apellido1: registro.datosJson.apellido1,
              apellido2: registro.datosJson.apellido2,
              correoInstitucional: registro.datosJson.correoInstitucional,
              telefono: registro.datosJson.telefono,
            });
          }

          // Aprobaciones académicas
          if (registro.aprobacionesNuevasJson && registro.aprobacionesNuevasJson.length > 0) {
            for (const apr of registro.aprobacionesNuevasJson) {
              const yaRegistrada = await histRepo.findOne({
                where: {
                  estudianteId,
                  planAsignaturaId: apr.planAsignaturaId,
                  resultado: ResultadoAcademico.APROBADO,
                },
              });
              if (!yaRegistrada) {
                const datosAprobacion = crearDatosResultadoImportado({
                  estudianteId,
                  planAsignaturaId: apr.planAsignaturaId,
                  periodoId: null,
                  resultado: ResultadoAcademico.APROBADO,
                  fuenteRegistro: FuenteRegistroAcademico.EXCEL,
                  registradoPorUsuarioId: usuarioId,
                });
                await histRepo.save(histRepo.create(datosAprobacion));
              }
            }
          }

          registro.estado = 'APROBADO';
          registro.revisadoPorUsuarioId = usuarioId;
          registro.revisadoEn = new Date();
          registro.estudianteIdAplicado = estudianteId;
          await regRepo.save(registro);

          if (registro.datosJson?.formularioRespuestaId) {
            await manager.query(
              `DELETE FROM solicitudes_activas_estudiantes WHERE referencia_id = ?`,
              [registro.datosJson.formularioRespuestaId],
            );
          }
        });
        aprobados += 1;
      } catch (err: any) {
        fallidos.push({ id, error: err?.message || 'Error al aplicar el registro.' });
      }
    }

    return {
      solicitados: dto.registroIds.length,
      aprobados,
      fallidos,
    };
  }

  async rechazarMasivo(
    usuarioId: number,
    dto: RechazarRevisionMasivaDto,
  ): Promise<{ solicitados: number; rechazados: number; fallidos: Array<{ id: number; error: string }> }> {
    const fallidos: Array<{ id: number; error: string }> = [];
    let rechazados = 0;

    await this.dataSource.transaction(async (manager) => {
      const regRepo = manager.getRepository(RegistroImportacionEstudiante);

      for (const item of dto.rechazos) {
        if (!item.motivo || item.motivo.trim().length < 3) {
          fallidos.push({ id: item.id, error: 'Motivo de rechazo inválido o insuficiente.' });
          continue;
        }

        const registro = await regRepo.findOne({
          where: { id: item.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!registro) {
          fallidos.push({ id: item.id, error: 'Registro no encontrado.' });
          continue;
        }

        if (!['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(registro.estado)) {
          fallidos.push({ id: item.id, error: `El registro ya está en estado ${registro.estado}.` });
          continue;
        }

        try {
          await this.validarEscrituraCarrera(usuarioId, registro.carreraId);

          registro.estado = 'RECHAZADO';
          registro.motivoRechazo = item.motivo.trim();
          registro.revisadoPorUsuarioId = usuarioId;
          registro.revisadoEn = new Date();
          await regRepo.save(registro);

          if (registro.datosJson?.formularioRespuestaId) {
            await manager.query(
              `UPDATE respuestas_formularios_estudiantes SET estado = 'RECHAZADO', motivo_rechazo = ?, revisado_por_usuario_id = ?, revisado_at = NOW() WHERE id = ?`,
              [item.motivo.trim(), usuarioId, registro.datosJson.formularioRespuestaId],
            );

            await manager.query(
              `DELETE FROM solicitudes_activas_estudiantes WHERE referencia_id = ?`,
              [registro.datosJson.formularioRespuestaId],
            );
          }

          rechazados += 1;
        } catch (err: any) {
          throw err;
        }
      }
    });

    return {
      solicitados: dto.rechazos.length,
      rechazados,
      fallidos,
    };
  }

  async aprobarIndividual(
    usuarioId: number,
    id: number,
    motivo?: string,
  ): Promise<{ id: number; estado: string; revisadoPorUsuarioId: number; revisadoEn: Date }> {
    const res = await this.aprobarMasivo(usuarioId, { registroIds: [id] });
    if (res.fallidos.length > 0) {
      throw new BadRequestException(res.fallidos[0].error);
    }
    const reg = await this.registroRepo.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registro no encontrado.');
    return {
      id: reg.id,
      estado: reg.estado,
      revisadoPorUsuarioId: reg.revisadoPorUsuarioId!,
      revisadoEn: reg.revisadoEn!,
    };
  }

  async rechazarIndividual(
    usuarioId: number,
    id: number,
    motivo: string,
  ): Promise<{ id: number; estado: string; revisadoPorUsuarioId: number; revisadoEn: Date }> {
    if (!motivo || motivo.trim().length < 3) {
      throw new BadRequestException('El motivo de rechazo debe tener al menos 3 caracteres.');
    }
    const res = await this.rechazarMasivo(usuarioId, { rechazos: [{ id, motivo: motivo.trim() }] });
    if (res.fallidos.length > 0) {
      throw new BadRequestException(res.fallidos[0].error);
    }
    const reg = await this.registroRepo.findOne({ where: { id } });
    if (!reg) throw new NotFoundException('Registro no encontrado.');
    return {
      id: reg.id,
      estado: reg.estado,
      revisadoPorUsuarioId: reg.revisadoPorUsuarioId!,
      revisadoEn: reg.revisadoEn!,
    };
  }

  async devolverPropuesta(
    usuarioId: number,
    registroIds: number[],
    observacion: string,
  ): Promise<{ devueltos: number }> {
    if (!observacion || !observacion.trim()) {
      throw new BadRequestException('Debe indicar una observación para la devolución.');
    }

    let devueltos = 0;
    await this.dataSource.transaction(async (manager) => {
      const regRepo = manager.getRepository(RegistroImportacionEstudiante);
      for (const id of registroIds) {
        const registro = await regRepo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (registro && ['PENDIENTE', 'REQUIERE_REVISION'].includes(registro.estado)) {
          await this.validarEscrituraCarrera(usuarioId, registro.carreraId);
          registro.estado = 'DEVUELTO_PARA_CORRECCION';
          registro.motivoRechazo = observacion.trim();
          registro.revisadoPorUsuarioId = usuarioId;
          registro.revisadoEn = new Date();
          await regRepo.save(registro);
          devueltos++;
        }
      }
    });

    return { devueltos };
  }

  async aplicarRevisionDesdeSolicitud(
    coordinadorId: number,
    dto: ProponerRevisionBandejaDto,
    manager: EntityManager,
  ): Promise<{ solicitados: number; aprobados: number; rechazados: number; fallidos: Array<{ id: number; error: string }> }> {
    await this.validarEscrituraCarrera(coordinadorId, dto.carreraId);

    const fallidos: Array<{ id: number; error: string }> = [];
    let aprobados = 0;
    let rechazados = 0;

    const regRepo = manager.getRepository(RegistroImportacionEstudiante);
    const estRepo = manager.getRepository(Estudiante);
    const histRepo = manager.getRepository(HistorialAcademicoEstudiante);

    // 1. Procesar aprobaciones
    for (const id of dto.aprobarRegistroIds || []) {
      const registro = await regRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!registro) {
        fallidos.push({ id, error: 'Registro no encontrado.' });
        continue;
      }

      if (registro.carreraId !== dto.carreraId) {
        fallidos.push({ id, error: 'El registro no pertenece a la carrera de la solicitud.' });
        continue;
      }

      if (!['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(registro.estado)) {
        fallidos.push({ id, error: `El registro ya se encuentra en estado ${registro.estado}.` });
        continue;
      }

      try {
        let estudianteId: number;
        if (registro.accion === 'CREAR') {
          const duplicado = await estRepo.findOne({
            where: { carreraId: registro.carreraId, cedula: registro.cedula },
          });
          if (duplicado) {
            registro.accion = 'ACTUALIZAR';
            estudianteId = duplicado.id;
            await estRepo.update(estudianteId, {
              nombres: registro.datosJson.nombres,
              apellido1: registro.datosJson.apellido1,
              apellido2: registro.datosJson.apellido2,
              correoInstitucional: registro.datosJson.correoInstitucional,
              telefono: registro.datosJson.telefono,
            });
          } else {
            const guardado = await estRepo.save(
              estRepo.create({
                cedula: registro.cedula,
                nombres: registro.datosJson.nombres,
                apellido1: registro.datosJson.apellido1,
                apellido2: registro.datosJson.apellido2,
                correoInstitucional: registro.datosJson.correoInstitucional,
                telefono: registro.datosJson.telefono,
                carreraId: registro.carreraId,
                planEstudioId: registro.planEstudioId,
                periodoIngresoId: registro.datosJson.periodoIngresoId || 1,
                estado: EstadoEstudiante.ACTIVO,
              }),
            );
            estudianteId = guardado.id;
          }
        } else {
          // ACTUALIZAR
          const existente = await estRepo.findOne({
            where: { carreraId: registro.carreraId, cedula: registro.cedula },
          });
          if (!existente) {
            throw new ConflictException('No se encontró el estudiante existente a actualizar.');
          }
          if (existente.estado === EstadoEstudiante.GRADUADO) {
            throw new ConflictException('No se puede actualizar el expediente de un estudiante graduado.');
          }
          estudianteId = existente.id;
          await estRepo.update(estudianteId, {
            nombres: registro.datosJson.nombres,
            apellido1: registro.datosJson.apellido1,
            apellido2: registro.datosJson.apellido2,
            correoInstitucional: registro.datosJson.correoInstitucional,
            telefono: registro.datosJson.telefono,
          });
        }

        if (registro.aprobacionesNuevasJson && registro.aprobacionesNuevasJson.length > 0) {
          for (const apr of registro.aprobacionesNuevasJson) {
            const yaRegistrada = await histRepo.findOne({
              where: {
                estudianteId,
                planAsignaturaId: apr.planAsignaturaId,
                resultado: ResultadoAcademico.APROBADO,
              },
            });
            if (!yaRegistrada) {
              const fuenteReg = registro.datosJson?.formularioRespuestaId
                ? FuenteRegistroAcademico.FORMULARIO_INTERNO
                : FuenteRegistroAcademico.EXCEL;
              const datosAprobacion = crearDatosResultadoImportado({
                estudianteId,
                planAsignaturaId: apr.planAsignaturaId,
                periodoId: null,
                resultado: ResultadoAcademico.APROBADO,
                fuenteRegistro: fuenteReg,
                registradoPorUsuarioId: coordinadorId,
              });
              await histRepo.save(histRepo.create(datosAprobacion));
            }
          }
        }

        if (registro.datosJson?.formularioRespuestaId) {
          await manager.query(
            `UPDATE respuestas_formularios_estudiantes SET estado = 'PROCESADO', revisado_por_usuario_id = ?, revisado_at = NOW() WHERE id = ?`,
            [coordinadorId, registro.datosJson.formularioRespuestaId],
          );
        }

        registro.estado = 'APROBADO';
        registro.revisadoPorUsuarioId = coordinadorId;
        registro.revisadoEn = new Date();
        registro.estudianteIdAplicado = estudianteId;
        await regRepo.save(registro);

        aprobados += 1;
      } catch (err: any) {
        // El llamador controla la transacción compartida: propagar el error
        // garantiza rollback de todos los expedientes ya procesados.
        throw err;
      }
    }

    // 2. Procesar rechazos individuales
    for (const item of dto.rechazarRegistros || []) {
      if (!item.motivo || item.motivo.trim().length < 3) {
        fallidos.push({ id: item.id, error: 'Motivo de rechazo inválido o insuficiente.' });
        continue;
      }

      const registro = await regRepo.findOne({
        where: { id: item.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!registro) {
        fallidos.push({ id: item.id, error: 'Registro no encontrado.' });
        continue;
      }

      if (registro.carreraId !== dto.carreraId) {
        fallidos.push({ id: item.id, error: 'El registro no pertenece a la carrera de la solicitud.' });
        continue;
      }

      if (!['PENDIENTE', 'REQUIERE_REVISION', 'DEVUELTO_PARA_CORRECCION'].includes(registro.estado)) {
        fallidos.push({ id: item.id, error: `El registro ya está en estado ${registro.estado}.` });
        continue;
      }

      try {
        registro.estado = 'RECHAZADO';
        registro.motivoRechazo = item.motivo.trim();
        registro.revisadoPorUsuarioId = coordinadorId;
        registro.revisadoEn = new Date();
        await regRepo.save(registro);

        if (registro.datosJson?.formularioRespuestaId) {
          await manager.query(
            `UPDATE respuestas_formularios_estudiantes SET estado = 'RECHAZADO', motivo_rechazo = ?, revisado_por_usuario_id = ?, revisado_at = NOW() WHERE id = ?`,
            [item.motivo.trim(), coordinadorId, registro.datosJson.formularioRespuestaId],
          );
        }

        rechazados += 1;
      } catch (err: any) {
        throw err;
      }
    }

    return {
      solicitados: (dto.aprobarRegistroIds?.length || 0) + (dto.rechazarRegistros?.length || 0),
      aprobados,
      rechazados,
      fallidos,
    };
  }

  async marcarDevueltosDesdeSolicitud(
    coordinadorId: number,
    dto: ProponerRevisionBandejaDto,
    observaciones: string,
    manager: EntityManager,
  ): Promise<{ devueltos: number }> {
    const regRepo = manager.getRepository(RegistroImportacionEstudiante);
    const todosIds = [
      ...(dto.aprobarRegistroIds || []),
      ...(dto.rechazarRegistros || []).map((r) => r.id),
    ];

    let devueltos = 0;
    for (const id of todosIds) {
      const registro = await regRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (registro && ['PENDIENTE', 'REQUIERE_REVISION'].includes(registro.estado)) {
        registro.estado = 'DEVUELTO_PARA_CORRECCION';
        registro.motivoRechazo = observaciones.trim();
        registro.revisadoPorUsuarioId = coordinadorId;
        registro.revisadoEn = new Date();
        await regRepo.save(registro);
        devueltos++;
      }
    }
    return { devueltos };
  }

  async registrarRespuestaFormularioEnStaging(
    formulario: {
      id: number;
      titulo: string;
      carreraId: number;
      planEstudioId: number;
      proveedor: string;
      creadoPorUsuarioId: number;
    },
    respuesta: {
      id: number;
      estado: string;
      detalleError?: string | null;
      datosNormalizadosJson?: any;
    },
    em?: EntityManager,
  ): Promise<RegistroImportacionEstudiante | null> {
    const loteRepo = em ? em.getRepository(LoteImportacionEstudiante) : this.loteRepo;
    const regRepo = em ? em.getRepository(RegistroImportacionEstudiante) : this.registroRepo;
    const estRepo = em ? em.getRepository(Estudiante) : this.estudianteRepo;

    const tituloLote = `Formulario #${formulario.id}: ${formulario.titulo || 'Formulario de Estudiante'}`;
    const fuente = formulario.proveedor === 'INTERNO'
      ? FuenteRegistroAcademico.FORMULARIO_INTERNO
      : FuenteRegistroAcademico.GOOGLE_FORMS;

    let lote = await loteRepo.findOne({
      where: {
        carreraId: formulario.carreraId,
        planEstudioId: formulario.planEstudioId,
        nombreArchivo: tituloLote,
        estado: 'PENDIENTE',
      },
    });

    if (!lote) {
      lote = loteRepo.create({
        carreraId: formulario.carreraId,
        planEstudioId: formulario.planEstudioId,
        fuente,
        nombreArchivo: tituloLote,
        totalFilas: 0,
        totalValidas: 0,
        totalErrores: 0,
        estado: 'PENDIENTE',
        creadoPorUsuarioId: formulario.creadoPorUsuarioId || 1,
      });
      lote = await loteRepo.save(lote);
    }

    const datos = respuesta.datosNormalizadosJson;
    const cedula = datos?.identificacion?.trim() || `RES-${respuesta.id}`;

    let estudianteActual: Estudiante | null = null;
    if (datos?.identificacion) {
      estudianteActual = await estRepo.findOne({
        where: { carreraId: formulario.carreraId, cedula: datos.identificacion.trim() },
      });
    }

    const accion = estudianteActual ? 'ACTUALIZAR' : 'CREAR';
    let datosExistentesJson: Record<string, unknown> | null = null;
    let cambiosDetectadosJson: any[] | null = null;

    if (estudianteActual) {
      datosExistentesJson = {
        id: estudianteActual.id,
        cedula: estudianteActual.cedula,
        nombres: estudianteActual.nombres,
        apellido1: estudianteActual.apellido1,
        apellido2: estudianteActual.apellido2,
        correoInstitucional: estudianteActual.correoInstitucional,
        telefono: estudianteActual.telefono,
        estado: estudianteActual.estado,
      };

      const cambios: any[] = [];
      const nombresNuevos = [datos?.primerNombre, datos?.segundoNombre].filter(Boolean).join(' ');
      if (nombresNuevos && nombresNuevos !== estudianteActual.nombres) {
        cambios.push({ campo: 'nombres', anterior: estudianteActual.nombres, nuevo: nombresNuevos });
      }
      if (datos?.primerApellido && datos.primerApellido !== estudianteActual.apellido1) {
        cambios.push({ campo: 'apellido1', anterior: estudianteActual.apellido1, nuevo: datos.primerApellido });
      }
      if (datos?.segundoApellido && datos.segundoApellido !== estudianteActual.apellido2) {
        cambios.push({ campo: 'apellido2', anterior: estudianteActual.apellido2, nuevo: datos.segundoApellido });
      }
      if (datos?.correoEstudiantil && datos.correoEstudiantil !== estudianteActual.correoInstitucional) {
        cambios.push({ campo: 'correoInstitucional', anterior: estudianteActual.correoInstitucional, nuevo: datos.correoEstudiantil });
      }
      if (cambios.length > 0) cambiosDetectadosJson = cambios;
    }

    const aprobaciones = (datos?.asignaturasAprobadas || []).map((a: any) => ({
      planAsignaturaId: a.planAsignaturaId,
      codigo: a.codigo,
      nombre: a.nombre || a.codigo,
    }));

    const filaNumero = (lote.totalFilas || 0) + 1;
    const registro = regRepo.create({
      loteId: lote.id,
      carreraId: formulario.carreraId,
      planEstudioId: formulario.planEstudioId,
      fila: filaNumero,
      cedula,
      accion,
      datosJson: {
        formularioRespuestaId: respuesta.id,
        nombres: [datos?.primerNombre, datos?.segundoNombre].filter(Boolean).join(' ') || 'Sin nombre',
        apellido1: datos?.primerApellido || '',
        apellido2: datos?.segundoApellido || null,
        correoInstitucional: datos?.correoEstudiantil || '',
        telefono: datos?.contacto || null,
        periodoIngresoCodigo: datos?.periodoIngreso || '',
        periodoIngresoId: null,
        asignaturasAprobadas: aprobaciones.map((a: any) => a.codigo),
        advertenciasCorrequisitos: (datos as any)?.advertenciasCorrequisitos || [],
        optativasNoDisciplinarias: (datos as any)?.optativasNoDisciplinarias || null,
      },
      datosExistentesJson,
      cambiosDetectadosJson,
      aprobacionesNuevasJson: aprobaciones.length ? aprobaciones : null,
      erroresJson: respuesta.detalleError ? [respuesta.detalleError] : null,
      estado: respuesta.estado === 'REQUIERE_REVISION'
        ? 'REQUIERE_REVISION'
        : (respuesta.estado === 'RECHAZADO' ? 'RECHAZADO' : 'PENDIENTE'),
      motivoRechazo: respuesta.estado === 'RECHAZADO' ? (respuesta.detalleError || 'Registro duplicado no procesable') : null,
      revisadoPorUsuarioId: null,
      revisadoEn: null,
      estudianteIdAplicado: null,
    });

    const guardado = (await regRepo.save(registro)) as unknown as RegistroImportacionEstudiante;

    lote.totalFilas = filaNumero;
    if (registro.estado === 'REQUIERE_REVISION') {
      lote.totalErrores = (lote.totalErrores || 0) + 1;
    } else {
      lote.totalValidas = (lote.totalValidas || 0) + 1;
    }
    await loteRepo.save(lote);

    return guardado;
  }
}
