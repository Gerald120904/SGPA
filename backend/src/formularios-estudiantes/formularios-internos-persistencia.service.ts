import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../estructura-academica/estructura-academica.service';
import { PlanEstudio } from '../planes-estudio/entities/plan-estudio.entity';
import { MotorRequisitosService } from '../planes-estudio/motor-requisitos/motor-requisitos.service';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { RespuestaFormularioEstudiante } from './entities/respuesta-formulario-estudiante.entity';
import { DatosNormalizadosFormulario } from './types/datos-normalizados-formulario.type';
import { InstantaneaCurricularInterna } from './types/instantanea-curricular-interna.type';

export interface CrearFormularioInternoInput {
  titulo: string;
  descripcion: string;
  carreraId: number;
  planEstudioId: number;
}

export interface GuardarRespuestaInternaInput {
  formularioId: number;
  idempotencyKey?: string;
  payloadJson: Record<string, unknown>;
  datosNormalizadosJson?: DatosNormalizadosFormulario | null;
}

@Injectable()
export class FormulariosInternosPersistenciaService {
  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepo: Repository<FormularioEstudiante>,

    @InjectRepository(RespuestaFormularioEstudiante)
    private readonly respuestaRepo: Repository<RespuestaFormularioEstudiante>,

    @InjectRepository(Carrera)
    private readonly carreraRepo: Repository<Carrera>,

    @InjectRepository(PlanEstudio)
    private readonly planEstudioRepo: Repository<PlanEstudio>,

    private readonly estructuraAcademicaService: EstructuraAcademicaService,
    private readonly motorRequisitosService: MotorRequisitosService,
  ) {}

  /**
   * Genera un token público criptográficamente seguro de 64 caracteres hexadecimales (256 bits de entropía).
   */
  generarTokenPublico(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Genera un identificador único del servidor para respuestas internas con prefijo INT-.
   * Garantiza unicidad y no colisión con IDs de Google Forms en UQ_formulario_google_response.
   */
  generarIdentificadorRespuesta(): string {
    return `INT-${crypto.randomUUID()}`;
  }

  /**
   * Crea un formulario gestionado directamente por SGPA (proveedor INTERNO)
   * asociándolo a Carrera y Plan de Estudio válidos.
   */
  async crearFormularioInterno(
    usuarioId: number,
    input: CrearFormularioInternoInput,
  ): Promise<FormularioEstudiante> {
    const carrera = await this.carreraRepo.findOne({
      where: {
        id: input.carreraId,
        activo: true,
      },
    });

    if (!carrera) {
      throw new NotFoundException(
        'La carrera seleccionada no existe o no se encuentra activa.',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        input.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }

    const plan = await this.planEstudioRepo.findOne({
      where: {
        id: input.planEstudioId,
        carreraId: input.carreraId,
        activo: true,
      },
    });

    if (!plan) {
      throw new BadRequestException(
        'El plan de estudio seleccionado no existe, no pertenece a la carrera o no se encuentra activo.',
      );
    }

    const estructura = await this.motorRequisitosService.obtenerEstructuraPlan(plan.id);
    const instantanea: InstantaneaCurricularInterna = {
      version: 3,
      plan: { id: plan.id, nombre: plan.nombre, codigo: plan.codigo, carreraId: plan.carreraId },
      asignaturas: estructura.asignaturas,
      requisitos: estructura.requisitos,
    };
    const tokenPublico = this.generarTokenPublico();

    const formulario = this.formularioRepo.create({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion.trim(),
      carreraId: input.carreraId,
      planEstudioId: input.planEstudioId,
      creadoPorUsuarioId: usuarioId,
      proveedor: ProveedorFormulario.INTERNO,
      estado: EstadoFormularioEstudiante.PUBLICADO,
      tokenPublico,
      googleFormId: null,
      responderUri: `/formularios/p/${tokenPublico}`,
      mapaPreguntas: instantanea,
      detalleError: null,
    });

    return await this.formularioRepo.save(formulario);
  }

  /**
   * Publica o reactiva un formulario interno, haciéndolo disponible para estudiantes.
   */
  async publicarFormularioInterno(
    formularioId: number,
    usuarioId: number,
  ): Promise<FormularioEstudiante> {
    const formulario = await this.formularioRepo.findOne({
      where: { id: formularioId },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe.');
    }

    if (formulario.proveedor !== ProveedorFormulario.INTERNO) {
      throw new BadRequestException(
        'Solo se puede publicar directamente formularios de proveedor INTERNO.',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera del formulario.',
      );
    }

    if (!formulario.tokenPublico) {
      formulario.tokenPublico = this.generarTokenPublico();
    }
    formulario.responderUri = `/formularios/p/${formulario.tokenPublico}`;
    formulario.estado = EstadoFormularioEstudiante.PUBLICADO;

    return await this.formularioRepo.save(formulario);
  }

  /**
   * Regenera el token de acceso público de un formulario interno, revocando inmediatamente el enlace anterior.
   */
  async regenerarTokenPublico(
    formularioId: number,
    usuarioId: number,
  ): Promise<FormularioEstudiante> {
    const formulario = await this.formularioRepo.findOne({
      where: { id: formularioId },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe.');
    }

    if (formulario.proveedor !== ProveedorFormulario.INTERNO) {
      throw new BadRequestException(
        'Solo se puede regenerar el token público en formularios de proveedor INTERNO.',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera del formulario.',
      );
    }

    const nuevoToken = this.generarTokenPublico();
    formulario.tokenPublico = nuevoToken;
    formulario.responderUri = `/formularios/p/${nuevoToken}`;

    return await this.formularioRepo.save(formulario);
  }

  /**
   * Revoca el acceso público al formulario cambiando su estado a CERRADO.
   */
  async revocarAcceso(
    formularioId: number,
    usuarioId: number,
  ): Promise<FormularioEstudiante> {
    const formulario = await this.formularioRepo.findOne({
      where: { id: formularioId },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe.');
    }

    if (formulario.proveedor !== ProveedorFormulario.INTERNO) {
      throw new BadRequestException(
        'La revocación directa aplica únicamente a formularios de proveedor INTERNO.',
      );
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico para revocar el formulario.',
      );
    }

    formulario.estado = EstadoFormularioEstudiante.CERRADO;
    return await this.formularioRepo.save(formulario);
  }

  /**
   * Consulta un formulario público mediante su token criptográfico.
   * Valida existencia, proveedor y que se encuentre en estado PUBLICADO.
   */
  async obtenerPorTokenPublico(token: string): Promise<FormularioEstudiante> {
    if (!token || typeof token !== 'string' || token.trim().length !== 64) {
      throw new BadRequestException('Formato de identificador público inválido.');
    }

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
      throw new NotFoundException('El formulario solicitado no fue encontrado.');
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

    return formulario;
  }

  /**
   * Persiste una respuesta enviada al formulario interno.
   * Asigna un identificador interno seguro (INT-uuid), inicializa estado en PENDIENTE
   * y guarda payloadJson y datosNormalizadosJson.
   */
  async guardarRespuestaInterna(
    input: GuardarRespuestaInternaInput,
  ): Promise<RespuestaFormularioEstudiante & { idempotente?: boolean }> {
    const formulario = await this.formularioRepo.findOne({
      where: { id: input.formularioId },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe.');
    }

    if (formulario.proveedor !== ProveedorFormulario.INTERNO) {
      throw new BadRequestException(
        'No se pueden registrar respuestas internas en un formulario externo.',
      );
    }

    if (formulario.estado !== EstadoFormularioEstudiante.PUBLICADO) {
      throw new BadRequestException(
        'No se pueden recibir respuestas de un formulario que no está PUBLICADO.',
      );
    }

    if (!input.payloadJson || typeof input.payloadJson !== 'object') {
      throw new BadRequestException(
        'El payload de la respuesta es obligatorio y debe ser un objeto válido.',
      );
    }

    const identificadorRespuesta = input.idempotencyKey
      ? `INT-${crypto.createHash('sha256').update(`${formulario.id}:${input.idempotencyKey.toLowerCase()}`).digest('hex')}`
      : this.generarIdentificadorRespuesta();

    const verificarReintento = (existente: RespuestaFormularioEstudiante) => {
      const canonico = (valor: unknown): unknown => {
        if (Array.isArray(valor)) return valor.map(canonico);
        if (valor && typeof valor === 'object') {
          return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a.localeCompare(b))
            .map(([clave, dato]) => [clave, canonico(dato)]));
        }
        return valor;
      };
      if (JSON.stringify(canonico(existente.payloadJson)) !== JSON.stringify(canonico(input.payloadJson))) {
        throw new ConflictException('La clave del intento ya fue utilizada con una solicitud diferente.');
      }
      return Object.assign(existente, { idempotente: true });
    };

    if (input.idempotencyKey) {
      const existente = await this.respuestaRepo.findOne({
        where: { formularioId: formulario.id, googleResponseId: identificadorRespuesta },
      });
      if (existente) return verificarReintento(existente);
    }

    const respuesta = this.respuestaRepo.create({
      formularioId: formulario.id,
      googleResponseId: identificadorRespuesta,
      payloadJson: input.payloadJson,
      datosNormalizadosJson: input.datosNormalizadosJson ?? null,
      estado: EstadoRespuestaFormulario.PENDIENTE,
      detalleError: null,
      optativasNoDisciplinarias: null,
      procesadoAt: null,
      revisadoPorUsuarioId: null,
      revisadoAt: null,
      motivoRechazo: null,
    });

    try {
      return await this.respuestaRepo.save(respuesta);
    } catch (error) {
      const driver = (error as { driverError?: { code?: string; errno?: number } }).driverError;
      if (!input.idempotencyKey || (driver?.code !== 'ER_DUP_ENTRY' && driver?.errno !== 1062)) {
        throw error;
      }
      const existente = await this.respuestaRepo.findOne({
        where: { formularioId: formulario.id, googleResponseId: identificadorRespuesta },
      });
      if (!existente) throw error;
      return verificarReintento(existente);
    }
  }
}
