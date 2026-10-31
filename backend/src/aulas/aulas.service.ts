import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  LessThan,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Repository,
  EntityManager,
} from 'typeorm';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodosAcademicosService } from '../periodos-academicos/periodos-academicos.service';
import { OrigenAula } from './constants/origen-aula.constant';
import { FiltrarAulasDto } from './dto/filtrar-aulas.dto';
import { ActualizarAulaDto } from './dto/actualizar-aula.dto';
import { ActualizarDisponibilidadAulaDto } from './dto/actualizar-disponibilidad-aula.dto';
import { ActualizarEquipamientoAulaDto } from './dto/actualizar-equipamiento-aula.dto';
import { ActualizarEquipamientoDto } from './dto/actualizar-equipamiento.dto';
import { ActualizarIndisponibilidadAulaDto } from './dto/actualizar-indisponibilidad-aula.dto';
import { ActualizarReservaAulaDto } from './dto/actualizar-reserva-aula.dto';
import { AsignarEquipamientoAulaDto } from './dto/asignar-equipamiento-aula.dto';
import { CrearAulaDto } from './dto/crear-aula.dto';
import { CrearDisponibilidadAulaDto } from './dto/crear-disponibilidad-aula.dto';
import { CrearEquipamientoDto } from './dto/crear-equipamiento.dto';
import { CrearIndisponibilidadAulaDto } from './dto/crear-indisponibilidad-aula.dto';
import { CrearReservaAulaDto } from './dto/crear-reserva-aula.dto';
import { BuscarAulasDisponiblesDto } from './dto/buscar-aulas-disponibles.dto';
import { ConsultarOcupacionAulaDto } from './dto/consultar-ocupacion-aula.dto';
import { RequisitoEquipamientoAulaDto } from './dto/requisito-equipamiento-aula.dto';
import { AulaEquipamiento } from './entities/aula-equipamiento.entity';
import { Aula } from './entities/aula.entity';
import { AuditoriaAula } from './entities/auditoria-aula.entity';
import { DisponibilidadAula } from './entities/disponibilidad-aula.entity';
import { fechaHoraInstitucionalDesdeTextoLocal } from './fecha-hora-institucional.transformer';
import { Equipamiento } from './entities/equipamiento.entity';
import { IndisponibilidadAula } from './entities/indisponibilidad-aula.entity';
import { ReservaAula } from './entities/reserva-aula.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { Notificacion } from '../notificaciones/entities/notificacion.entity';

@Injectable()
export class AulasService {
  private validarAulaActivaParaOcupacion(aula: Aula): void {
    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede modificar reservas o indisponibilidades de un aula inactiva.',
      );
    }
  }

  constructor(
    @InjectRepository(Aula)
    private readonly aulaRepository: Repository<Aula>,
    @InjectRepository(Equipamiento)
    private readonly equipamientoRepository: Repository<Equipamiento>,
    @InjectRepository(AulaEquipamiento)
    private readonly aulaEquipamientoRepository: Repository<AulaEquipamiento>,
    @InjectRepository(IndisponibilidadAula)
    private readonly indisponibilidadAulaRepository: Repository<IndisponibilidadAula>,
    @InjectRepository(ReservaAula)
    private readonly reservaAulaRepository: Repository<ReservaAula>,
    @InjectRepository(AuditoriaAula)
    private readonly auditoriaAulaRepository: Repository<AuditoriaAula>,
    @InjectRepository(DisponibilidadAula)
    private readonly disponibilidadAulaRepository: Repository<DisponibilidadAula>,
    private readonly periodosAcademicosService: PeriodosAcademicosService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly notificacionesService?: NotificacionesService,
    @Optional()
    private readonly ocupacionManager?: EntityManager,
  ) {}

  private enTransaccionOcupacion = false;

  private async ejecutarOcupacionEnTransaccion<T>(
    aulaIds: number[],
    operacion: (servicio: AulasService) => Promise<T>,
  ): Promise<T> {
    const ids = [...new Set(aulaIds)].sort((a, b) => a - b);
    for (let intento = 0; intento < 2; intento++) {
      try {
        return await this.dataSource.transaction(
          'READ COMMITTED',
          async (manager: EntityManager) => {
            // La fila de aula serializa incluso cuando no existen ocupaciones en el intervalo.
            for (const id of ids) {
              const filas: { id: number }[] = await manager.query(
                'SELECT id FROM aulas WHERE id = ? FOR UPDATE',
                [id],
              );
              if (!filas.length) {
                throw new NotFoundException('Aula no encontrada.');
              }
            }
            const servicio = new AulasService(
              manager.getRepository(Aula),
              manager.getRepository(Equipamiento),
              manager.getRepository(AulaEquipamiento),
              manager.getRepository(IndisponibilidadAula),
              manager.getRepository(ReservaAula),
              manager.getRepository(AuditoriaAula),
              manager.getRepository(DisponibilidadAula),
              this.periodosAcademicosService,
              this.dataSource,
              new NotificacionesService(manager.getRepository(Notificacion)),
              manager,
            );
            servicio.enTransaccionOcupacion = true;
            return operacion(servicio);
          },
        );
      } catch (error) {
        const codigo =
          (error as { driverError?: { code?: string }; code?: string })
            ?.driverError?.code ?? (error as { code?: string })?.code;
        if (codigo !== 'ER_LOCK_DEADLOCK' && codigo !== 'ER_LOCK_WAIT_TIMEOUT') {
          throw error;
        }
        if (intento === 1) {
          throw new ServiceUnavailableException('El aula está en uso. Intente nuevamente.');
        }
      }
    }
    throw new ServiceUnavailableException('El aula está en uso. Intente nuevamente.');
  }

  private async obtenerEntidadPorId(id: number): Promise<Aula> {
    const aula = await this.aulaRepository.findOne({ where: { id } });

    if (!aula) {
      throw new NotFoundException('Aula no encontrada.');
    }

    return aula;
  }

  private async validarCodigoDuplicado(
    codigo: string,
    origen: OrigenAula,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.aulaRepository.findOne({
      where: { codigo, origen },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException(
        `El código del aula ya está registrado para el origen ${origen}.`,
      );
    }
  }

  private async validarLimiteOrigen(origen: OrigenAula): Promise<void> {
    const limites: Record<OrigenAula, number> = {
      [OrigenAula.UNA]: 27,
      [OrigenAula.UNED]: 3,
      [OrigenAula.OTRO]: 15,
    };

    const limite = limites[origen];

    const cantidadRegistrada = await this.aulaRepository.count({
      where: { origen },
    });

    if (cantidadRegistrada >= limite) {
      throw new ConflictException(
        `Se alcanzó el límite de ${limite} espacios registrados para ${origen}.`,
      );
    }
  }


  private obtenerNumeroEspacioDesdeCodigo(codigo: string): number | null {
    const coincidencia = String(codigo).match(/\d+/);

    if (!coincidencia) {
      return null;
    }

    const numero = Number(coincidencia[0]);

    return Number.isInteger(numero) ? numero : null;
  }

  private validarNumeroPorOrigen(codigo: string, origen: OrigenAula): void {
    const maximos: Record<OrigenAula, number> = {
      [OrigenAula.UNA]: 27,
      [OrigenAula.UNED]: 3,
      [OrigenAula.OTRO]: 15,
    };

    const numero = this.obtenerNumeroEspacioDesdeCodigo(codigo);
    const maximo = maximos[origen];

    if (numero === null || numero < 1 || numero > maximo) {
      throw new BadRequestException(
        `Para ${origen}, el número del espacio debe estar entre 1 y ${maximo}.`,
      );
    }
  }

  private validarCapacidadAula(capacidad: number): void {
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 70) {
      throw new BadRequestException(
        'La capacidad del aula debe ser un número entero entre 1 y 70 estudiantes.',
      );
    }
  }

  private async obtenerEquipamientoEntidadPorId(
    id: number,
  ): Promise<Equipamiento> {
    const equipamiento = await this.equipamientoRepository.findOne({
      where: { id },
    });

    if (!equipamiento) {
      throw new NotFoundException('Equipamiento no encontrado.');
    }

    return equipamiento;
  }

  private async validarNombreEquipamientoDuplicado(
    nombre: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.equipamientoRepository.findOne({
      where: { nombre },
    });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException('Ya existe un equipamiento con ese nombre.');
    }
  }

  private async obtenerEquipamientoAula(
    aulaId: number,
    equipamientoId: number,
  ): Promise<AulaEquipamiento> {
    const relacion = await this.aulaEquipamientoRepository.findOne({
      where: { aulaId, equipamientoId },
      relations: { equipamiento: true },
    });

    if (!relacion) {
      throw new NotFoundException(
        'El equipamiento no está asociado a esta aula.',
      );
    }

    return relacion;
  }

  private async obtenerIndisponibilidadAula(
    aulaId: number,
    id: number,
  ): Promise<IndisponibilidadAula> {
    const indisponibilidad = await this.indisponibilidadAulaRepository.findOne({
      where: { id, aulaId },
    });

    if (!indisponibilidad) {
      throw new NotFoundException('Indisponibilidad del aula no encontrada.');
    }

    return indisponibilidad;
  }

  private async obtenerReservaAula(
    aulaId: number,
    id: number,
  ): Promise<ReservaAula> {
    const reserva = await this.reservaAulaRepository.findOne({
      where: { id, aulaId },
    });

    if (!reserva) {
      throw new NotFoundException('Reserva del aula no encontrada.');
    }

    return reserva;
  }

  private convertirFechaHora(valor: string): Date {
    let fecha: Date;
    try {
      fecha = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(
        valor,
      )
        ? fechaHoraInstitucionalDesdeTextoLocal(valor)
        : new Date(valor);
    } catch {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }

    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }

    return fecha;
  }

  private validarRangoIndisponibilidad(inicio: Date, fin: Date): void {
    if (inicio.getTime() >= fin.getTime()) {
      throw new BadRequestException(
        'La fecha y hora de finalización debe ser posterior al inicio.',
      );
    }
  }

  private async validarCruceIndisponibilidad(
    aulaId: number,
    inicio: Date,
    fin: Date,
    excluirId?: number,
  ): Promise<void> {
    const existentes = await this.indisponibilidadAulaRepository.find({
      where: { aulaId, activo: true },
    });

    const hayCruce = existentes.some((item) => {
      if (excluirId !== undefined && item.id === excluirId) {
        return false;
      }

      const inicioExistente = new Date(item.fechaHoraInicio).getTime();
      const finExistente = new Date(item.fechaHoraFin).getTime();

      return inicio.getTime() < finExistente && fin.getTime() > inicioExistente;
    });

    if (hayCruce) {
      throw new ConflictException(
        'El aula ya tiene una indisponibilidad activa que se cruza con este horario.',
      );
    }

    const reservas = await this.reservaAulaRepository.find({
      where: { aulaId, activo: true },
    });
    if (
      reservas.some(
        (reserva) =>
          inicio.getTime() < new Date(reserva.fechaHoraFin).getTime() &&
          fin.getTime() > new Date(reserva.fechaHoraInicio).getTime(),
      )
    ) {
      throw new ConflictException(
        'El aula ya tiene una reserva activa que se cruza con este horario.',
      );
    }
  }

  private async validarCruceReserva(
    aulaId: number,
    inicio: Date,
    fin: Date,
    excluirReservaId?: number,
  ): Promise<void> {
    const reservas = await this.reservaAulaRepository.find({
      where: { aulaId, activo: true },
    });

    const cruzaReserva = reservas.some((reserva) => {
      if (excluirReservaId !== undefined && reserva.id === excluirReservaId) {
        return false;
      }

      const inicioExistente = new Date(reserva.fechaHoraInicio).getTime();
      const finExistente = new Date(reserva.fechaHoraFin).getTime();

      return inicio.getTime() < finExistente && fin.getTime() > inicioExistente;
    });

    if (cruzaReserva) {
      throw new ConflictException(
        'El aula ya tiene una reserva activa que se cruza con este horario.',
      );
    }

    const indisponibilidades = await this.indisponibilidadAulaRepository.find({
      where: { aulaId, activo: true },
    });

    const cruzaIndisponibilidad = indisponibilidades.some((item) => {
      const inicioExistente = new Date(item.fechaHoraInicio).getTime();
      const finExistente = new Date(item.fechaHoraFin).getTime();

      return inicio.getTime() < finExistente && fin.getTime() > inicioExistente;
    });

    if (cruzaIndisponibilidad) {
      throw new ConflictException(
        'El aula tiene una indisponibilidad activa que se cruza con este horario.',
      );
    }
  }

  private clasificarCapacidad(
    capacidad: number,
    estudiantes?: number,
  ): string | null {
    if (!estudiantes) return null;
    const diferencia = capacidad - estudiantes;
    if (diferencia < 0) return 'SOBRECAPACIDAD';
    if (diferencia === 0) return 'AL_LIMITE';
    if (diferencia < 5) return 'AJUSTADA';
    if (diferencia <= 10) return 'RECOMENDADA';
    return 'MUY_RECOMENDADA';
  }

  private obtenerCalendarioInstitucional(valor: string): {
    fecha: string;
    hora: string;
  } {
    const coincidencia = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/.exec(valor);
    if (!coincidencia) {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }
    const fechaValidada = new Date(`${coincidencia[1]}T00:00:00.000Z`);
    if (
      Number.isNaN(fechaValidada.getTime()) ||
      fechaValidada.toISOString().slice(0, 10) !== coincidencia[1]
    ) {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }

    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(this.convertirFechaHora(valor));
    const valores = Object.fromEntries(
      partes.map(({ type, value }) => [type, value]),
    );
    return {
      fecha: `${valores.year}-${valores.month}-${valores.day}`,
      hora: `${valores.hour}:${valores.minute}`,
    };
  }

  private obtenerDiaSemana(fecha: string): number {
    const [anio, mes, dia] = fecha.split('-').map(Number);

    const diaJs = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();

    return diaJs === 0 ? 7 : diaJs;
  }

  private bloquesDisponibilidadCubrenRango(
    bloques: DisponibilidadAula[],
    horaInicio: string,
    horaFin: string,
  ): boolean {
    const inicioSolicitado = this.convertirHoraAMinutos(horaInicio);

    const finSolicitado = this.convertirHoraAMinutos(horaFin);

    const ordenados = [...bloques].sort(
      (a, b) =>
        this.convertirHoraAMinutos(a.horaInicio) -
        this.convertirHoraAMinutos(b.horaInicio),
    );

    let cubiertoHasta = inicioSolicitado;

    for (const bloque of ordenados) {
      const inicioBloque = this.convertirHoraAMinutos(bloque.horaInicio);

      const finBloque = this.convertirHoraAMinutos(bloque.horaFin);

      if (finBloque <= cubiertoHasta) {
        continue;
      }

      if (inicioBloque > cubiertoHasta) {
        return false;
      }

      cubiertoHasta = Math.max(cubiertoHasta, finBloque);

      if (cubiertoHasta >= finSolicitado) {
        return true;
      }
    }

    return false;
  }

  private async validarEquipamientosBusqueda(
    requisitos: RequisitoEquipamientoAulaDto[],
  ): Promise<void> {
    if (!requisitos.length) return;

    const ids = requisitos.map((requisito) => requisito.equipamientoId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'No se puede repetir el mismo equipamiento en la búsqueda.',
      );
    }

    const equipamientos = await this.equipamientoRepository.find({
      where: { id: In(ids) },
    });
    const porId = new Map(
      equipamientos.map((equipamiento) => [equipamiento.id, equipamiento]),
    );

    for (const id of ids) {
      const equipamiento = porId.get(id);
      if (!equipamiento) {
        throw new BadRequestException(
          `El equipamiento solicitado con id ${id} no existe.`,
        );
      }
      if (!equipamiento.activo) {
        throw new BadRequestException(
          `El equipamiento solicitado "${equipamiento.nombre}" está inactivo.`,
        );
      }
    }
  }

  async buscarAulasDisponibles(dto: BuscarAulasDisponiblesDto) {
    const periodo = await this.periodosAcademicosService.obtenerPorId(
      dto.periodoId,
    );

    if (
      periodo.estado === EstadoPeriodoAcademico.CANCELADO ||
      periodo.estado === EstadoPeriodoAcademico.CERRADO
    ) {
      throw new BadRequestException(
        'No se pueden buscar aulas disponibles para un periodo cerrado o cancelado.',
      );
    }

    const calendarioInicio = this.obtenerCalendarioInstitucional(
      dto.fechaHoraInicio,
    );
    const calendarioFin = this.obtenerCalendarioInstitucional(dto.fechaHoraFin);
    const fechaInicio = calendarioInicio.fecha;
    const fechaFin = calendarioFin.fecha;

    if (fechaInicio !== fechaFin) {
      throw new BadRequestException(
        'La búsqueda de disponibilidad debe realizarse dentro de un mismo día.',
      );
    }

    if (fechaInicio < periodo.fechaInicio || fechaInicio > periodo.fechaFin) {
      throw new BadRequestException(
        'La fecha consultada está fuera del periodo académico indicado.',
      );
    }

    const diaSemana = this.obtenerDiaSemana(fechaInicio);

    const horaInicio = calendarioInicio.hora;
    const horaFin = calendarioFin.hora;

    this.validarRangoHoras(horaInicio, horaFin);

    const inicio = this.convertirFechaHora(dto.fechaHoraInicio);
    const fin = this.convertirFechaHora(dto.fechaHoraFin);
    this.validarRangoIndisponibilidad(inicio, fin);
    const requisitos = dto.equipamientos ?? [];
    await this.validarEquipamientosBusqueda(requisitos);
    const where: FindOptionsWhere<Aula> = { activo: true };
    if (dto.tipo !== undefined) where.tipo = dto.tipo;
    if (dto.tipoMobiliario !== undefined) {
      where.tipoMobiliario = dto.tipoMobiliario;
    }
    if (dto.cantidadEstudiantes !== undefined && !dto.incluirSobrecupo) {
      where.capacidad = MoreThanOrEqual(dto.cantidadEstudiantes);
    }
    const aulas = await this.aulaRepository.find({
      where,
      relations: { equipamientos: { equipamiento: true } },
      order: { capacidad: 'ASC', nombre: 'ASC' },
    });
    if (!aulas.length) return [];
    const aulaIds = aulas.map((aula) => aula.id);

    const disponibilidades = await this.disponibilidadAulaRepository.find({
      where: {
        aulaId: In(aulaIds),
        periodoId: dto.periodoId,
        diaSemana,
      },
    });

    const bloquesPorAula = new Map<number, DisponibilidadAula[]>();

    for (const disponibilidad of disponibilidades) {
      const actuales = bloquesPorAula.get(disponibilidad.aulaId) ?? [];

      actuales.push(disponibilidad);

      bloquesPorAula.set(disponibilidad.aulaId, actuales);
    }

    const aulasConDisponibilidad = new Set<number>();

    for (const aula of aulas) {
      const bloques = bloquesPorAula.get(aula.id) ?? [];

      if (!bloques.length || this.bloquesDisponibilidadCubrenRango(bloques, horaInicio, horaFin)) {
        aulasConDisponibilidad.add(aula.id);
      }
    }

    const [indisponibilidades, reservas] = await Promise.all([
      this.indisponibilidadAulaRepository.find({
        where: {
          aulaId: In(aulaIds),
          activo: true,
          fechaHoraInicio: LessThan(fin),
          fechaHoraFin: MoreThan(inicio),
        },
      }),
      this.reservaAulaRepository.find({
        where: {
          aulaId: In(aulaIds),
          activo: true,
          fechaHoraInicio: LessThan(fin),
          fechaHoraFin: MoreThan(inicio),
        },
      }),
    ]);
    const ocupadas = new Set([
      ...indisponibilidades.map((x) => x.aulaId),
      ...reservas.map((x) => x.aulaId),
    ]);
    return aulas
      .filter((aula) => aulasConDisponibilidad.has(aula.id))
      .filter((aula) => !ocupadas.has(aula.id))
      .filter((aula) =>
        requisitos.every((req) =>
          aula.equipamientos?.some(
            (relacion) =>
              relacion.activo &&
              relacion.equipamiento?.activo &&
              relacion.equipamientoId === req.equipamientoId &&
              relacion.cantidadAsignada >= req.cantidadMinima,
          ),
        ),
      )
      .map((aula) => ({
        ...aula,
        recomendacionCapacidad: this.clasificarCapacidad(
          aula.capacidad,
          dto.cantidadEstudiantes,
        ),
        capacidadSobrante:
          dto.cantidadEstudiantes !== undefined
            ? aula.capacidad - dto.cantidadEstudiantes
            : null,
      }));
  }

  private validarCantidadEquipamiento(cantidad: number, etiqueta: string): void {
    if (!Number.isInteger(cantidad) || cantidad < 0) {
      throw new BadRequestException(
        `${etiqueta} debe ser un número entero mayor o igual a cero.`,
      );
    }
  }

  private async obtenerCantidadAsignadaEquipamiento(
    equipamientoId: number,
    excluirRelacionId?: number,
  ): Promise<number> {
    const relaciones = await this.aulaEquipamientoRepository.find({
      where: {
        equipamientoId,
        activo: true,
      },
    });

    return relaciones.reduce((total, relacion) => {
      if (excluirRelacionId !== undefined && relacion.id === excluirRelacionId) {
        return total;
      }

      return total + Number(relacion.cantidadAsignada || 0);
    }, 0);
  }

  private async obtenerResumenStockEquipamiento(
    equipamiento: Equipamiento,
    excluirRelacionId?: number,
  ): Promise<{
    cantidadAsignada: number;
    cantidadDisponible: number;
  }> {
    const cantidadAsignada = await this.obtenerCantidadAsignadaEquipamiento(
      equipamiento.id,
      excluirRelacionId,
    );

    return {
      cantidadAsignada,
      cantidadDisponible: Math.max(
        0,
        Number(equipamiento.cantidadTotal || 0) - cantidadAsignada,
      ),
    };
  }

  private async validarStockParaAsignacion(
    equipamiento: Equipamiento,
    cantidadSolicitada: number,
    excluirRelacionId?: number,
  ): Promise<void> {
    if (!Number.isInteger(cantidadSolicitada) || cantidadSolicitada < 1) {
      throw new BadRequestException(
        'La cantidad asignada debe ser un número entero mayor a cero.',
      );
    }

    const resumen = await this.obtenerResumenStockEquipamiento(
      equipamiento,
      excluirRelacionId,
    );

    if (cantidadSolicitada > resumen.cantidadDisponible) {
      throw new ConflictException(
        `No hay unidades suficientes disponibles de "${equipamiento.nombre}". ` +
          `Disponibles: ${resumen.cantidadDisponible}; solicitadas: ${cantidadSolicitada}.`,
      );
    }
  }

  private obtenerCodigoError(error: unknown): string | undefined {
    return (
      (
        error as {
          driverError?: { code?: string };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code
    );
  }

  private relanzarErrorAula(error: unknown): never {
    if (this.obtenerCodigoError(error) === 'ER_DUP_ENTRY') {
      throw new ConflictException('El código del aula ya está registrado para ese origen.');
    }

    throw error;
  }

  private relanzarErrorEquipamiento(error: unknown): never {
    if (this.obtenerCodigoError(error) === 'ER_DUP_ENTRY') {
      throw new ConflictException('Ya existe un equipamiento con ese nombre.');
    }

    throw error;
  }

  async listar(filtros: FiltrarAulasDto = {}): Promise<Aula[]> {
    const base: FindOptionsWhere<Aula> = {};

    if (filtros.activo !== undefined) {
      base.activo = filtros.activo;
    }

    if (filtros.tipo !== undefined) {
      base.tipo = filtros.tipo;
    }

    if (filtros.tipoMobiliario !== undefined) {
      base.tipoMobiliario = filtros.tipoMobiliario;
    }

    if (filtros.origen !== undefined) {
      base.origen = filtros.origen;
    }

    if (filtros.capacidadMinima !== undefined) {
      base.capacidad = MoreThanOrEqual(filtros.capacidadMinima);
    }

    const texto = filtros.texto?.trim();

    const where: FindOptionsWhere<Aula> | FindOptionsWhere<Aula>[] = texto
      ? [
          {
            ...base,
            codigo: Like(`%${texto}%`),
          },
          {
            ...base,
            nombre: Like(`%${texto}%`),
          },
          {
            ...base,
            ubicacion: Like(`%${texto}%`),
          },
        ]
      : base;

    return this.aulaRepository.find({
      where,
      order: {
        nombre: 'ASC',
      },
    });
  }

  async obtenerPorId(id: number): Promise<Aula> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearAulaDto, usuarioId?: number): Promise<Aula> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();
    const ubicacion = dto.ubicacion?.trim() || null;

    if (!codigo) {
      throw new BadRequestException('El código del aula es obligatorio.');
    }

    if (!nombre) {
      throw new BadRequestException('El nombre del aula es obligatorio.');
    }

    this.validarNumeroPorOrigen(codigo, dto.origen);
    this.validarCapacidadAula(dto.capacidad);

    await this.validarCodigoDuplicado(codigo, dto.origen);
    await this.validarLimiteOrigen(dto.origen);

    const aula = this.aulaRepository.create({
      codigo,
      nombre,
      ubicacion,
      capacidad: dto.capacidad,
      tipo: dto.tipo,
      tipoMobiliario: dto.tipoMobiliario,
      origen: dto.origen,
      activo: true,
    });

    try {
      const guardada = await this.aulaRepository.save(aula);

      await this.registrarAuditoria({
        aulaId: guardada.id,
        usuarioId,
        accion: 'CREAR',
        entidad: 'AULA',
        entidadId: guardada.id,
        detalle: {
          despues: {
            codigo: guardada.codigo,
            nombre: guardada.nombre,
            ubicacion: guardada.ubicacion,
            capacidad: guardada.capacidad,
            tipo: guardada.tipo,
            tipoMobiliario: guardada.tipoMobiliario,
            origen: guardada.origen,
            activo: guardada.activo,
          },
        },
      });

      return guardada;
    } catch (error) {
      this.relanzarErrorAula(error);
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarAulaDto,
    usuarioId?: number,
  ): Promise<Aula> {
    const aula = await this.obtenerEntidadPorId(id);

    if (
      dto.capacidad !== undefined &&
      dto.capacidad < aula.capacidad &&
      dto.confirmarReduccionCapacidad !== true
    ) {
      throw new ConflictException(
        'La nueva capacidad es menor que la capacidad actual. Debe confirmar explícitamente la reducción.',
      );
    }

    const antes = {
      codigo: aula.codigo,
      nombre: aula.nombre,
      ubicacion: aula.ubicacion,
      capacidad: aula.capacidad,
      tipo: aula.tipo,
      tipoMobiliario: aula.tipoMobiliario,
      origen: aula.origen,
      activo: aula.activo,
    };

    const codigoFinal =
      dto.codigo !== undefined
        ? dto.codigo.trim().toUpperCase()
        : aula.codigo;

    const origenFinal =
      dto.origen !== undefined
        ? dto.origen
        : aula.origen;

    if (!codigoFinal) {
      throw new BadRequestException(
        'El código del aula no puede estar vacío.',
      );
    }

    this.validarNumeroPorOrigen(
      codigoFinal,
      origenFinal,
    );

    await this.validarCodigoDuplicado(
      codigoFinal,
      origenFinal,
      id,
    );

    if (dto.codigo !== undefined) {
      aula.codigo = codigoFinal;
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre del aula no puede estar vacío.',
        );
      }

      aula.nombre = nombre;
    }

    if (dto.ubicacion !== undefined) {
      aula.ubicacion = dto.ubicacion?.trim() || null;
    }

    if (dto.capacidad !== undefined) {
      this.validarCapacidadAula(
        dto.capacidad,
      );

      aula.capacidad = dto.capacidad;
    }

    if (dto.tipo !== undefined) {
      aula.tipo = dto.tipo;
    }

    if (dto.tipoMobiliario !== undefined) {
      aula.tipoMobiliario = dto.tipoMobiliario;
    }

    if (dto.origen !== undefined) {
      if (dto.origen !== aula.origen) {
        await this.validarLimiteOrigen(dto.origen);
      }

      aula.origen = dto.origen;
    }

    try {
      const guardada = await this.aulaRepository.save(aula);

      await this.registrarAuditoria({
        aulaId: guardada.id,
        usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'AULA',
        entidadId: guardada.id,
        detalle: {
          antes,
          despues: {
            codigo: guardada.codigo,
            nombre: guardada.nombre,
            ubicacion: guardada.ubicacion,
            capacidad: guardada.capacidad,
            tipo: guardada.tipo,
            tipoMobiliario: guardada.tipoMobiliario,
            origen: guardada.origen,
            activo: guardada.activo,
          },
        },
      });

      return guardada;
    } catch (error) {
      this.relanzarErrorAula(error);
    }
  }

  async cambiarEstado(
    id: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<Aula> {
    const aula = await this.obtenerEntidadPorId(id);

    if (!activo && aula.activo) {
      const reservaPendiente = await this.reservaAulaRepository.findOne({
        where: {
          aulaId: id,
          activo: true,
          fechaHoraFin: MoreThan(new Date()),
        },
      });

      if (reservaPendiente) {
        throw new ConflictException(
          'No se puede inactivar el aula porque tiene reservas futuras activas. Debe resolverlas primero.',
        );
      }
    }

    const activoAnterior = aula.activo;

    await this.aulaRepository.update(id, { activo });
    const resultado = await this.obtenerEntidadPorId(id);

    await this.registrarAuditoria({
      aulaId: resultado.id,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'AULA',
      entidadId: resultado.id,
      detalle: {
        antes: {
          activo: activoAnterior,
        },
        despues: {
          activo: resultado.activo,
        },
      },
    });

    return resultado;
  }

  async evaluarAulaParaAsignacion(
    aulaId: number,
    dto: BuscarAulasDisponiblesDto,
  ) {
    const aulaEntidad = await this.obtenerEntidadPorId(aulaId);

    if (!aulaEntidad.activo) {
      return {
        aulaId,
        apta: false,
        requiereAutorizacionSobrecupo: false,
        motivo: 'AULA_INACTIVA',
      };
    }

    const candidatas = await this.buscarAulasDisponibles({
      ...dto,

      // Necesitamos verla incluso si tiene
      // sobrecapacidad para poder advertirlo.
      incluirSobrecupo: true,
    });

    const aula = candidatas.find((item) => item.id === aulaId);

    if (!aula) {
      return {
        aulaId,
        apta: false,
        requiereAutorizacionSobrecupo: false,
        motivo: 'AULA_NO_DISPONIBLE_O_NO_CUMPLE_REQUISITOS',
      };
    }

    if (aula.recomendacionCapacidad === 'SOBRECAPACIDAD') {
      return {
        aulaId,
        apta: false,

        requiereAutorizacionSobrecupo: true,

        motivo: 'SOBRECAPACIDAD',

        capacidad: aula.capacidad,

        cantidadEstudiantes: dto.cantidadEstudiantes,

        capacidadSobrante: aula.capacidadSobrante,

        recomendacionCapacidad: aula.recomendacionCapacidad,
      };
    }

    const advertencias: string[] = [];

    if (aula.recomendacionCapacidad === 'AL_LIMITE') {
      advertencias.push('El aula queda exactamente al límite de su capacidad.');
    }

    if (aula.recomendacionCapacidad === 'AJUSTADA') {
      advertencias.push(
        'El aula cumple la capacidad, pero está por debajo del margen recomendado de 5 estudiantes.',
      );
    }

    return {
      aulaId,
      apta: true,

      requiereAutorizacionSobrecupo: false,

      motivo: null,

      capacidad: aula.capacidad,

      cantidadEstudiantes: dto.cantidadEstudiantes ?? null,

      capacidadSobrante: aula.capacidadSobrante,

      recomendacionCapacidad: aula.recomendacionCapacidad,

      advertencias,
    };
  }

  async listarEquipamientos(): Promise<
    Array<
      Equipamiento & {
        cantidadAsignada: number;
        cantidadDisponible: number;
      }
    >
  > {
    const equipamientos = await this.equipamientoRepository.find({
      order: { nombre: 'ASC' },
    });

    return Promise.all(
      equipamientos.map(async (equipamiento) => {
        const resumen = await this.obtenerResumenStockEquipamiento(equipamiento);

        return Object.assign(equipamiento, resumen);
      }),
    );
  }

  async obtenerEquipamientoPorId(id: number): Promise<Equipamiento> {
    return this.obtenerEquipamientoEntidadPorId(id);
  }

  async crearEquipamiento(
    dto: CrearEquipamientoDto,
    usuarioId?: number,
  ): Promise<Equipamiento> {
    const nombre = dto.nombre.trim();
    const descripcion = dto.descripcion?.trim() || null;

    if (!nombre) {
      throw new BadRequestException(
        'El nombre del equipamiento es obligatorio.',
      );
    }

    this.validarCantidadEquipamiento(dto.cantidadTotal, 'La cantidad total');
    await this.validarNombreEquipamientoDuplicado(nombre);

    const equipamiento = this.equipamientoRepository.create({
      nombre,
      descripcion,
      cantidadTotal: dto.cantidadTotal,
      activo: true,
    });

    try {
      const guardada = await this.equipamientoRepository.save(equipamiento);

      await this.registrarAuditoria({
        aulaId: null,
        usuarioId,
        accion: 'CREAR',
        entidad: 'EQUIPAMIENTO',
        entidadId: guardada.id,
        detalle: {
          despues: {
            nombre: guardada.nombre,
            descripcion: guardada.descripcion,
            cantidadTotal: guardada.cantidadTotal,
            activo: guardada.activo,
          },
        },
      });

      return guardada;
    } catch (error) {
      this.relanzarErrorEquipamiento(error);
    }
  }

  async actualizarEquipamiento(
    id: number,
    dto: ActualizarEquipamientoDto,
    usuarioId?: number,
  ): Promise<Equipamiento> {
    const equipamiento = await this.obtenerEquipamientoEntidadPorId(id);
    const antes = {
      nombre: equipamiento.nombre,
      descripcion: equipamiento.descripcion,
      cantidadTotal: equipamiento.cantidadTotal,
    };

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();

      if (!nombre) {
        throw new BadRequestException(
          'El nombre del equipamiento no puede estar vacío.',
        );
      }

      await this.validarNombreEquipamientoDuplicado(nombre, id);
      equipamiento.nombre = nombre;
    }

    if (dto.descripcion !== undefined) {
      equipamiento.descripcion = dto.descripcion?.trim() || null;
    }

    if (dto.cantidadTotal !== undefined) {
      this.validarCantidadEquipamiento(dto.cantidadTotal, 'La cantidad total');

      const cantidadAsignada = await this.obtenerCantidadAsignadaEquipamiento(id);

      if (dto.cantidadTotal < cantidadAsignada) {
        throw new ConflictException(
          `No puede reducir la cantidad total a ${dto.cantidadTotal} porque ` +
            `actualmente hay ${cantidadAsignada} unidad${cantidadAsignada === 1 ? '' : 'es'} asignada${cantidadAsignada === 1 ? '' : 's'} a aulas.`,
        );
      }

      equipamiento.cantidadTotal = dto.cantidadTotal;
    }

    try {
      await this.equipamientoRepository.save(equipamiento);

      await this.registrarAuditoria({
        aulaId: null,
        usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'EQUIPAMIENTO',
        entidadId: id,
        detalle: {
          antes,
          despues: {
            nombre: equipamiento.nombre,
            descripcion: equipamiento.descripcion,
            cantidadTotal: equipamiento.cantidadTotal,
          },
        },
      });
    } catch (error) {
      this.relanzarErrorEquipamiento(error);
    }

    return this.obtenerEquipamientoEntidadPorId(id);
  }

  async cambiarEstadoEquipamiento(
    id: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<Equipamiento> {
    await this.obtenerEquipamientoEntidadPorId(id);

    if (!activo) {
      const asignacionActiva = await this.aulaEquipamientoRepository.findOne({
        where: { equipamientoId: id, activo: true },
      });

      if (asignacionActiva) {
        throw new ConflictException(
          'No se puede inactivar el equipamiento porque está asignado a una o más aulas.',
        );
      }
    }

    await this.equipamientoRepository.update(id, { activo });

    await this.registrarAuditoria({
      aulaId: null,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'EQUIPAMIENTO',
      entidadId: id,
      detalle: { activo },
    });

    return this.obtenerEquipamientoEntidadPorId(id);
  }

  async listarEquipamientoAula(aulaId: number): Promise<AulaEquipamiento[]> {
    await this.obtenerEntidadPorId(aulaId);

    return this.aulaEquipamientoRepository.find({
      where: { aulaId, activo: true },
      relations: { equipamiento: true },
      order: { id: 'ASC' },
    });
  }

  async asignarEquipamientoAula(
    aulaId: number,
    dto: AsignarEquipamientoAulaDto,
    usuarioId?: number,
  ): Promise<AulaEquipamiento> {
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede asignar equipamiento a un aula inactiva.',
      );
    }

    const equipamiento = await this.obtenerEquipamientoEntidadPorId(
      dto.equipamientoId,
    );

    if (!equipamiento.activo) {
      throw new BadRequestException(
        'No se puede asignar un equipamiento inactivo.',
      );
    }

    const existente = await this.aulaEquipamientoRepository.findOne({
      where: { aulaId, equipamientoId: dto.equipamientoId },
    });

    if (existente?.activo) {
      throw new ConflictException('Este equipamiento ya está asignado al aula.');
    }

    await this.validarStockParaAsignacion(
      equipamiento,
      dto.cantidadAsignada,
      existente?.id,
    );

    const ahora = new Date();
    const relacion = existente ??
      this.aulaEquipamientoRepository.create({
        aulaId,
        equipamientoId: equipamiento.id,
      });

    relacion.cantidadAsignada = dto.cantidadAsignada;
    relacion.observaciones = dto.observaciones?.trim() || null;
    relacion.activo = true;
    relacion.asignadoEn = ahora;
    relacion.retiradoEn = null;

    try {
      const guardada = await this.aulaEquipamientoRepository.save(relacion);

      await this.registrarAuditoria({
        aulaId,
        usuarioId,
        accion: 'ASIGNAR_EQUIPAMIENTO',
        entidad: 'AULA_EQUIPAMIENTO',
        entidadId: guardada.id,
        detalle: {
          equipamientoId: guardada.equipamientoId,
          cantidadAsignada: guardada.cantidadAsignada,
          observaciones: guardada.observaciones,
          asignadoEn: guardada.asignadoEn,
          activo: guardada.activo,
        },
      });

      return this.obtenerEquipamientoAula(aulaId, equipamiento.id);
    } catch (error) {
      if (this.obtenerCodigoError(error) === 'ER_DUP_ENTRY') {
        throw new ConflictException('Este equipamiento ya está asignado al aula.');
      }

      throw error;
    }
  }

  async actualizarEquipamientoAula(
    aulaId: number,
    equipamientoId: number,
    dto: ActualizarEquipamientoAulaDto,
    usuarioId?: number,
  ): Promise<AulaEquipamiento> {
    const relacion = await this.obtenerEquipamientoAula(aulaId, equipamientoId);

    if (!relacion.activo) {
      throw new ConflictException(
        'Este equipamiento ya no se encuentra asignado al aula.',
      );
    }

    const equipamiento = await this.obtenerEquipamientoEntidadPorId(equipamientoId);
    const cantidadAsignada = dto.cantidadAsignada ?? relacion.cantidadAsignada;

    await this.validarStockParaAsignacion(
      equipamiento,
      cantidadAsignada,
      relacion.id,
    );

    const antes = {
      cantidadAsignada: relacion.cantidadAsignada,
      observaciones: relacion.observaciones,
    };

    relacion.cantidadAsignada = cantidadAsignada;

    if (dto.observaciones !== undefined) {
      relacion.observaciones = dto.observaciones?.trim() || null;
    }

    await this.aulaEquipamientoRepository.save(relacion);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ACTUALIZAR_EQUIPAMIENTO',
      entidad: 'AULA_EQUIPAMIENTO',
      entidadId: relacion.id,
      detalle: {
        antes,
        despues: {
          cantidadAsignada: relacion.cantidadAsignada,
          observaciones: relacion.observaciones,
        },
      },
    });

    return this.obtenerEquipamientoAula(aulaId, equipamientoId);
  }

  async desasignarEquipamientoAula(
    aulaId: number,
    equipamientoId: number,
    usuarioId?: number,
  ): Promise<AulaEquipamiento> {
    const relacion = await this.obtenerEquipamientoAula(aulaId, equipamientoId);

    if (!relacion.activo) {
      return relacion;
    }

    relacion.activo = false;
    relacion.retiradoEn = new Date();

    await this.aulaEquipamientoRepository.save(relacion);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'DESASIGNAR_EQUIPAMIENTO',
      entidad: 'AULA_EQUIPAMIENTO',
      entidadId: relacion.id,
      detalle: {
        equipamientoId,
        cantidadLiberada: relacion.cantidadAsignada,
        retiradoEn: relacion.retiradoEn,
      },
    });

    return relacion;
  }

  async cambiarEstadoEquipamientoAula(
    aulaId: number,
    equipamientoId: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<AulaEquipamiento> {
    if (!activo) {
      return this.desasignarEquipamientoAula(
        aulaId,
        equipamientoId,
        usuarioId,
      );
    }

    const relacion = await this.obtenerEquipamientoAula(aulaId, equipamientoId);

    if (relacion.activo) {
      return relacion;
    }

    const aula = await this.obtenerEntidadPorId(aulaId);
    const equipamiento = await this.obtenerEquipamientoEntidadPorId(equipamientoId);

    if (!aula.activo || !equipamiento.activo) {
      throw new BadRequestException(
        'No se puede reactivar la asignación porque el aula o el equipamiento está inactivo.',
      );
    }

    await this.validarStockParaAsignacion(
      equipamiento,
      relacion.cantidadAsignada,
      relacion.id,
    );

    relacion.activo = true;
    relacion.asignadoEn = new Date();
    relacion.retiradoEn = null;
    await this.aulaEquipamientoRepository.save(relacion);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ASIGNAR_EQUIPAMIENTO',
      entidad: 'AULA_EQUIPAMIENTO',
      entidadId: relacion.id,
      detalle: {
        equipamientoId,
        cantidadAsignada: relacion.cantidadAsignada,
        reactivacion: true,
      },
    });

    return this.obtenerEquipamientoAula(aulaId, equipamientoId);
  }

  async listarIndisponibilidadesAula(
    aulaId: number,
  ): Promise<IndisponibilidadAula[]> {
    await this.obtenerEntidadPorId(aulaId);

    return this.indisponibilidadAulaRepository.find({
      where: { aulaId },
      order: { fechaHoraInicio: 'ASC' },
    });
  }

  async obtenerIndisponibilidadPorId(
    aulaId: number,
    id: number,
  ): Promise<IndisponibilidadAula> {
    await this.obtenerEntidadPorId(aulaId);
    return this.obtenerIndisponibilidadAula(aulaId, id);
  }

  async crearIndisponibilidadAula(
    aulaId: number,
    dto: CrearIndisponibilidadAulaDto,
    usuarioId?: number,
  ): Promise<IndisponibilidadAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.crearIndisponibilidadAula(aulaId, dto, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede registrar una indisponibilidad en un aula inactiva.',
      );
    }

    const inicio = this.convertirFechaHora(dto.fechaHoraInicio);
    const fin = this.convertirFechaHora(dto.fechaHoraFin);
    this.validarRangoIndisponibilidad(inicio, fin);
    await this.validarCruceIndisponibilidad(aulaId, inicio, fin);

    const motivo = dto.motivo.trim();

    if (!motivo) {
      throw new BadRequestException(
        'El motivo de la indisponibilidad es obligatorio.',
      );
    }

    const indisponibilidad = this.indisponibilidadAulaRepository.create({
      aulaId,
      tipo: dto.tipo,
      fechaHoraInicio: inicio,
      fechaHoraFin: fin,
      motivo,
      activo: true,
    });

    const guardada =
      await this.indisponibilidadAulaRepository.save(indisponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CREAR',
      entidad: 'INDISPONIBILIDAD',
      entidadId: guardada.id,
      detalle: {
        tipo: guardada.tipo,
        fechaHoraInicio: guardada.fechaHoraInicio,
        fechaHoraFin: guardada.fechaHoraFin,
        motivo: guardada.motivo,
        activo: guardada.activo,
      },
    });

    if (!this.notificacionesService) throw new ServiceUnavailableException('Servicio de notificaciones no disponible.');
    await this.notificarAfectacionesIndisponibilidad(aula, guardada, inicio, fin, motivo);

    return guardada;
  }


  async obtenerSesionesAfectadasPorIndisponibilidad(
    aulaId: number,
    inicio: Date,
    fin: Date,
  ): Promise<
    Array<{
      horarioId: number;
      grupoId: number;
      numeroGrupo: string;
      cursoCodigo: string;
      cursoNombre: string;
      carreraId: number | null;
      docenteUsuarioId: number | null;
      docenteNombre: string | null;
      fecha: string;
      horaInicio: string;
      horaFin: string;
    }>
  > {
    const executor = this.ocupacionManager ?? this.dataSource;
    const rows: any[] = await executor.query(
          `SELECT
            hg.id AS horarioId,
            hg.grupo_id AS grupoId,
            hg.aula_id AS aulaId,
            hg.dia_semana AS diaSemana,
            hg.hora_inicio AS horaInicio,
            hg.hora_fin AS horaFin,
            g.numero_grupo AS numeroGrupo,
            g.profesor_id AS profesorId,
            c.codigo AS cursoCodigo,
            c.nombre AS cursoNombre,
            cc.carrera_id AS carreraId,
            u_prof.id AS docenteUsuarioId,
            COALESCE(CONCAT(u_prof.nombres, ' ', u_prof.apellido1), CONCAT(p.nombres, ' ', p.apellido1)) AS docenteNombre,
            pa.fecha_inicio AS periodoInicio,
            pa.fecha_fin AS periodoFin
          FROM horarios_grupo hg
          INNER JOIN grupos g ON g.id = hg.grupo_id
          INNER JOIN periodos_academicos pa ON pa.id = g.periodo_id
          LEFT JOIN cursos c ON c.id = g.curso_id
          LEFT JOIN (SELECT curso_id, CASE WHEN COUNT(*) = 1 THEN MIN(carrera_id) ELSE NULL END AS carrera_id
            FROM curso_carreras GROUP BY curso_id) cc ON cc.curso_id = c.id
          LEFT JOIN profesores p ON p.id = g.profesor_id
          LEFT JOIN usuarios u_prof ON (u_prof.cedula = p.cedula OR u_prof.correo = p.correo) AND u_prof.activo = 1
          WHERE hg.aula_id = ?`,
          [aulaId],
        );

    const sesionesAfectadas: Array<{
      horarioId: number;
      grupoId: number;
      numeroGrupo: string;
      cursoCodigo: string;
      cursoNombre: string;
      carreraId: number | null;
      docenteUsuarioId: number | null;
      docenteNombre: string | null;
      fecha: string;
      horaInicio: string;
      horaFin: string;
    }> = [];

    const iterador = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
    const fechaPeriodo = (value: unknown): string | null => {
      if (!value) return null;
      if (value instanceof Date) {
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
      }
      return String(value).slice(0, 10);
    };

    while (iterador.getTime() <= finDia.getTime()) {
      const anio = iterador.getFullYear();
      const mes = String(iterador.getMonth() + 1).padStart(2, '0');
      const dia = String(iterador.getDate()).padStart(2, '0');
      const fechaStr = `${anio}-${mes}-${dia}`;
      const diaSemana = this.obtenerDiaSemana(fechaStr);

      for (const row of rows) {
        if (Number(row.diaSemana) === diaSemana &&
          (!row.periodoInicio || fechaStr >= fechaPeriodo(row.periodoInicio)!) &&
          (!row.periodoFin || fechaStr <= fechaPeriodo(row.periodoFin)!)) {
          const horaInicioStr = String(row.horaInicio || '00:00:00').padStart(8, '0');
          const horaFinStr = String(row.horaFin || '00:00:00').padStart(8, '0');
          const [hIni, mIni, sIni] = horaInicioStr.split(':').map(Number);
          const [hFin, mFin, sFin] = horaFinStr.split(':').map(Number);

          const sesionInicio = new Date(iterador.getFullYear(), iterador.getMonth(), iterador.getDate(), hIni, mIni, sIni || 0);
          const sesionFin = new Date(iterador.getFullYear(), iterador.getMonth(), iterador.getDate(), hFin, mFin, sFin || 0);

          if (sesionInicio.getTime() < fin.getTime() && sesionFin.getTime() > inicio.getTime()) {
            sesionesAfectadas.push({
              horarioId: Number(row.horarioId),
              grupoId: Number(row.grupoId),
              numeroGrupo: String(row.numeroGrupo || ''),
              cursoCodigo: String(row.cursoCodigo || ''),
              cursoNombre: String(row.cursoNombre || ''),
              carreraId: row.carreraId ? Number(row.carreraId) : null,
              docenteUsuarioId: row.docenteUsuarioId ? Number(row.docenteUsuarioId) : null,
              docenteNombre: row.docenteNombre ? String(row.docenteNombre) : null,
              fecha: fechaStr,
              horaInicio: horaInicioStr,
              horaFin: horaFinStr,
            });
          }
        }
      }

      iterador.setDate(iterador.getDate() + 1);
    }

    return sesionesAfectadas;
  }

  async notificarAfectacionesIndisponibilidad(
    aula: Aula,
    indisponibilidad: IndisponibilidadAula,
    inicio: Date,
    fin: Date,
    motivo: string,
  ): Promise<number> {
    if (!this.notificacionesService) throw new ServiceUnavailableException('Servicio de notificaciones no disponible.');

    const sesiones = await this.obtenerSesionesAfectadasPorIndisponibilidad(
      aula.id,
      inicio,
      fin,
    );

    const notificados = new Set<string>();
    let conteoNotificaciones = 0;

    for (const sesion of sesiones) {
      if (!sesion.docenteUsuarioId) continue;
      const dedupeKey = `${sesion.docenteUsuarioId}-${sesion.horarioId}-${sesion.fecha}`;
      if (notificados.has(dedupeKey)) continue;
      notificados.add(dedupeKey);

      await this.notificacionesService.crear({
        claveIdempotencia: `aula:${indisponibilidad.id}:${sesion.docenteUsuarioId}:${sesion.horarioId}:${sesion.fecha}`,
        usuarioId: sesion.docenteUsuarioId,
        carreraId: sesion.carreraId,
        tipo: 'INDISPONIBILIDAD_AULA',
        titulo: 'Afectación de aula por indisponibilidad',
        mensaje: `Se ha registrado una indisponibilidad en el aula ${aula.codigo || aula.nombre || aula.id} por motivo: "${motivo}". Su clase de ${sesion.cursoNombre || sesion.cursoCodigo || 'curso'} (Grupo ${sesion.numeroGrupo}) programada para el ${sesion.fecha} de ${sesion.horaInicio.slice(0, 5)} a ${sesion.horaFin.slice(0, 5)} ha sido afectada. Por favor gestione un aula alterna o coordine la reprogramación de la sesión.`,
        metadatos: {
          indisponibilidadId: indisponibilidad.id,
          aulaId: aula.id,
          aulaCodigo: aula.codigo,
          cursoCodigo: sesion.cursoCodigo,
          cursoNombre: sesion.cursoNombre,
          grupoId: sesion.grupoId,
          numeroGrupo: sesion.numeroGrupo,
          horarioId: sesion.horarioId,
          fecha: sesion.fecha,
          horaInicio: sesion.horaInicio,
          horaFin: sesion.horaFin,
          motivo,
        },
      });
      conteoNotificaciones++;
    }

    return conteoNotificaciones;
  }

  async actualizarIndisponibilidadAula(
    aulaId: number,
    id: number,
    dto: ActualizarIndisponibilidadAulaDto,
    usuarioId?: number,
  ): Promise<IndisponibilidadAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.actualizarIndisponibilidadAula(aulaId, id, dto, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);
    this.validarAulaActivaParaOcupacion(aula);
    const indisponibilidad = await this.obtenerIndisponibilidadAula(aulaId, id);

    const antes = {
      tipo: indisponibilidad.tipo,
      fechaHoraInicio: indisponibilidad.fechaHoraInicio,
      fechaHoraFin: indisponibilidad.fechaHoraFin,
      motivo: indisponibilidad.motivo,
      activo: indisponibilidad.activo,
    };

    const inicio =
      dto.fechaHoraInicio !== undefined
        ? this.convertirFechaHora(dto.fechaHoraInicio)
        : new Date(indisponibilidad.fechaHoraInicio);
    const fin =
      dto.fechaHoraFin !== undefined
        ? this.convertirFechaHora(dto.fechaHoraFin)
        : new Date(indisponibilidad.fechaHoraFin);

    this.validarRangoIndisponibilidad(inicio, fin);
    await this.validarCruceIndisponibilidad(aulaId, inicio, fin, id);

    if (dto.tipo !== undefined) indisponibilidad.tipo = dto.tipo;
    if (dto.fechaHoraInicio !== undefined)
      indisponibilidad.fechaHoraInicio = inicio;
    if (dto.fechaHoraFin !== undefined) indisponibilidad.fechaHoraFin = fin;

    if (dto.motivo !== undefined) {
      const motivo = dto.motivo.trim();

      if (!motivo) {
        throw new BadRequestException(
          'El motivo de la indisponibilidad no puede estar vacío.',
        );
      }

      indisponibilidad.motivo = motivo;
    }

    await this.indisponibilidadAulaRepository.save(indisponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'INDISPONIBILIDAD',
      entidadId: indisponibilidad.id,
      detalle: {
        antes,
        despues: {
          tipo: indisponibilidad.tipo,
          fechaHoraInicio: indisponibilidad.fechaHoraInicio,
          fechaHoraFin: indisponibilidad.fechaHoraFin,
          motivo: indisponibilidad.motivo,
          activo: indisponibilidad.activo,
        },
      },
    });

    return this.obtenerIndisponibilidadAula(aulaId, id);
  }

  async cambiarEstadoIndisponibilidadAula(
    aulaId: number,
    id: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<IndisponibilidadAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.cambiarEstadoIndisponibilidadAula(aulaId, id, activo, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);
    const indisponibilidad = await this.obtenerIndisponibilidadAula(aulaId, id);

    if (activo && !indisponibilidad.activo) {
      this.validarAulaActivaParaOcupacion(aula);
      await this.validarCruceIndisponibilidad(
        aulaId,
        new Date(indisponibilidad.fechaHoraInicio),
        new Date(indisponibilidad.fechaHoraFin),
        id,
      );
    }

    const activoAnterior = indisponibilidad.activo;
    indisponibilidad.activo = activo;
    await this.indisponibilidadAulaRepository.save(indisponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'INDISPONIBILIDAD',
      entidadId: indisponibilidad.id,
      detalle: {
        antes: { activo: activoAnterior },
        despues: { activo: indisponibilidad.activo },
      },
    });

    return this.obtenerIndisponibilidadAula(aulaId, id);
  }

  async listarReservasAula(aulaId: number): Promise<ReservaAula[]> {
    await this.obtenerEntidadPorId(aulaId);

    return this.reservaAulaRepository.find({
      where: { aulaId },
      order: { fechaHoraInicio: 'ASC' },
    });
  }

  async obtenerReservaPorId(aulaId: number, id: number): Promise<ReservaAula> {
    await this.obtenerEntidadPorId(aulaId);
    return this.obtenerReservaAula(aulaId, id);
  }

  async crearReservaAula(
    aulaId: number,
    dto: CrearReservaAulaDto,
    usuarioId?: number,
  ): Promise<ReservaAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.crearReservaAula(aulaId, dto, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException('No se puede reservar un aula inactiva.');
    }

    const inicio = this.convertirFechaHora(dto.fechaHoraInicio);
    const fin = this.convertirFechaHora(dto.fechaHoraFin);
    this.validarRangoIndisponibilidad(inicio, fin);
    await this.validarCruceReserva(aulaId, inicio, fin);

    const titulo = dto.titulo.trim();

    if (!titulo) {
      throw new BadRequestException('El título de la reserva es obligatorio.');
    }

    const reserva = this.reservaAulaRepository.create({
      aulaId,
      tipo: dto.tipo,
      titulo,
      descripcion: dto.descripcion?.trim() || null,
      fechaHoraInicio: inicio,
      fechaHoraFin: fin,
      activo: true,
    });

    const guardada = await this.reservaAulaRepository.save(reserva);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CREAR',
      entidad: 'RESERVA',
      entidadId: guardada.id,
      detalle: {
        tipo: guardada.tipo,
        titulo: guardada.titulo,
        descripcion: guardada.descripcion,
        fechaHoraInicio: guardada.fechaHoraInicio,
        fechaHoraFin: guardada.fechaHoraFin,
        activo: guardada.activo,
      },
    });

    return guardada;
  }

  async actualizarReservaAula(
    aulaId: number,
    id: number,
    dto: ActualizarReservaAulaDto,
    usuarioId?: number,
  ): Promise<ReservaAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.actualizarReservaAula(aulaId, id, dto, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);
    this.validarAulaActivaParaOcupacion(aula);
    const reserva = await this.obtenerReservaAula(aulaId, id);

    const antes = {
      tipo: reserva.tipo,
      titulo: reserva.titulo,
      descripcion: reserva.descripcion,
      fechaHoraInicio: reserva.fechaHoraInicio,
      fechaHoraFin: reserva.fechaHoraFin,
      activo: reserva.activo,
    };

    const inicio =
      dto.fechaHoraInicio !== undefined
        ? this.convertirFechaHora(dto.fechaHoraInicio)
        : new Date(reserva.fechaHoraInicio);
    const fin =
      dto.fechaHoraFin !== undefined
        ? this.convertirFechaHora(dto.fechaHoraFin)
        : new Date(reserva.fechaHoraFin);

    this.validarRangoIndisponibilidad(inicio, fin);
    await this.validarCruceReserva(aulaId, inicio, fin, id);

    if (dto.tipo !== undefined) reserva.tipo = dto.tipo;

    if (dto.titulo !== undefined) {
      const titulo = dto.titulo.trim();

      if (!titulo) {
        throw new BadRequestException(
          'El título de la reserva no puede estar vacío.',
        );
      }

      reserva.titulo = titulo;
    }

    if (dto.descripcion !== undefined) {
      reserva.descripcion = dto.descripcion?.trim() || null;
    }

    if (dto.fechaHoraInicio !== undefined) reserva.fechaHoraInicio = inicio;
    if (dto.fechaHoraFin !== undefined) reserva.fechaHoraFin = fin;

    await this.reservaAulaRepository.save(reserva);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ACTUALIZAR',
      entidad: 'RESERVA',
      entidadId: reserva.id,
      detalle: {
        antes,
        despues: {
          tipo: reserva.tipo,
          titulo: reserva.titulo,
          descripcion: reserva.descripcion,
          fechaHoraInicio: reserva.fechaHoraInicio,
          fechaHoraFin: reserva.fechaHoraFin,
          activo: reserva.activo,
        },
      },
    });

    return this.obtenerReservaAula(aulaId, id);
  }

  async cambiarEstadoReservaAula(
    aulaId: number,
    id: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<ReservaAula> {
    if (!this.enTransaccionOcupacion) {
      return this.ejecutarOcupacionEnTransaccion([aulaId], (servicio) =>
        servicio.cambiarEstadoReservaAula(aulaId, id, activo, usuarioId),
      );
    }
    const aula = await this.obtenerEntidadPorId(aulaId);
    const reserva = await this.obtenerReservaAula(aulaId, id);

    if (activo) {
      if (!aula.activo) {
        throw new BadRequestException(
          'No se puede reactivar una reserva en un aula inactiva.',
        );
      }

      if (!reserva.activo) {
        await this.validarCruceReserva(
          aulaId,
          new Date(reserva.fechaHoraInicio),
          new Date(reserva.fechaHoraFin),
          id,
        );
      }
    }

    const activoAnterior = reserva.activo;
    reserva.activo = activo;
    await this.reservaAulaRepository.save(reserva);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'RESERVA',
      entidadId: reserva.id,
      detalle: {
        antes: { activo: activoAnterior },
        despues: { activo: reserva.activo },
      },
    });

    return this.obtenerReservaAula(aulaId, id);
  }

  async consultarOcupacionAula(aulaId: number, dto: ConsultarOcupacionAulaDto) {
    const aula = await this.obtenerEntidadPorId(aulaId);

    const inicio = this.convertirFechaHora(dto.fechaHoraInicio);
    const fin = this.convertirFechaHora(dto.fechaHoraFin);

    this.validarRangoIndisponibilidad(inicio, fin);

    const [indisponibilidades, reservas] = await Promise.all([
      this.indisponibilidadAulaRepository.find({
        where: {
          aulaId,
          activo: true,
          fechaHoraInicio: LessThan(fin),
          fechaHoraFin: MoreThan(inicio),
        },
        order: {
          fechaHoraInicio: 'ASC',
        },
      }),

      this.reservaAulaRepository.find({
        where: {
          aulaId,
          activo: true,
          fechaHoraInicio: LessThan(fin),
          fechaHoraFin: MoreThan(inicio),
        },
        order: {
          fechaHoraInicio: 'ASC',
        },
      }),
    ]);

    const ocupaciones = [
      ...indisponibilidades.map((item) => ({
        id: item.id,
        origen: 'INDISPONIBILIDAD',
        tipo: item.tipo,
        titulo: item.motivo,
        fechaHoraInicio: item.fechaHoraInicio,
        fechaHoraFin: item.fechaHoraFin,
      })),

      ...reservas.map((reserva) => ({
        id: reserva.id,
        origen: 'RESERVA',
        tipo: reserva.tipo,
        titulo: reserva.titulo,
        descripcion: reserva.descripcion,
        fechaHoraInicio: reserva.fechaHoraInicio,
        fechaHoraFin: reserva.fechaHoraFin,
      })),
    ].sort(
      (a, b) =>
        new Date(a.fechaHoraInicio).getTime() -
        new Date(b.fechaHoraInicio).getTime(),
    );

    return {
      aula: {
        id: aula.id,
        codigo: aula.codigo,
        nombre: aula.nombre,
        capacidad: aula.capacidad,
        tipo: aula.tipo,
      },

      fechaHoraInicio: inicio,
      fechaHoraFin: fin,

      ocupaciones,
    };
  }

  private async registrarAuditoria(datos: {
    aulaId?: number | null;
    usuarioId?: number | null;
    accion: string;
    entidad: string;
    entidadId?: number | null;
    detalle?: unknown;
  }): Promise<void> {
    const auditoria = this.auditoriaAulaRepository.create({
      aulaId: datos.aulaId ?? null,
      usuarioId: datos.usuarioId ?? null,
      accion: datos.accion,
      entidad: datos.entidad,
      entidadId: datos.entidadId ?? null,
      detalle:
        datos.detalle !== undefined ? JSON.stringify(datos.detalle) : null,
    });

    await this.auditoriaAulaRepository.save(auditoria);
  }

  async listarAuditoriaAula(aulaId: number): Promise<AuditoriaAula[]> {
    await this.obtenerEntidadPorId(aulaId);

    return this.auditoriaAulaRepository.find({
      where: {
        aulaId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  private convertirHoraAMinutos(hora: string): number {
    const partes = hora.split(':');

    if (partes.length < 2) {
      throw new BadRequestException('La hora indicada no es válida.');
    }

    const horas = Number(partes[0]);
    const minutos = Number(partes[1]);

    if (
      !Number.isInteger(horas) ||
      !Number.isInteger(minutos) ||
      horas < 0 ||
      horas > 23 ||
      minutos < 0 ||
      minutos > 59
    ) {
      throw new BadRequestException('La hora indicada no es válida.');
    }

    return horas * 60 + minutos;
  }

  private validarRangoHoras(horaInicio: string, horaFin: string): void {
    const inicio = this.convertirHoraAMinutos(horaInicio);

    const fin = this.convertirHoraAMinutos(horaFin);

    if (inicio >= fin) {
      throw new BadRequestException(
        'La hora de finalización debe ser posterior a la hora de inicio.',
      );
    }
  }

  private async validarPeriodoDisponibilidadEditable(periodoId: number) {
    const periodo =
      await this.periodosAcademicosService.obtenerPorId(periodoId);

    if (
      periodo.estado !== EstadoPeriodoAcademico.BORRADOR &&
      periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION
    ) {
      throw new BadRequestException(
        'La disponibilidad del aula solo puede modificarse cuando el periodo está en BORRADOR o EN_PREPARACION.',
      );
    }

    return periodo;
  }

  private async obtenerDisponibilidadAula(
    aulaId: number,
    id: number,
  ): Promise<DisponibilidadAula> {
    const disponibilidad = await this.disponibilidadAulaRepository.findOne({
      where: {
        id,
        aulaId,
      },
    });

    if (!disponibilidad) {
      throw new NotFoundException(
        'Bloque de disponibilidad del aula no encontrado.',
      );
    }

    return disponibilidad;
  }

  private async validarCruceDisponibilidadAula(
    aulaId: number,
    periodoId: number,
    diaSemana: number,
    horaInicio: string,
    horaFin: string,
    excluirId?: number,
  ): Promise<void> {
    const bloques = await this.disponibilidadAulaRepository.find({
      where: {
        aulaId,
        periodoId,
        diaSemana,
      },
    });

    const nuevoInicio = this.convertirHoraAMinutos(horaInicio);

    const nuevoFin = this.convertirHoraAMinutos(horaFin);

    const hayCruce = bloques.some((bloque) => {
      if (excluirId !== undefined && bloque.id === excluirId) {
        return false;
      }

      const inicioExistente = this.convertirHoraAMinutos(bloque.horaInicio);

      const finExistente = this.convertirHoraAMinutos(bloque.horaFin);

      return nuevoInicio < finExistente && nuevoFin > inicioExistente;
    });

    if (hayCruce) {
      throw new ConflictException(
        'El aula ya tiene un bloque de disponibilidad que se cruza con este horario.',
      );
    }
  }

  async listarDisponibilidadesAula(
    aulaId: number,
    periodoId: number,
  ): Promise<DisponibilidadAula[]> {
    await this.obtenerEntidadPorId(aulaId);

    await this.periodosAcademicosService.obtenerPorId(periodoId);

    return this.disponibilidadAulaRepository.find({
      where: {
        aulaId,
        periodoId,
      },
      order: {
        diaSemana: 'ASC',
        horaInicio: 'ASC',
      },
    });
  }

  async crearDisponibilidadAula(
    aulaId: number,
    dto: CrearDisponibilidadAulaDto,
    usuarioId?: number,
  ): Promise<DisponibilidadAula> {
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede configurar disponibilidad para un aula inactiva.',
      );
    }

    await this.validarPeriodoDisponibilidadEditable(dto.periodoId);

    this.validarRangoHoras(dto.horaInicio, dto.horaFin);

    await this.validarCruceDisponibilidadAula(
      aulaId,
      dto.periodoId,
      dto.diaSemana,
      dto.horaInicio,
      dto.horaFin,
    );

    const disponibilidad = this.disponibilidadAulaRepository.create({
      aulaId,
      periodoId: dto.periodoId,
      diaSemana: dto.diaSemana,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
    });

    const guardada =
      await this.disponibilidadAulaRepository.save(disponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CREAR_DISPONIBILIDAD',
      entidad: 'DISPONIBILIDAD_AULA',
      entidadId: guardada.id,
      detalle: {
        periodoId: guardada.periodoId,
        diaSemana: guardada.diaSemana,
        horaInicio: guardada.horaInicio,
        horaFin: guardada.horaFin,
      },
    });

    return guardada;
  }

  async actualizarDisponibilidadAula(
    aulaId: number,
    id: number,
    dto: ActualizarDisponibilidadAulaDto,
    usuarioId?: number,
  ): Promise<DisponibilidadAula> {
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede modificar la disponibilidad de un aula inactiva.',
      );
    }

    const disponibilidad = await this.obtenerDisponibilidadAula(aulaId, id);

    await this.validarPeriodoDisponibilidadEditable(disponibilidad.periodoId);

    const diaSemana = dto.diaSemana ?? disponibilidad.diaSemana;

    const horaInicio = dto.horaInicio ?? disponibilidad.horaInicio;

    const horaFin = dto.horaFin ?? disponibilidad.horaFin;

    this.validarRangoHoras(horaInicio, horaFin);

    await this.validarCruceDisponibilidadAula(
      aulaId,
      disponibilidad.periodoId,
      diaSemana,
      horaInicio,
      horaFin,
      id,
    );

    const antes = {
      diaSemana: disponibilidad.diaSemana,
      horaInicio: disponibilidad.horaInicio,
      horaFin: disponibilidad.horaFin,
    };

    disponibilidad.diaSemana = diaSemana;

    disponibilidad.horaInicio = horaInicio;

    disponibilidad.horaFin = horaFin;

    const guardada =
      await this.disponibilidadAulaRepository.save(disponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ACTUALIZAR_DISPONIBILIDAD',
      entidad: 'DISPONIBILIDAD_AULA',
      entidadId: guardada.id,
      detalle: {
        antes,
        despues: {
          diaSemana: guardada.diaSemana,
          horaInicio: guardada.horaInicio,
          horaFin: guardada.horaFin,
        },
      },
    });

    return guardada;
  }

  async eliminarDisponibilidadAula(
    aulaId: number,
    id: number,
    usuarioId?: number,
  ) {
    const aula = await this.obtenerEntidadPorId(aulaId);

    if (!aula.activo) {
      throw new BadRequestException(
        'No se puede modificar la disponibilidad de un aula inactiva.',
      );
    }

    const disponibilidad = await this.obtenerDisponibilidadAula(aulaId, id);

    await this.validarPeriodoDisponibilidadEditable(disponibilidad.periodoId);

    await this.disponibilidadAulaRepository.delete(id);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'ELIMINAR_DISPONIBILIDAD',
      entidad: 'DISPONIBILIDAD_AULA',
      entidadId: id,
      detalle: {
        periodoId: disponibilidad.periodoId,
        diaSemana: disponibilidad.diaSemana,
        horaInicio: disponibilidad.horaInicio,
        horaFin: disponibilidad.horaFin,
      },
    });

    return {
      message: 'Bloque de disponibilidad eliminado correctamente.',
    };
  }
}
