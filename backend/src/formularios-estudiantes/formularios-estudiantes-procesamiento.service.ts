import { maxLength } from 'class-validator';
import { MailService } from '../mail/mail.service';
import {
  BadRequestException,
  ConflictException,
  Logger,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { EstudiantesImportacionService } from '../estudiantes/estudiantes-importacion.service';
import { FuenteRegistroAcademico } from '../estudiantes/constants/fuente-registro-academico.constant';
import { ImportarEstudiantesDto } from '../estudiantes/dto/importar-estudiantes.dto';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { esInstantaneaCurricularInterna, validarSeleccionInstantanea } from './types/instantanea-curricular-interna.type';

export interface ResultadoAprobacionRespuesta {
  respuestaId: number;
  estado: EstadoRespuestaFormulario;
  creados: number;
  actualizados: number;
  aprobacionesNuevas: number;
}

@Injectable()
export class FormulariosEstudiantesProcesamientoService {
  private readonly logger = new Logger(FormulariosEstudiantesProcesamientoService.name);
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepo: Repository<PeriodoAcademico>,

    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,

    private readonly estudiantesImportacionService: EstudiantesImportacionService,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly motorRequisitosService?: MotorRequisitosService,
    @Optional()
    private readonly mailService?: MailService,
  ) {}

  async listarSolicitudes(
    usuarioId: number,
    carreraId?: number,
    planEstudioId?: number,
  ): Promise<RespuestaFormularioEstudiante[]> {
    const carrerasPermitidas =
      await this.estructuraAcademicaService.obtenerCarreraIdsConAlcance(
        usuarioId,
      );

    if (
      carrerasPermitidas.length === 0 ||
      (carreraId && !carrerasPermitidas.includes(carreraId))
    ) {
      return [];
    }

    const solicitudes = await this.respuestaRepo.find({
      where: {
        estado: In([
          EstadoRespuestaFormulario.PENDIENTE,
          EstadoRespuestaFormulario.REQUIERE_REVISION,
        ]),
        formulario: {
          carreraId: carreraId ?? In(carrerasPermitidas),
          ...(planEstudioId && { planEstudioId }),
        },
      },
      relations: {
        formulario: {
          carrera: true,
          planEstudio: true,
        },
        revisadoPor: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    for (const sol of solicitudes) {
      if (sol.formulario?.mapaPreguntas) {
        this.enriquecerNombresRespuesta(sol, sol.formulario);
      }
    }

    return solicitudes;
  }

  async contarSolicitudesPorPlan(
    usuarioId: number,
    carreraId: number,
  ) {
    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const filas = await this.respuestaRepo
      .createQueryBuilder('respuesta')
      .innerJoin('respuesta.formulario', 'formulario')
      .select('formulario.planEstudioId', 'planEstudioId')
      .addSelect('COUNT(respuesta.id)', 'total')
      .where('formulario.carreraId = :carreraId', {
        carreraId,
      })
      .andWhere('respuesta.estado IN (:...estados)', {
        estados: [
          EstadoRespuestaFormulario.PENDIENTE,
          EstadoRespuestaFormulario.REQUIERE_REVISION,
        ],
      })
      .groupBy('formulario.planEstudioId')
      .getRawMany();

    return filas.map((fila) => ({
      planEstudioId: Number(fila.planEstudioId),
      total: Number(fila.total),
    }));
  }

  async aprobarRespuesta(
    respuestaId: number,
    usuarioId: number,
  ): Promise<ResultadoAprobacionRespuesta> {
    const respuesta = await this.respuestaRepo.findOne({
      where: {
        id: respuestaId,
      },
      relations: {
        formulario: {
          carrera: true,
        },
      },
    });

    if (!respuesta) {
      throw new NotFoundException('La solicitud indicada no existe.');
    }

    if (
      ![
        EstadoRespuestaFormulario.PENDIENTE,
        EstadoRespuestaFormulario.REQUIERE_REVISION,
      ].includes(respuesta.estado)
    ) {
      throw new ConflictException('Esta solicitud ya fue revisada.');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        respuesta.formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const datos = respuesta.datosNormalizadosJson;

    if (!datos) {
      const detalle = 'La respuesta no posee datos normalizados.';
      await this.marcarRespuestaNoProcesable(respuesta, EstadoRespuestaFormulario.ERROR, detalle);
      throw new ConflictException(detalle);
    }

    const periodo = await this.periodoRepo.findOne({
      where: {
        id: datos.periodoIngresoId,
      },
    });

    if (!periodo) {
      const detalle = 'El período de ingreso asociado a la respuesta ya no existe.';
      await this.marcarRespuestaNoProcesable(respuesta, EstadoRespuestaFormulario.REQUIERE_REVISION, detalle);
      throw new ConflictException(detalle);
    }

    const idsAsignaturas = datos.asignaturasAprobadas.map(
      (item) => item.planAsignaturaId,
    );

    const asignaturas = idsAsignaturas.length
      ? await this.planAsignaturaRepo.find({
          where: {
            id: In(idsAsignaturas),
          },
          relations: {
            curso: true,
          },
        })
      : [];

    const codigosCursos: string[] = [];
    const erroresAsignaturas: string[] = [];

    for (const aprobada of datos.asignaturasAprobadas) {
      const actual = asignaturas.find(
        (item) => item.id === aprobada.planAsignaturaId,
      );

      if (!actual) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no existe.`,
        );
        continue;
      }

      if (actual.planEstudioId !== respuesta.formulario.planEstudioId) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no pertenece al plan del formulario.`,
        );
        continue;
      }

      if (actual.cursoId === null && !actual.codigoReferencia?.trim()) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no posee un código de referencia.`,
        );
        continue;
      }

      if (actual.cursoId !== null && actual.curso === null) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} ya no posee un curso asociado.`,
        );
        continue;
      }

      if ((actual.cursoId ?? 0) !== aprobada.cursoId) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} cambió su curso asociado.`,
        );
        continue;
      }

      if (actual.cursoId === null && actual.codigoReferencia?.trim() !== aprobada.codigo) {
        erroresAsignaturas.push(`La asignatura ${aprobada.codigo} cambió su código de referencia.`);
        continue;
      }

      const codigoActual = actual.curso?.codigo ?? actual.codigoReferencia!.trim();
      if (esInstantaneaCurricularInterna(respuesta.formulario.mapaPreguntas) &&
          codigoActual !== aprobada.codigo) {
        erroresAsignaturas.push(
          `La asignatura ${aprobada.codigo} cambió su código desde la publicación del formulario.`,
        );
        continue;
      }
      codigosCursos.push(codigoActual);
    }

    if (erroresAsignaturas.length > 0) {
      const detalle = erroresAsignaturas.join(' ');
      await this.marcarRespuestaNoProcesable(respuesta, EstadoRespuestaFormulario.REQUIERE_REVISION, detalle);
      throw new ConflictException(detalle);
    }

    // Validación estricta del grafo de requisitos en el momento de la aprobación
    if (idsAsignaturas.length > 0 &&
        (this.motorRequisitosService || esInstantaneaCurricularInterna(respuesta.formulario.mapaPreguntas))) {
      try {
        if (esInstantaneaCurricularInterna(respuesta.formulario.mapaPreguntas)) {
          validarSeleccionInstantanea(respuesta.formulario.mapaPreguntas, idsAsignaturas);
        } else {
          await this.motorRequisitosService!.validarSeleccionEstricta(
            respuesta.formulario.planEstudioId,
            idsAsignaturas,
          );
        }
      } catch (error: any) {
        const detalle =
          error?.message ||
          'La selección de asignaturas no satisface los requisitos académicos vigentes.';
        await this.marcarRespuestaNoProcesable(respuesta, EstadoRespuestaFormulario.REQUIERE_REVISION, detalle);
        throw new ConflictException(detalle);
      }
    }

    const nombres = [datos.primerNombre, datos.segundoNombre]
      .filter((valor): valor is string => Boolean(valor?.trim()))
      .join(' ');

    const dto: ImportarEstudiantesDto = {
      carreraId: respuesta.formulario.carreraId,
      planEstudioId: respuesta.formulario.planEstudioId,
      estudiantes: [
        {
          fila: 2,
          cedula: datos.identificacion,
          nombres,
          apellido1: datos.primerApellido,
          apellido2: datos.segundoApellido,
          correoInstitucional: datos.correoEstudiantil,
          telefono: datos.contacto,
          periodoIngresoCodigo: periodo.codigo,
          asignaturasAprobadas: codigosCursos,
        },
      ],
    };

    const fuente =
      respuesta.formulario?.proveedor === ProveedorFormulario.INTERNO
        ? FuenteRegistroAcademico.FORMULARIO_INTERNO
        : FuenteRegistroAcademico.GOOGLE_FORMS;

    let resultado;
    try {
      resultado = await this.dataSource.transaction(async (manager) => {
        // La fila permanece bloqueada hasta confirmar historial y estado juntos.
        const [actual] = (await manager.query(
          'SELECT estado FROM respuestas_formularios_estudiantes WHERE id = ? FOR UPDATE',
          [respuestaId],
        )) as Array<{ estado: EstadoRespuestaFormulario }>;
        if (
          !actual ||
          ![
            EstadoRespuestaFormulario.PENDIENTE,
            EstadoRespuestaFormulario.REQUIERE_REVISION,
          ].includes(actual.estado)
        ) {
          throw new ConflictException('Esta solicitud ya fue revisada.');
        }

        const importacion =
          await this.estudiantesImportacionService.ejecutarDesdeFormulario(
            usuarioId,
            dto,
            fuente,
            manager,
          );
        const filaImportada = importacion.filas[0];
        if (!filaImportada || filaImportada.accion === 'ERROR') {
          throw new ConflictException(
            filaImportada?.errores?.join(' ') ||
              'La respuesta requiere revisión manual.',
          );
        }

        const fechaRevision = new Date();
        const cambio = await manager.getRepository(RespuestaFormularioEstudiante).update(
          {
            id: respuestaId,
            estado: In([
              EstadoRespuestaFormulario.PENDIENTE,
              EstadoRespuestaFormulario.REQUIERE_REVISION,
            ]),
          },
          {
            estado: EstadoRespuestaFormulario.PROCESADO,
            revisadoPorUsuarioId: usuarioId,
            revisadoAt: fechaRevision,
            procesadoAt: fechaRevision,
            motivoRechazo: null,
            detalleError: null,
          },
        );
        if (cambio.affected !== 1) {
          throw new ConflictException('Esta solicitud ya fue revisada.');
        }
        return importacion;
      });
    } catch (err: any) {
      if (
        err instanceof ConflictException &&
        err.message === 'Esta solicitud ya fue revisada.'
      ) {
        throw err;
      }
      const mensajeBruto = String(err?.message || '');
      const esSensible =
        err instanceof QueryFailedError ||
        Boolean(err?.driverError) ||
        /SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|token\s*=|password|hash/i.test(
          mensajeBruto,
        );
      const detalleError = esSensible
        ? 'Error interno en la base de datos durante la importación académica.'
        : mensajeBruto || 'Error durante la importación académica de la respuesta.';
      const revision = await this.respuestaRepo.update(
        {
          id: respuesta.id,
          estado: In([
            EstadoRespuestaFormulario.PENDIENTE,
            EstadoRespuestaFormulario.REQUIERE_REVISION,
          ]),
        },
        {
          estado: EstadoRespuestaFormulario.REQUIERE_REVISION,
          detalleError,
        },
      );
      if (revision.affected === 1) {
        respuesta.estado = EstadoRespuestaFormulario.REQUIERE_REVISION;
        respuesta.detalleError = detalleError;
      }
      throw new ConflictException(detalleError);
    }

    respuesta.estado = EstadoRespuestaFormulario.PROCESADO;
    respuesta.revisadoPorUsuarioId = usuarioId;
    respuesta.revisadoAt = new Date();
    respuesta.procesadoAt = respuesta.revisadoAt;
    respuesta.motivoRechazo = null;
    respuesta.detalleError = null;

    return {
      respuestaId: respuesta.id,
      estado: respuesta.estado,
      creados: resultado.creados,
      actualizados: resultado.actualizados,
      aprobacionesNuevas: resultado.aprobacionesNuevas,
    };
  }

  private async marcarRespuestaNoProcesable(
    respuesta: RespuestaFormularioEstudiante,
    estado: EstadoRespuestaFormulario,
    detalleError: string,
  ): Promise<void> {
    const cambio = await this.respuestaRepo.update(
      {
        id: respuesta.id,
        estado: In([
          EstadoRespuestaFormulario.PENDIENTE,
          EstadoRespuestaFormulario.REQUIERE_REVISION,
        ]),
      },
      { estado, detalleError },
    );
    if (cambio.affected !== 1) {
      throw new ConflictException('Esta solicitud ya fue revisada.');
    }
    respuesta.estado = estado;
    respuesta.detalleError = detalleError;
  }

  async rechazarRespuesta(
    respuestaId: number,
    usuarioId: number,
    motivo: string,
  ): Promise<RespuestaFormularioEstudiante> {
    const respuesta = await this.respuestaRepo.findOne({
      where: {
        id: respuestaId,
      },
      relations: {
        formulario: true,
      },
    });

    if (!respuesta) {
      throw new NotFoundException('La solicitud indicada no existe.');
    }

    if (
      ![
        EstadoRespuestaFormulario.PENDIENTE,
        EstadoRespuestaFormulario.REQUIERE_REVISION,
      ].includes(respuesta.estado)
    ) {
      throw new ConflictException('Esta solicitud ya fue revisada.');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        respuesta.formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (!motivoLimpio) {
      throw new BadRequestException(
        'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
      );
    }

    if (!maxLength(motivoLimpio, 500)) {
      throw new BadRequestException(
        'El motivo de rechazo no puede superar los 500 caracteres.',
      );
    }

    if (typeof this.respuestaRepo.update === 'function') {
      const updateResult = await this.respuestaRepo.update(
        {
          id: respuesta.id,
          estado: In([
            EstadoRespuestaFormulario.PENDIENTE,
            EstadoRespuestaFormulario.REQUIERE_REVISION,
          ]),
        },
        {
          estado: EstadoRespuestaFormulario.RECHAZADO,
          revisadoPorUsuarioId: usuarioId,
          revisadoAt: new Date(),
          motivoRechazo: motivoLimpio,
          procesadoAt: null,
        },
      );

      if (updateResult && updateResult.affected === 0) {
        throw new ConflictException('Esta solicitud ya fue revisada.');
      }

      // Actualizar objeto en memoria para el retorno
      respuesta.estado = EstadoRespuestaFormulario.RECHAZADO;
      respuesta.revisadoPorUsuarioId = usuarioId;
      respuesta.revisadoAt = new Date();
      respuesta.motivoRechazo = motivoLimpio;
      respuesta.procesadoAt = null;
    } else {
      // Fallback para entornos de prueba sin dataSource
      respuesta.estado = EstadoRespuestaFormulario.RECHAZADO;
      respuesta.revisadoPorUsuarioId = usuarioId;
      respuesta.revisadoAt = new Date();
      respuesta.motivoRechazo = motivoLimpio;
      respuesta.procesadoAt = null;
      await this.respuestaRepo.save(respuesta);
    }

    // Notificación por correo al estudiante (Corrección 3)
    const correoEstudiante = respuesta.datosNormalizadosJson?.correoEstudiantil;
    if (correoEstudiante && this.mailService) {
      const nombreEstudiante = [
        respuesta.datosNormalizadosJson?.primerNombre,
        respuesta.datosNormalizadosJson?.primerApellido,
      ].filter(Boolean).join(' ') || 'Estudiante';

      try {
        await this.mailService.enviarNotificacionRechazoSolicitud(
          correoEstudiante,
          nombreEstudiante,
          {
            solicitudId: respuesta.id,
            tituloFormulario: respuesta.formulario?.titulo || 'Formulario estudiantil',
            carreraNombre: respuesta.formulario?.carrera?.nombre,
            motivoRechazo: motivoLimpio,
          },
        );
      } catch (mailError) {
        this.logger.error(
          `No fue posible enviar correo de rechazo a ${correoEstudiante} para respuesta #${respuesta.id}: ${mailError?.message}`,
        );
      }
    }

    return respuesta;
  }

  private enriquecerNombresRespuesta(
    respuesta: RespuestaFormularioEstudiante,
    formulario: FormularioEstudiante,
  ): void {
    const mapa = formulario.mapaPreguntas;
    const asignaturas = respuesta.datosNormalizadosJson?.asignaturasAprobadas;
    if (!Array.isArray(asignaturas) || asignaturas.length === 0) return;

    const nombresPorCodigo = new Map<string, string>();
    const nombresPorPlanAsigId = new Map<number, string>();

    if (esInstantaneaCurricularInterna(mapa)) {
      for (const asig of mapa.asignaturas) {
        if (asig.nombre) {
          nombresPorCodigo.set(asig.codigo, asig.nombre);
          nombresPorPlanAsigId.set(asig.id, asig.nombre);
        }
      }
    } else if (mapa && typeof mapa === 'object' && 'asignaturasAprobadas' in mapa) {
      const mapaAny = mapa as any;
      if (Array.isArray(mapaAny.asignaturasAprobadas?.grupos)) {
        for (const grupo of mapaAny.asignaturasAprobadas.grupos) {
          if (grupo.opciones) {
            for (const [etiqueta, opt] of Object.entries(grupo.opciones as Record<string, any>)) {
              let nombre = opt.nombre;
              if (!nombre && etiqueta.includes(' - ')) {
                nombre = etiqueta.split(' - ').slice(1).join(' - ').trim();
              }
              if (nombre) {
                if (opt.codigo) nombresPorCodigo.set(opt.codigo, nombre);
                if (opt.planAsignaturaId) nombresPorPlanAsigId.set(opt.planAsignaturaId, nombre);
              }
            }
          }
        }
      }
    }

    for (const asig of asignaturas) {
      if (asig && typeof asig === 'object' && !asig.nombre) {
        asig.nombre =
          nombresPorPlanAsigId.get(asig.planAsignaturaId) ||
          nombresPorCodigo.get(asig.codigo) ||
          undefined;
      }
    }
  }
}
