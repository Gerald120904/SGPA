import {
  BadRequestException,
  Optional,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { PlanAsignatura } from '../planes-estudio/entities/plan-asignatura.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstudiantesService } from '../estudiantes/estudiantes.service';
import { PoliticaCorrequisito } from '../planes-estudio/motor-requisitos/types/motor-reglas.types';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosInternosPersistenciaService } from './formularios-internos-persistencia.service';
import {
  catalogoDesdeInstantanea,
  esInstantaneaCurricularInterna,
  validarSeleccionInstantanea,
} from './types/instantanea-curricular-interna.type';
import {
  AsignaturaAprobadaFormulario,
  DatosNormalizadosFormulario,
} from './types/datos-normalizados-formulario.type';

export interface ResultadoRespuestaPublica {
  mensaje: string;
  codigoConfirmacion: string;
  estado: string;
  idempotente?: boolean;
}

@Injectable()
export class FormulariosPublicosService {
  private readonly logger = new Logger(FormulariosPublicosService.name);
  private readonly regexTokenHex = /^[0-9a-fA-F]{64}$/;

  private readonly enviosEnCurso = new Map<string, Promise<ResultadoRespuestaPublica>>();

  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepo: Repository<PeriodoAcademico>,

    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,

    private readonly persistenciaInternaService: FormulariosInternosPersistenciaService,
    private readonly motorRequisitosService: MotorRequisitosService,
    @Optional()
    private readonly estudiantesService?: EstudiantesService,
  ) {}

  /**
   * Consulta pública de un formulario mediante su token criptográfico.
   * Entrega únicamente la información necesaria para el estudiante y el catálogo
   * reactivo calculado por el motor académico.
   */
  async consultarFormularioPublico(token: string, previewToken?: string) {
    this.validarFormatoToken(token);

    const formulario = await this.formularioRepo.findOne({
      where: {
        tokenPublico: token.trim(),
        proveedor: ProveedorFormulario.INTERNO,
      },
      relations: {
        carrera: true,
        planEstudio: true,
      },
    });

    if (!formulario) {
      throw new NotFoundException(
        'El formulario solicitado no existe o no está disponible.',
      );
    }

    const esVistaPreviaValida = Boolean(
      previewToken &&
      this.persistenciaInternaService.validarTicketVistaPrevia(token.trim(), previewToken, formulario.id)
    );

    if (formulario.estado === EstadoFormularioEstudiante.CERRADO && !esVistaPreviaValida) {
      throw new BadRequestException(
        'El formulario se encuentra cerrado y no acepta nuevas respuestas.',
      );
    }

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO && !esVistaPreviaValida) {
      throw new BadRequestException(
        'El formulario no se encuentra disponible actualmente.',
      );
    }

    // Obtener períodos académicos activos ordenados
    const periodos = await this.periodoRepo.find({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    // Obtener catálogo jerárquico por niveles y ciclos incluyendo asignaturas históricas del plan
    const opciones = {
      politicaCorrequisito: PoliticaCorrequisito.INFORMATIVO,
      permitirInactivas: true,
    };
    const catalogo = esInstantaneaCurricularInterna(formulario.mapaPreguntas)
      ? catalogoDesdeInstantanea(formulario.mapaPreguntas, opciones)
      : (await this.motorRequisitosService.obtenerCatalogoFormulario(
          formulario.planEstudioId, [], opciones,
        )).niveles;

    return {
      formulario: {
        titulo: formulario.titulo,
        descripcion: formulario.descripcion,
      },
      carrera: {
        id: formulario.carrera.id,
        nombre: formulario.carrera.nombre,
        codigo: formulario.carrera.codigo,
      },
      planEstudio: {
        id: formulario.planEstudio.id,
        nombre: esInstantaneaCurricularInterna(formulario.mapaPreguntas)
          ? formulario.mapaPreguntas.plan.nombre : formulario.planEstudio.nombre,
        codigo: esInstantaneaCurricularInterna(formulario.mapaPreguntas)
          ? formulario.mapaPreguntas.plan.codigo : formulario.planEstudio.codigo,
      },
      periodos: periodos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        anio: p.anio,
        ciclo: p.ciclo,
      })),
      catalogo,
    };
  }

  /**
   * Procesa y persiste una respuesta enviada al formulario interno.
   * Aplica validaciones zero-trust, previene reintentos duplicados y ejecuta el motor académico.
   */
  async registrarRespuestaPublica(
    token: string,
    dto: EnviarRespuestaPublicaDto,
    previewToken?: string,
  ) {
    if (!dto.idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.idempotencyKey)) {
      throw new BadRequestException('La clave del intento de envío debe ser un UUID válido.');
    }
    // Comparte el resultado de envíos iguales que llegan al mismo proceso a la vez.
    // La base de datos sigue siendo la autoridad entre procesos y reinicios.
    const clave = `${token}:${dto.idempotencyKey}:${this.generarFingerprintRespuesta(token, dto)}`;
    const enCurso = this.enviosEnCurso.get(clave);
    if (enCurso) return enCurso;
    const operacion = this.registrarRespuestaPublicaSinDuplicado(token, dto, previewToken);
    this.enviosEnCurso.set(clave, operacion);
    try {
      return await operacion;
    } finally {
      if (this.enviosEnCurso.get(clave) === operacion) {
        this.enviosEnCurso.delete(clave);
      }
    }
  }

  private async registrarRespuestaPublicaSinDuplicado(
    token: string,
    dto: EnviarRespuestaPublicaDto,
    previewToken?: string,
  ) {
    this.validarFormatoToken(token);

    // Detección de bot por honeypot
    if (dto.sitioWeb && dto.sitioWeb.trim().length > 0) {
      this.logger.warn('Intento de envío bloqueado por honeypot.');
      throw new BadRequestException('La solicitud no pudo ser procesada.');
    }

    const formulario = await this.formularioRepo.findOne({
      where: {
        tokenPublico: token.trim(),
        proveedor: ProveedorFormulario.INTERNO,
      },
    });

    if (!formulario) {
      throw new NotFoundException(
        'El formulario solicitado no existe o no está disponible.',
      );
    }

    const esVistaPreviaValida = Boolean(
      previewToken &&
      this.persistenciaInternaService.validarTicketVistaPrevia(token.trim(), previewToken, formulario.id)
    );

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
      if (!esVistaPreviaValida) {
        throw new BadRequestException(
          'El formulario se encuentra en borrador o cerrado y no acepta respuestas oficiales.',
        );
      }
    }

    // 1. Validar que el período de ingreso exista
    const periodo = await this.periodoRepo.findOne({
      where: { id: dto.periodoIngresoId },
    });

    if (!periodo) {
      throw new BadRequestException(
        'El período de ingreso seleccionado no es válido o no existe.',
      );
    }

    // Validar pertenencia estricta de asignaturas al plan de estudios del formulario
    if (dto.asignaturasAprobadasIds.length > 0 && typeof this.planAsignaturaRepo.count === 'function') {
      const asignaturasEnPlan = await this.planAsignaturaRepo.count({
        where: {
          id: In(dto.asignaturasAprobadasIds),
          planEstudioId: formulario.planEstudioId,
        },
      });
      if (asignaturasEnPlan !== dto.asignaturasAprobadasIds.length) {
        throw new BadRequestException(
          'Una o más asignaturas seleccionadas no pertenecen al plan de estudios del formulario.',
        );
      }
    }

    // 3. Integración con expediente oficial existente para validación de prerrequisitos
    let asignaturasHistorial: number[] = [];
    if (this.estudiantesService && typeof this.estudiantesService.obtenerAsignaturasAprobadasPorCedula === 'function') {
      asignaturasHistorial = await this.estudiantesService.obtenerAsignaturasAprobadasPorCedula(
        formulario.carreraId,
        dto.identificacion.trim(),
      ).catch(() => []);
    }

    const aprobadasParaMotor = [
      ...new Set([...dto.asignaturasAprobadasIds, ...asignaturasHistorial]),
    ];

    const opciones = {
      politicaCorrequisito: PoliticaCorrequisito.INFORMATIVO,
      permitirInactivas: true,
    };
    const advertenciasCorrequisitos: string[] = [];
    let requiereRevisionPrerrequisitos = false;

    try {
      const resultadoMotor = esInstantaneaCurricularInterna(formulario.mapaPreguntas)
        ? validarSeleccionInstantanea(formulario.mapaPreguntas, aprobadasParaMotor, opciones)
        : await this.motorRequisitosService.validarSeleccionEstricta(
            formulario.planEstudioId, dto.asignaturasAprobadasIds, opciones,
          );

      for (const asig of (resultadoMotor?.asignaturas || [])) {
        if (asig.aprobada) {
          for (const req of asig.detallesRequisitos || []) {
            if (req.tipo === 'CORREQUISITO' && !req.cumplido) {
              const correqCodigo = req.codigo ?? `#${req.requisitoAsignaturaId}`;
              const correqNombre = req.nombre ? ` (${req.nombre})` : '';
              advertenciasCorrequisitos.push(
                `Advertencia: Has seleccionado ${asig.codigo} (${asig.nombre}), que tiene como correquisito ${correqCodigo}${correqNombre}. Si aprobaste ambas, asegúrate de marcar también ${correqCodigo}. Si sólo aprobaste una, puedes continuar.`,
              );
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error inesperado en motor de requisitos:', error);
      throw new InternalServerErrorException(
        'No se pudo verificar la coherencia académica de las asignaturas seleccionadas.',
      );
    }

    // Modo simulación de vista previa: no persiste datos en base de datos
    if (esVistaPreviaValida && formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
      return {
        mensaje: 'Simulación de vista previa completada con éxito. En modo simulación no se persisten respuestas en la base de datos.',
        codigoConfirmacion: 'SIM-PREVIEW-EXITO',
        estado: 'SIMULADO',
      };
    }

    // 4. Normalizar datos académicos
    const instantanea = esInstantaneaCurricularInterna(formulario.mapaPreguntas)
      ? formulario.mapaPreguntas : null;
    const asignaturasEntities = !instantanea && dto.asignaturasAprobadasIds.length > 0
      ? await this.planAsignaturaRepo.find({
          where: {
            id: In(dto.asignaturasAprobadasIds),
            planEstudioId: formulario.planEstudioId,
          },
          relations: { curso: true },
        })
      : [];

    const asignaturasAprobadas: AsignaturaAprobadaFormulario[] = instantanea
      ? dto.asignaturasAprobadasIds.map((id) => {
          const asignatura = instantanea.asignaturas.find((item) => item.id === id)!;
          return {
            planAsignaturaId: id,
            cursoId: asignatura.cursoId ?? 0,
            codigo: asignatura.codigo,
            nombre: asignatura.nombre,
          };
        })
      : (asignaturasEntities || []).map((ent) => ({
        planAsignaturaId: ent.id,
        cursoId: ent.cursoId ?? 0,
        codigo:
          ent.codigoReferencia?.trim() ||
          ent.curso?.codigo?.trim() ||
          `ASIG-${ent.id}`,
        nombre:
          ent.curso?.nombre?.trim() ||
          ent.nombreReferencia?.trim() ||
          undefined,
      }));

    const requiereRevisionFinal =
      Boolean(dto.optativasNoDisciplinarias?.trim()) || requiereRevisionPrerrequisitos;

    const datosNormalizados: DatosNormalizadosFormulario = {
      primerNombre: dto.primerNombre.trim(),
      segundoNombre: dto.segundoNombre?.trim() || null,
      primerApellido: dto.primerApellido.trim(),
      segundoApellido: dto.segundoApellido?.trim() || null,
      identificacion: dto.identificacion.trim(),
      correoEstudiantil: dto.correoEstudiantil.trim().toLowerCase(),
      contacto: dto.contacto?.trim() || null,
      periodoIngresoId: dto.periodoIngresoId,
      asignaturasAprobadas,
      optativasNoDisciplinarias: dto.optativasNoDisciplinarias?.trim() || null,
      requiereRevisionOptativas: requiereRevisionFinal,
      advertenciasCorrequisitos: advertenciasCorrequisitos.length > 0 ? advertenciasCorrequisitos : undefined,
    };

    // 5. Persistir mediante el servicio de persistencia interna
    const respuesta = await this.persistenciaInternaService.guardarRespuestaInterna({
      formularioId: formulario.id,
      idempotencyKey: dto.idempotencyKey,
      payloadJson: {
        identificacion: dto.identificacion.trim(),
        primerNombre: dto.primerNombre.trim(),
        segundoNombre: dto.segundoNombre?.trim() || null,
        primerApellido: dto.primerApellido.trim(),
        segundoApellido: dto.segundoApellido?.trim() || null,
        correoEstudiantil: dto.correoEstudiantil.trim().toLowerCase(),
        contacto: dto.contacto?.trim() || null,
        periodoIngresoId: dto.periodoIngresoId,
        asignaturasAprobadasIds: dto.asignaturasAprobadasIds,
        optativasNoDisciplinarias: dto.optativasNoDisciplinarias?.trim() || null,
      },
      datosNormalizadosJson: datosNormalizados,
    });

    if (respuesta && !respuesta.idempotente) this.logger.log(`Respuesta interna registrada: ID #${respuesta.id}`);

    return {
      mensaje: 'Su respuesta ha sido registrada satisfactoriamente.',
      codigoConfirmacion: respuesta.googleResponseId,
      estado: respuesta.estado,
      idempotente: respuesta.idempotente || undefined,
    };
  }

  private validarFormatoToken(token: string): void {
    if (
      !token ||
      typeof token !== 'string' ||
      token.trim().length !== 64 ||
      !this.regexTokenHex.test(token.trim())
    ) {
      throw new BadRequestException('El enlace del formulario es inválido.');
    }
  }

  private generarFingerprintRespuesta(
    formularioId: number | string,
    dto: EnviarRespuestaPublicaDto,
  ): string {
    const ordenadas = [...dto.asignaturasAprobadasIds].sort((a, b) => a - b);
    return createHash('sha256')
      .update(JSON.stringify([
        formularioId,
        dto.identificacion.trim(),
        dto.primerNombre.trim(),
        dto.segundoNombre?.trim() || null,
        dto.primerApellido.trim(),
        dto.segundoApellido?.trim() || null,
        dto.correoEstudiantil.trim().toLowerCase(),
        dto.contacto?.trim() || null,
        dto.optativasNoDisciplinarias?.trim() || null,
        dto.periodoIngresoId,
        ordenadas,
      ]))
      .digest('hex');
  }

}
