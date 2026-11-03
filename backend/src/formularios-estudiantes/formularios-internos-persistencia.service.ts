import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { BandejaRevisionEstudiantesService } from '../estudiantes/bandeja-revision-estudiantes.service';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, QueryRunner, Repository } from 'typeorm';
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
  private readonly logger = new Logger(FormulariosInternosPersistenciaService.name);
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
    @Optional()
    private readonly bandejaRevision?: BandejaRevisionEstudiantesService,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  /**
   * Registra la reserva atómica en solicitudes_activas_estudiantes para garantizar
   * la unicidad estricta entre procesos y fuentes concurrentes (SGPA y Google Forms).
   */
  async registrarSolicitudActiva(
    carreraId: number,
    identificacion: string | null | undefined,
    correo: string | null | undefined,
    referenciaId: number,
    runner?: QueryRunner | null,
  ): Promise<void> {
    const claves: Array<{ tipo: string; clave: string }> = [];
    if (identificacion && identificacion.trim()) {
      claves.push({ tipo: 'CEDULA', clave: `cedula:${identificacion.trim()}` });
    }
    if (correo && correo.trim()) {
      claves.push({ tipo: 'CORREO', clave: `correo:${correo.trim().toLowerCase()}` });
    }
    if (!claves.length) return;

    const executor = runner || this.dataSource;
    if (!executor || typeof executor.query !== 'function') return;

    for (const item of claves) {
      try {
        await executor.query(
          `INSERT INTO solicitudes_activas_estudiantes (carrera_id, clave_identidad, tipo, origen, referencia_id, created_at)
           VALUES (?, ?, ?, 'FORMULARIO_INTERNO', ?, NOW())`,
          [carreraId, item.clave, item.tipo, referenciaId],
        );
      } catch (err: any) {
        const code = err?.code || err?.driverError?.code;
        const errno = err?.errno || err?.driverError?.errno;
        if (code === 'ER_DUP_ENTRY' || errno === 1062) {
          throw new BadRequestException(
            `Ya existe una solicitud de declaración académica activa en esta carrera para ${item.tipo === 'CEDULA' ? 'la cédula' : 'el correo'} indicado.`,
          );
        }
        if (code === 'ER_NO_SUCH_TABLE' || errno === 1146 || String(err?.message || '').includes("doesn't exist")) {
          // Si la tabla aún no existe en bases no migradas, se omite para no romper funcionalidad previa.
          return;
        }
      }
    }
  }

  /**
   * Libera la reserva activa en solicitudes_activas_estudiantes al resolver o rechazar la solicitud.
   */
  async liberarSolicitudActiva(referenciaId: number, carreraId?: number): Promise<void> {
    if (!this.dataSource || typeof this.dataSource.query !== 'function') return;
    try {
      if (carreraId) {
        await this.dataSource.query(
          `DELETE FROM solicitudes_activas_estudiantes WHERE carrera_id = ? AND referencia_id = ?`,
          [carreraId, referenciaId],
        );
      } else {
        await this.dataSource.query(
          `DELETE FROM solicitudes_activas_estudiantes WHERE referencia_id = ?`,
          [referenciaId],
        );
      }
    } catch {
      // Ignorar si la tabla no existe o error transitorio
    }
  }

  private readonly secretVistaPrevia =
    process.env.PREVIEW_SECRET ||
    process.env.JWT_SECRET ||
    'sgpa_secret_preview_key_internal_2026';

  private readonly bloqueosConcurrenciaEnVuelo = new Set<string>();

  /**
   * Genera un ticket temporal criptográficamente firmado para vista previa protegida.
   * Válido únicamente por 15 minutos y limitado al usuario y formulario autorizados.
   */
  async generarTicketVistaPrevia(
    formularioId: number,
    usuarioId: number,
  ): Promise<{ url: string; token: string; expiraEn: Date }> {
    const formulario = await this.formularioRepo.findOne({
      where: { id: formularioId },
    });

    if (!formulario) {
      throw new NotFoundException('El formulario indicado no existe.');
    }

    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        formulario.carreraId,
      );

    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera del formulario para previsualizarlo.',
      );
    }

    const exp = Date.now() + 15 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({
        formularioId: formulario.id,
        tokenPublico: formulario.tokenPublico,
        usuarioId,
        exp,
      }),
    ).toString('base64url');

    const firma = crypto
      .createHmac('sha256', this.secretVistaPrevia)
      .update(payload)
      .digest('base64url');

    const ticket = `${payload}.${firma}`;
    const url = `/formularios/p/${formulario.tokenPublico}?preview_token=${ticket}&preview=true`;

    return {
      url,
      token: ticket,
      expiraEn: new Date(exp),
    };
  }

  /**
   * Valida la firma criptográfica y la vigencia temporal de un ticket de vista previa.
   */
  validarTicketVistaPrevia(
    tokenPublico: string,
    ticket: string,
    formularioId?: number,
  ): boolean {
    if (!ticket || typeof ticket !== 'string' || !ticket.includes('.')) {
      return false;
    }

    const [payloadBase64, firma] = ticket.split('.');
    if (!payloadBase64 || !firma) return false;

    try {
      const firmaEsperada = crypto
        .createHmac('sha256', this.secretVistaPrevia)
        .update(payloadBase64)
        .digest('base64url');

      const bufA = Buffer.from(firma);
      const bufB = Buffer.from(firmaEsperada);
      if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        return false;
      }

      const datos = JSON.parse(
        Buffer.from(payloadBase64, 'base64url').toString('utf8'),
      );

      if (typeof datos.exp !== 'number' || Date.now() > datos.exp) {
        return false;
      }

      if (datos.tokenPublico !== tokenPublico) {
        return false;
      }

      if (formularioId && datos.formularioId !== formularioId) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

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
      relations: {
        planEstudio: true,
      },
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

    // Control concurrente estricto y prevención de duplicados entre SGPA y Google Forms
    const identificacion = input.datosNormalizadosJson?.identificacion?.trim();
    const correo = input.datosNormalizadosJson?.correoEstudiantil?.trim()?.toLowerCase();
    const claveBloqueo = identificacion
      ? `c:${formulario.carreraId}:id:${identificacion}`
      : (correo ? `c:${formulario.carreraId}:email:${correo}` : null);

    if (claveBloqueo && this.bloqueosConcurrenciaEnVuelo.has(claveBloqueo)) {
      throw new BadRequestException(
        'Ya existe una solicitud de declaración académica en proceso concurrente para esta identificación o correo en esta carrera. Por favor, espere un momento.',
      );
    }
    if (claveBloqueo) {
      this.bloqueosConcurrenciaEnVuelo.add(claveBloqueo);
    }

    const lockIdentificador = identificacion || correo;
    let queryRunner: QueryRunner | null = null;
    let lockName: string | null = null;
    let lockObtenido = false;

    if (this.dataSource && typeof this.dataSource.createQueryRunner === 'function' && lockIdentificador) {
      try {
        queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        lockName = `sgpa_c${formulario.carreraId}_${lockIdentificador}`.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 60);
        const res = await queryRunner.query('SELECT GET_LOCK(?, 5) AS obtenido', [lockName]);
        lockObtenido = res && res[0] && (res[0].obtenido === 1 || res[0].obtenido === '1');
        if (!lockObtenido) {
          throw new BadRequestException(
            'Ya existe una solicitud de declaración académica en proceso concurrente para esta identificación o correo en esta carrera. Por favor, espere un momento.',
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) {
          if (queryRunner) {
            await queryRunner.release().catch(() => null);
            queryRunner = null;
          }
          throw err;
        }
      }
    }

    try {
      if ((identificacion || correo) && typeof this.respuestaRepo.createQueryBuilder === 'function') {
        const qb = this.respuestaRepo
          .createQueryBuilder('r')
          .innerJoin('r.formulario', 'f')
          .where('f.carreraId = :carreraId', { carreraId: formulario.carreraId })
          .andWhere('r.estado IN (:...estadosBloqueantes)', {
            estadosBloqueantes: [
              EstadoRespuestaFormulario.PENDIENTE,
              EstadoRespuestaFormulario.REQUIERE_REVISION,
            ],
          });

        if (identificacion && correo) {
          qb.andWhere(
            '(JSON_UNQUOTE(JSON_EXTRACT(r.datosNormalizadosJson, "$.identificacion")) = :identificacion OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(r.datosNormalizadosJson, "$.correoEstudiantil"))) = :correo)',
            { identificacion, correo },
          );
        } else if (identificacion) {
          qb.andWhere(
            'JSON_UNQUOTE(JSON_EXTRACT(r.datosNormalizadosJson, "$.identificacion")) = :identificacion',
            { identificacion },
          );
        } else {
          qb.andWhere(
            'LOWER(JSON_UNQUOTE(JSON_EXTRACT(r.datosNormalizadosJson, "$.correoEstudiantil"))) = :correo',
            { correo },
          );
        }

        if (identificadorRespuesta) {
          qb.andWhere('r.googleResponseId != :identificadorRespuesta', { identificadorRespuesta });
        }

        const respuestaPendiente = await qb.getOne();
        if (respuestaPendiente) {
          if (respuestaPendiente.estado === EstadoRespuestaFormulario.REQUIERE_REVISION) {
            throw new BadRequestException(
              'Ya cuenta con una declaración académica en revisión que requiere subsanación. Debe coordinar con la dirección académica antes de registrar un nuevo envío.',
            );
          }
          throw new BadRequestException(
            'Ya existe una solicitud de declaración académica en revisión para esta identificación o correo en esta carrera. Por favor, espere a que la coordinación procese su envío actual.',
          );
        }
      }

            let esPlanEnTransicion = (formulario.planEstudio as any)?.estado === 'EN_TRANSICION';
      if (!esPlanEnTransicion && this.dataSource && typeof this.dataSource.query === 'function') {
        try {
          const ult = await this.dataSource.query(
            "SELECT valor_nuevo FROM auditoria_planes_estudio WHERE plan_estudio_id = ? AND tipo_modificacion IN ('CAMBIO_ESTADO', 'CIERRE', 'REAPERTURA') ORDER BY id DESC LIMIT 1",
            [formulario.planEstudioId],
          );
          if (ult?.[0]?.valor_nuevo === 'EN_TRANSICION') {
            esPlanEnTransicion = true;
          }
        } catch {}
      }

      const requiereRevision = Boolean(input.datosNormalizadosJson?.requiereRevisionOptativas) || esPlanEnTransicion;
      const estadoInicial = requiereRevision
        ? EstadoRespuestaFormulario.REQUIERE_REVISION
        : EstadoRespuestaFormulario.PENDIENTE;
      const detalleError = esPlanEnTransicion
        ? 'El formulario corresponde a un plan de estudio EN TRANSICIÓN. No se admiten nuevos ingresos ordinarios; requiere revisión manual.'
        : null;

      const respuesta = this.respuestaRepo.create({
        formularioId: formulario.id,
        googleResponseId: identificadorRespuesta,
        payloadJson: input.payloadJson,
        datosNormalizadosJson: input.datosNormalizadosJson ?? null,
        estado: estadoInicial,
        detalleError,
        optativasNoDisciplinarias: input.datosNormalizadosJson?.optativasNoDisciplinarias || null,
        procesadoAt: null,
        revisadoPorUsuarioId: null,
        revisadoAt: null,
        motivoRechazo: null,
      });

      const guardada = await this.respuestaRepo.save(respuesta);
      if (this.bandejaRevision) {
        await this.bandejaRevision.registrarRespuestaFormularioEnStaging(formulario, guardada).catch(() => null);
      }

      // Registrar reserva persistente atómica en solicitudes_activas_estudiantes
      await this.registrarSolicitudActiva(
        formulario.carreraId,
        identificacion,
        correo,
        guardada.id,
        queryRunner,
      );

      return guardada;
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
    } finally {
      if (queryRunner) {
        try {
          if (lockName && lockObtenido) {
            const relRes = await queryRunner.query('SELECT RELEASE_LOCK(?) AS rel', [lockName]).catch((err) => {
              this.logger.warn(`Error al ejecutar RELEASE_LOCK para ${lockName}: ${err?.message}`);
              return null;
            });
            const liberado = relRes && relRes[0] && (relRes[0].rel === 1 || relRes[0].rel === '1');
            if (!liberado && lockObtenido) {
              this.logger.warn(`RELEASE_LOCK no devolvió 1 para el cerrojo ${lockName}. Resultado: ${JSON.stringify(relRes)}`);
            }
          }
        } finally {
          await queryRunner.release().catch((err) => {
            this.logger.warn(`Error al liberar queryRunner del cerrojo ${lockName}: ${err?.message}`);
          });
        }
      }
      if (claveBloqueo) {
        this.bloqueosConcurrenciaEnVuelo.delete(claveBloqueo);
      }
    }
  }
}
