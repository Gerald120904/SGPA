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
    const nombreCiclo = ciclo === 1 ? 'I Ciclo' : 'II Ciclo';

    return `${nombreCiclo} ${anio}`;
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
      throw new ConflictException(
        `Ya existe el ${ciclo === 1 ? 'I' : 'II'} Ciclo del año ${anio}.`,
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

  async listar(): Promise<PeriodoAcademico[]> {
    return this.periodoRepository.find({
      order: {
        anio: 'DESC',
        ciclo: 'DESC',
      },
    });
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

    periodo.estado = nuevoEstado;

    return this.periodoRepository.save(periodo);
  }
}
