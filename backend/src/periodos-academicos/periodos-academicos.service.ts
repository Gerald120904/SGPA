import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoPeriodoAcademico } from './constants/estado-periodo-academico.constant';
import { ActualizarPeriodoAcademicoDto } from './dto/actualizar-periodo-academico.dto';
import { CrearPeriodoAcademicoDto } from './dto/crear-periodo-academico.dto';
import { PeriodoAcademico } from './entities/periodo-academico.entity';

@Injectable()
export class PeriodosAcademicosService {
  constructor(
    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,
  ) {}

  private generarCodigo(anio: number, ciclo: number): string {
    return `${anio}-C${ciclo}`;
  }

  private generarNombre(anio: number, ciclo: number): string {
    const nombresCiclo: Record<number, string> = {
      1: 'I Ciclo',
      2: 'II Ciclo',
      3: 'Verano',
    };

    return `${nombresCiclo[ciclo] ?? `Ciclo ${ciclo}`} ${anio}`;
  }

  private validarFechas(
    fechaInicio: string,
    fechaFin: string,
    fechaLimiteDisponibilidad: string,
  ): void {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const limiteDisponibilidad = new Date(fechaLimiteDisponibilidad);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime()) ||
      Number.isNaN(limiteDisponibilidad.getTime())
    ) {
      throw new BadRequestException(
        'Las fechas del periodo académico no son válidas.',
      );
    }

    if (fin.getTime() <= inicio.getTime()) {
      throw new BadRequestException(
        'La fecha de finalización debe ser posterior a la fecha de inicio.',
      );
    }

    if (limiteDisponibilidad.getTime() >= inicio.getTime()) {
      throw new BadRequestException(
        'La fecha límite de disponibilidad docente debe ser anterior al inicio del periodo académico.',
      );
    }
  }

  private async obtenerEntidadPorId(id: number): Promise<PeriodoAcademico> {
    const periodo = await this.periodoRepository.findOne({
      where: {
        id,
      },
    });

    if (!periodo) {
      throw new NotFoundException('Periodo académico no encontrado.');
    }

    return periodo;
  }

  private async validarDuplicado(
    anio: number,
    ciclo: number,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.periodoRepository.findOne({
      where: {
        anio,
        ciclo,
      },
    });

    if (existente && existente.id !== excluirId) {
      const nombresCiclo: Record<number, string> = {
        1: 'I Ciclo',
        2: 'II Ciclo',
        3: 'Verano',
      };

      const nombreCiclo = nombresCiclo[ciclo] ?? `Ciclo ${ciclo}`;

      throw new ConflictException(
        `Ya existe el ${nombreCiclo} del año ${anio}.`,
      );
    }
  }

  private async validarUnicoPeriodoEnEstado(
    estado: EstadoPeriodoAcademico,
    excluirId?: number,
  ): Promise<void> {
    const existente = await this.periodoRepository.findOne({
      where: {
        estado,
      },
    });

    if (!existente || existente.id === excluirId) {
      return;
    }

    if (estado === EstadoPeriodoAcademico.EN_PREPARACION) {
      throw new ConflictException(
        `Ya existe un periodo académico en preparación: ${existente.codigo}.`,
      );
    }

    if (estado === EstadoPeriodoAcademico.EN_CURSO) {
      throw new ConflictException(
        `Ya existe un periodo académico en curso: ${existente.codigo}.`,
      );
    }
  }

  private validarPeriodoEditable(periodo: PeriodoAcademico): void {
    if (periodo.estado === EstadoPeriodoAcademico.EN_CURSO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico que ya está en curso.',
      );
    }

    if (periodo.estado === EstadoPeriodoAcademico.CERRADO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico cerrado.',
      );
    }

    if (periodo.estado === EstadoPeriodoAcademico.CANCELADO) {
      throw new BadRequestException(
        'No se puede modificar un periodo académico cancelado.',
      );
    }
  }

  private validarCambiosEnPreparacion(
    periodo: PeriodoAcademico,
    dto: ActualizarPeriodoAcademicoDto,
  ): void {
    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      return;
    }

    const modificaEstructura =
      dto.anio !== undefined ||
      dto.ciclo !== undefined ||
      dto.fechaInicio !== undefined ||
      dto.fechaFin !== undefined ||
      dto.fechaLimiteDisponibilidad !== undefined;

    if (modificaEstructura) {
      throw new BadRequestException(
        'Cuando el periodo académico está en preparación únicamente pueden modificarse las observaciones.',
      );
    }
  }

  private validarTransicionEstado(
    estadoActual: EstadoPeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): void {
    if (estadoActual === nuevoEstado) {
      return;
    }

    const transicionesPermitidas: Record<
      EstadoPeriodoAcademico,
      EstadoPeriodoAcademico[]
    > = {
      [EstadoPeriodoAcademico.BORRADOR]: [
        EstadoPeriodoAcademico.EN_PREPARACION,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_PREPARACION]: [
        EstadoPeriodoAcademico.EN_CURSO,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_CURSO]: [EstadoPeriodoAcademico.CERRADO],
      [EstadoPeriodoAcademico.CERRADO]: [],
      [EstadoPeriodoAcademico.CANCELADO]: [],
    };

    const permitidos = transicionesPermitidas[estadoActual];

    if (!permitidos.includes(nuevoEstado)) {
      throw new BadRequestException(
        `No se puede cambiar el periodo de ${estadoActual} a ${nuevoEstado}.`,
      );
    }
  }

  private obtenerFechaActualLocal(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private validarFechaParaTransicion(
    periodo: PeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): void {
    const motivo = this.obtenerMotivoBloqueoFecha(periodo, nuevoEstado);

    if (!motivo) {
      return;
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION
    ) {
      throw new BadRequestException(
        'No se puede pasar el periodo a preparación porque la fecha límite de disponibilidad docente ya venció.',
      );
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_CURSO
    ) {
      throw new BadRequestException(
        'No se puede iniciar el periodo académico antes de su fecha de inicio.',
      );
    }

    throw new BadRequestException(
      'No se puede cerrar el periodo académico antes de su fecha de finalización.',
    );
  }

  private obtenerMotivoBloqueoFecha(
    periodo: PeriodoAcademico,
    nuevoEstado: EstadoPeriodoAcademico,
  ): string | null {
    const hoy = this.obtenerFechaActualLocal();

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION &&
      hoy > periodo.fechaLimiteDisponibilidad
    ) {
      return 'La fecha límite de disponibilidad docente ya venció.';
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.EN_CURSO &&
      hoy < periodo.fechaInicio
    ) {
      return `El periodo podrá iniciarse a partir del ${periodo.fechaInicio}.`;
    }

    if (
      nuevoEstado === EstadoPeriodoAcademico.CERRADO &&
      hoy < periodo.fechaFin
    ) {
      return `El periodo podrá cerrarse a partir del ${periodo.fechaFin}.`;
    }

    return null;
  }

  private obtenerTransicionesInterfaz(periodo: PeriodoAcademico) {
    const transiciones: Record<
      EstadoPeriodoAcademico,
      EstadoPeriodoAcademico[]
    > = {
      [EstadoPeriodoAcademico.BORRADOR]: [
        EstadoPeriodoAcademico.EN_PREPARACION,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_PREPARACION]: [
        EstadoPeriodoAcademico.EN_CURSO,
        EstadoPeriodoAcademico.CANCELADO,
      ],
      [EstadoPeriodoAcademico.EN_CURSO]: [
        EstadoPeriodoAcademico.CERRADO,
      ],
      [EstadoPeriodoAcademico.CERRADO]: [],
      [EstadoPeriodoAcademico.CANCELADO]: [],
    };

    return (transiciones[periodo.estado] ?? []).map((estado) => {
      const motivo = this.obtenerMotivoBloqueoFecha(periodo, estado);

      return {
        estado,
        disponible: motivo === null,
        motivo,
      };
    });
  }

  private relanzarErrorPersistencia(error: unknown): never {
    const codigo =
      (
        error as {
          driverError?: {
            code?: string;
          };
        }
      )?.driverError?.code ?? (error as { code?: string })?.code;

    if (codigo === 'ER_DUP_ENTRY') {
      throw new ConflictException(
        'Ya existe un periodo académico para ese año y ciclo.',
      );
    }

    throw error;
  }

  async listar() {
    const periodos = await this.periodoRepository.find({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });

    return periodos.map((periodo) => ({
      ...periodo,
      transicionesEstado: this.obtenerTransicionesInterfaz(periodo),
    }));
  }

  async obtenerPorId(id: number): Promise<PeriodoAcademico> {
    return this.obtenerEntidadPorId(id);
  }

  async crear(dto: CrearPeriodoAcademicoDto): Promise<PeriodoAcademico> {
    await this.validarDuplicado(dto.anio, dto.ciclo);

    this.validarFechas(
      dto.fechaInicio,
      dto.fechaFin,
      dto.fechaLimiteDisponibilidad,
    );

    const periodo = this.periodoRepository.create({
      codigo: this.generarCodigo(dto.anio, dto.ciclo),
      nombre: this.generarNombre(dto.anio, dto.ciclo),
      anio: dto.anio,
      ciclo: dto.ciclo,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin,
      fechaLimiteDisponibilidad: dto.fechaLimiteDisponibilidad,
      estado: EstadoPeriodoAcademico.BORRADOR,
      observaciones: dto.observaciones?.trim() || null,
    });

    try {
      return await this.periodoRepository.save(periodo);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async actualizar(
    id: number,
    dto: ActualizarPeriodoAcademicoDto,
  ): Promise<PeriodoAcademico> {
    const periodo = await this.obtenerEntidadPorId(id);

    this.validarPeriodoEditable(periodo);
    this.validarCambiosEnPreparacion(periodo, dto);

    const nuevoAnio = dto.anio ?? periodo.anio;
    const nuevoCiclo = dto.ciclo ?? periodo.ciclo;
    const nuevaFechaInicio = dto.fechaInicio ?? periodo.fechaInicio;
    const nuevaFechaFin = dto.fechaFin ?? periodo.fechaFin;
    const nuevaFechaLimiteDisponibilidad =
      dto.fechaLimiteDisponibilidad ?? periodo.fechaLimiteDisponibilidad;

    await this.validarDuplicado(nuevoAnio, nuevoCiclo, periodo.id);

    this.validarFechas(
      nuevaFechaInicio,
      nuevaFechaFin,
      nuevaFechaLimiteDisponibilidad,
    );

    periodo.anio = nuevoAnio;
    periodo.ciclo = nuevoCiclo;
    periodo.codigo = this.generarCodigo(nuevoAnio, nuevoCiclo);
    periodo.nombre = this.generarNombre(nuevoAnio, nuevoCiclo);
    periodo.fechaInicio = nuevaFechaInicio;
    periodo.fechaFin = nuevaFechaFin;
    periodo.fechaLimiteDisponibilidad = nuevaFechaLimiteDisponibilidad;

    if (dto.observaciones !== undefined) {
      periodo.observaciones = dto.observaciones?.trim() || null;
    }

    try {
      return await this.periodoRepository.save(periodo);
    } catch (error) {
      this.relanzarErrorPersistencia(error);
    }
  }

  async cambiarEstado(
    id: number,
    nuevoEstado: EstadoPeriodoAcademico,
  ): Promise<PeriodoAcademico> {
    const periodo = await this.obtenerEntidadPorId(id);

    this.validarTransicionEstado(periodo.estado, nuevoEstado);

    if (
      periodo.estado !== nuevoEstado &&
      (nuevoEstado === EstadoPeriodoAcademico.EN_PREPARACION ||
        nuevoEstado === EstadoPeriodoAcademico.EN_CURSO)
    ) {
      await this.validarUnicoPeriodoEnEstado(nuevoEstado, periodo.id);
    }

    if (periodo.estado !== nuevoEstado) {
      this.validarFechaParaTransicion(periodo, nuevoEstado);
    }

    periodo.estado = nuevoEstado;

    return this.periodoRepository.save(periodo);
  }
}
