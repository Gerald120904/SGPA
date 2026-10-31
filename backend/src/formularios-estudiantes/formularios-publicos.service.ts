import {
  BadRequestException,
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
  ) {}

  /**
   * Consulta pública de un formulario mediante su token criptográfico.
   * Entrega únicamente la información necesaria para el estudiante y el catálogo
   * reactivo calculado por el motor académico.
   */
  async consultarFormularioPublico(token: string) {
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

    if (formulario.estado === EstadoFormularioEstudiante.CERRADO) {
      throw new BadRequestException(
        'El formulario se encuentra cerrado y no acepta nuevas respuestas.',
      );
    }

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
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

    // Obtener catálogo jerárquico por niveles y ciclos
    const opciones = { politicaCorrequisito: PoliticaCorrequisito.BLOQUEAR_REVISION };
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
  ) {
    if (!dto.idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.idempotencyKey)) {
      throw new BadRequestException('La clave del intento de envío debe ser un UUID válido.');
    }
    // Comparte el resultado de envíos iguales que llegan al mismo proceso a la vez.
    // La base de datos sigue siendo la autoridad entre procesos y reinicios.
    const clave = `${token}:${dto.idempotencyKey}:${this.generarFingerprintRespuesta(token, dto)}`;
    const enCurso = this.enviosEnCurso.get(clave);
    if (enCurso) return enCurso;
    const operacion = this.registrarRespuestaPublicaSinDuplicado(token, dto);
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

    if (formulario.estado === EstadoFormularioEstudiante.CERRADO) {
      throw new BadRequestException(
        'El formulario se encuentra cerrado y no acepta nuevas respuestas.',
      );
    }

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
      throw new BadRequestException(
        'El formulario no se encuentra disponible actualmente.',
      );
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

    // 3. Validación estricta del motor de requisitos académicos (Zero-Trust Backend)
    try {
      const opciones = { politicaCorrequisito: PoliticaCorrequisito.BLOQUEAR_REVISION };
      if (esInstantaneaCurricularInterna(formulario.mapaPreguntas)) {
        validarSeleccionInstantanea(
          formulario.mapaPreguntas, dto.asignaturasAprobadasIds, opciones,
        );
      } else {
        await this.motorRequisitosService.validarSeleccionEstricta(
          formulario.planEstudioId, dto.asignaturasAprobadasIds, opciones,
        );
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
      : asignaturasEntities.map((ent) => ({
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
      requiereRevisionOptativas: Boolean(dto.optativasNoDisciplinarias?.trim()),
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

    if (!respuesta.idempotente) this.logger.log(`Respuesta interna registrada: ID #${respuesta.id}`);

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
