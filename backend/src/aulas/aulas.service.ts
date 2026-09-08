import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  In,
  LessThan,
  Like,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodosAcademicosService } from '../periodos-academicos/periodos-academicos.service';
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
import { AulaEquipamiento } from './entities/aula-equipamiento.entity';
import { Aula } from './entities/aula.entity';
import { AuditoriaAula } from './entities/auditoria-aula.entity';
import { DisponibilidadAula } from './entities/disponibilidad-aula.entity';
import { Equipamiento } from './entities/equipamiento.entity';
import { IndisponibilidadAula } from './entities/indisponibilidad-aula.entity';
import { ReservaAula } from './entities/reserva-aula.entity';

@Injectable()
export class AulasService {
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
  ) {}

  private async obtenerEntidadPorId(id: number): Promise<Aula> {
    const aula = await this.aulaRepository.findOne({ where: { id } });

    if (!aula) {
      throw new NotFoundException('Aula no encontrada.');
    }

    return aula;
  }

  private async validarCodigoDuplicado(
    codigo: string,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.aulaRepository.findOne({ where: { codigo } });

    if (existente && existente.id !== excluirId) {
      throw new ConflictException('El código del aula ya está registrado.');
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
    const fecha = new Date(valor);

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

  private extraerFechaCalendario(valor: string): string {
    const coincidencia = /^(\d{4}-\d{2}-\d{2})T/.exec(valor);

    if (!coincidencia) {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }

    return coincidencia[1];
  }

  private extraerHoraCalendario(valor: string): string {
    const coincidencia = /T(\d{2}):(\d{2})/.exec(valor);

    if (!coincidencia) {
      throw new BadRequestException('La fecha y hora indicada no es válida.');
    }

    return `${coincidencia[1]}:${coincidencia[2]}`;
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

    const fechaInicio = this.extraerFechaCalendario(dto.fechaHoraInicio);

    const fechaFin = this.extraerFechaCalendario(dto.fechaHoraFin);

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

    const horaInicio = this.extraerHoraCalendario(dto.fechaHoraInicio);

    const horaFin = this.extraerHoraCalendario(dto.fechaHoraFin);

    this.validarRangoHoras(horaInicio, horaFin);

    const inicio = this.convertirFechaHora(dto.fechaHoraInicio);
    const fin = this.convertirFechaHora(dto.fechaHoraFin);
    this.validarRangoIndisponibilidad(inicio, fin);
    const requisitos = dto.equipamientos ?? [];
    const ids = new Set<number>();
    for (const requisito of requisitos) {
      if (ids.has(requisito.equipamientoId)) {
        throw new BadRequestException(
          'No se puede repetir el mismo equipamiento en la búsqueda.',
        );
      }
      ids.add(requisito.equipamientoId);
    }
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

      if (this.bloquesDisponibilidadCubrenRango(bloques, horaInicio, horaFin)) {
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
              relacion.cantidadDisponible >= req.cantidadMinima,
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

  private validarCantidadesEquipamiento(
    cantidadTotal: number,
    cantidadDisponible: number,
  ): void {
    if (cantidadTotal <= 0) {
      throw new BadRequestException('La cantidad total debe ser mayor a cero.');
    }

    if (cantidadDisponible < 0) {
      throw new BadRequestException(
        'La cantidad disponible no puede ser negativa.',
      );
    }

    if (cantidadDisponible > cantidadTotal) {
      throw new BadRequestException(
        'La cantidad disponible no puede superar la cantidad total.',
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
      throw new ConflictException('El código del aula ya está registrado.');
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

    if (dto.capacidad <= 0) {
      throw new BadRequestException(
        'La capacidad del aula debe ser mayor a cero.',
      );
    }

    await this.validarCodigoDuplicado(codigo);

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

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();

      if (!codigo) {
        throw new BadRequestException(
          'El código del aula no puede estar vacío.',
        );
      }

      await this.validarCodigoDuplicado(codigo, id);
      aula.codigo = codigo;
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
      if (dto.capacidad <= 0) {
        throw new BadRequestException(
          'La capacidad del aula debe ser mayor a cero.',
        );
      }

      aula.capacidad = dto.capacidad;
    }

    if (dto.tipo !== undefined) {
      aula.tipo = dto.tipo;
    }

    if (dto.tipoMobiliario !== undefined) {
      aula.tipoMobiliario = dto.tipoMobiliario;
    }

    if (dto.origen !== undefined) {
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
    await this.obtenerEntidadPorId(aulaId);

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

  async listarEquipamientos(): Promise<Equipamiento[]> {
    return this.equipamientoRepository.find({ order: { nombre: 'ASC' } });
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

    await this.validarNombreEquipamientoDuplicado(nombre);

    const equipamiento = this.equipamientoRepository.create({
      nombre,
      descripcion,
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

    try {
      await this.equipamientoRepository.save(equipamiento);

      await this.registrarAuditoria({
        aulaId: null,
        usuarioId,
        accion: 'ACTUALIZAR',
        entidad: 'EQUIPAMIENTO',
        entidadId: id,
        detalle: {
          despues: {
            nombre: equipamiento.nombre,
            descripcion: equipamiento.descripcion,
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
      detalle: {
        activo,
      },
    });

    return this.obtenerEquipamientoEntidadPorId(id);
  }

  async listarEquipamientoAula(aulaId: number): Promise<AulaEquipamiento[]> {
    await this.obtenerEntidadPorId(aulaId);

    return this.aulaEquipamientoRepository.find({
      where: { aulaId },
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

    this.validarCantidadesEquipamiento(
      dto.cantidadTotal,
      dto.cantidadDisponible,
    );

    const existente = await this.aulaEquipamientoRepository.findOne({
      where: { aulaId, equipamientoId: dto.equipamientoId },
    });

    if (existente) {
      if (existente.activo) {
        throw new ConflictException(
          'Este equipamiento ya está asignado al aula.',
        );
      }

      existente.cantidadTotal = dto.cantidadTotal;
      existente.cantidadDisponible = dto.cantidadDisponible;
      existente.observaciones = dto.observaciones?.trim() || null;
      existente.activo = true;

      const guardada = await this.aulaEquipamientoRepository.save(existente);

      await this.registrarAuditoria({
        aulaId,
        usuarioId,
        accion: 'ASIGNAR_EQUIPAMIENTO',
        entidad: 'AULA_EQUIPAMIENTO',
        entidadId: guardada.id,
        detalle: {
          equipamientoId: guardada.equipamientoId,
          cantidadTotal: guardada.cantidadTotal,
          cantidadDisponible: guardada.cantidadDisponible,
          observaciones: guardada.observaciones,
          activo: guardada.activo,
        },
      });

      return guardada;
    }

    const relacion = this.aulaEquipamientoRepository.create({
      aulaId,
      equipamientoId: equipamiento.id,
      cantidadTotal: dto.cantidadTotal,
      cantidadDisponible: dto.cantidadDisponible,
      observaciones: dto.observaciones?.trim() || null,
      activo: true,
    });

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
          cantidadTotal: guardada.cantidadTotal,
          cantidadDisponible: guardada.cantidadDisponible,
          observaciones: guardada.observaciones,
          activo: guardada.activo,
        },
      });

      return guardada;
    } catch (error) {
      if (this.obtenerCodigoError(error) === 'ER_DUP_ENTRY') {
        throw new ConflictException(
          'Este equipamiento ya está asignado al aula.',
        );
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

    const antes = {
      cantidadTotal: relacion.cantidadTotal,
      cantidadDisponible: relacion.cantidadDisponible,
      observaciones: relacion.observaciones,
      activo: relacion.activo,
    };

    const cantidadTotal = dto.cantidadTotal ?? relacion.cantidadTotal;
    const cantidadDisponible =
      dto.cantidadDisponible ?? relacion.cantidadDisponible;

    this.validarCantidadesEquipamiento(cantidadTotal, cantidadDisponible);

    relacion.cantidadTotal = cantidadTotal;
    relacion.cantidadDisponible = cantidadDisponible;

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
          cantidadTotal: relacion.cantidadTotal,
          cantidadDisponible: relacion.cantidadDisponible,
          observaciones: relacion.observaciones,
          activo: relacion.activo,
        },
      },
    });

    return this.obtenerEquipamientoAula(aulaId, equipamientoId);
  }

  async cambiarEstadoEquipamientoAula(
    aulaId: number,
    equipamientoId: number,
    activo: boolean,
    usuarioId?: number,
  ): Promise<AulaEquipamiento> {
    const relacion = await this.obtenerEquipamientoAula(aulaId, equipamientoId);

    if (activo) {
      const aula = await this.obtenerEntidadPorId(aulaId);

      if (!aula.activo) {
        throw new BadRequestException(
          'No se puede activar equipamiento en un aula inactiva.',
        );
      }

      const equipamiento =
        await this.obtenerEquipamientoEntidadPorId(equipamientoId);

      if (!equipamiento.activo) {
        throw new BadRequestException(
          'No se puede activar una asignación cuyo equipamiento está inactivo.',
        );
      }
    }

    relacion.activo = activo;
    await this.aulaEquipamientoRepository.save(relacion);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CAMBIAR_ESTADO_EQUIPAMIENTO',
      entidad: 'AULA_EQUIPAMIENTO',
      entidadId: relacion.id,
      detalle: {
        activo,
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

    return guardada;
  }

  async actualizarIndisponibilidadAula(
    aulaId: number,
    id: number,
    dto: ActualizarIndisponibilidadAulaDto,
    usuarioId?: number,
  ): Promise<IndisponibilidadAula> {
    await this.obtenerEntidadPorId(aulaId);
    const indisponibilidad = await this.obtenerIndisponibilidadAula(aulaId, id);

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
        tipo: indisponibilidad.tipo,
        fechaHoraInicio: indisponibilidad.fechaHoraInicio,
        fechaHoraFin: indisponibilidad.fechaHoraFin,
        motivo: indisponibilidad.motivo,
        activo: indisponibilidad.activo,
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
    await this.obtenerEntidadPorId(aulaId);
    const indisponibilidad = await this.obtenerIndisponibilidadAula(aulaId, id);

    if (activo && !indisponibilidad.activo) {
      await this.validarCruceIndisponibilidad(
        aulaId,
        new Date(indisponibilidad.fechaHoraInicio),
        new Date(indisponibilidad.fechaHoraFin),
        id,
      );
    }

    indisponibilidad.activo = activo;
    await this.indisponibilidadAulaRepository.save(indisponibilidad);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'INDISPONIBILIDAD',
      entidadId: indisponibilidad.id,
      detalle: {
        activo: indisponibilidad.activo,
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
    await this.obtenerEntidadPorId(aulaId);
    const reserva = await this.obtenerReservaAula(aulaId, id);

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
        tipo: reserva.tipo,
        titulo: reserva.titulo,
        descripcion: reserva.descripcion,
        fechaHoraInicio: reserva.fechaHoraInicio,
        fechaHoraFin: reserva.fechaHoraFin,
        activo: reserva.activo,
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

    reserva.activo = activo;
    await this.reservaAulaRepository.save(reserva);

    await this.registrarAuditoria({
      aulaId,
      usuarioId,
      accion: 'CAMBIAR_ESTADO',
      entidad: 'RESERVA',
      entidadId: reserva.id,
      detalle: {
        activo: reserva.activo,
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
    await this.obtenerEntidadPorId(aulaId);

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
