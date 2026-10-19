import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Grupo } from './entities/grupo.entity';
import { HorarioGrupo } from './entities/horario-grupo.entity';

export interface HorarioGrupoLectura {
  id: number;
  aula: { id: number; codigo: string; nombre: string } | null;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

export interface GrupoLectura {
  id: number;
  curso: { id: number; codigo: string; nombre: string };
  periodo: {
    id: number;
    codigo: string;
    fechaInicio: string;
    fechaFin: string;
  };
  numeroGrupo: string;
  tipoGrupo: string;
  cupoMaximo: number;
  estado: string;
  profesorIdLegado: number | null;
}

export interface GrupoConHorariosLectura extends GrupoLectura {
  horarios: HorarioGrupoLectura[];
}

export interface HorarioAulaEnFechaLectura {
  fecha: string;
  grupo: GrupoLectura;
  horario: HorarioGrupoLectura;
}

@Injectable()
export class OfertaAcademicaService {
  constructor(
    @InjectRepository(Grupo)
    private readonly grupoRepository: Repository<Grupo>,
    @InjectRepository(HorarioGrupo)
    private readonly horarioRepository: Repository<HorarioGrupo>,
  ) {}

  async listarGrupos(): Promise<GrupoConHorariosLectura[]> {
    const grupos = await this.consultar(() =>
      this.grupoRepository.find({
        relations: { curso: true, periodo: true, horarios: { aula: true } },
        order: { cursoId: 'ASC', periodoId: 'ASC', numeroGrupo: 'ASC' },
      }),
    );
    return grupos.map((grupo) => ({
      ...this.mapearGrupo(grupo),
      horarios: (grupo.horarios ?? [])
        .map((horario) => this.mapearHorario(horario))
        .sort(
          (a, b) =>
            a.diaSemana - b.diaSemana ||
            a.horaInicio.localeCompare(b.horaInicio) ||
            a.id - b.id,
        ),
    }));
  }

  // Consulta interna: devuelve horarios registrados, sin interpretar estado ni ocupacion.
  async consultarHorariosAulaEnFecha(
    aulaId: number,
    fecha: string,
  ): Promise<HorarioAulaEnFechaLectura[]> {
    if (!Number.isInteger(aulaId) || aulaId <= 0) {
      throw new BadRequestException(
        'El aula debe tener un identificador válido.',
      );
    }
    const diaSemana = this.diaSemana(fecha);
    const horarios = await this.consultar(() =>
      this.horarioRepository.find({
        where: {
          aulaId,
          diaSemana,
          grupo: {
            periodo: {
              fechaInicio: LessThanOrEqual(fecha),
              fechaFin: MoreThanOrEqual(fecha),
            },
          },
        },
        relations: { grupo: { curso: true, periodo: true }, aula: true },
        order: { horaInicio: 'ASC', id: 'ASC' },
      }),
    );
    return horarios.map((horario) => ({
      fecha,
      grupo: this.mapearGrupo(horario.grupo),
      horario: this.mapearHorario(horario),
    }));
  }

  private diaSemana(fecha: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD.');
    }
    const fechaUtc = new Date(`${fecha}T00:00:00.000Z`);
    if (
      Number.isNaN(fechaUtc.getTime()) ||
      fechaUtc.toISOString().slice(0, 10) !== fecha
    ) {
      throw new BadRequestException('La fecha no es válida.');
    }
    return fechaUtc.getUTCDay() || 7;
  }

  private mapearGrupo(grupo: Grupo | null | undefined): GrupoLectura {
    if (!grupo?.curso || !grupo.periodo) {
      throw new InternalServerErrorException(
        'El grupo académico no tiene curso o período asociado.',
      );
    }
    return {
      id: grupo.id,
      curso: {
        id: grupo.curso.id,
        codigo: grupo.curso.codigo,
        nombre: grupo.curso.nombre,
      },
      periodo: {
        id: grupo.periodo.id,
        codigo: grupo.periodo.codigo,
        fechaInicio: grupo.periodo.fechaInicio,
        fechaFin: grupo.periodo.fechaFin,
      },
      numeroGrupo: grupo.numeroGrupo,
      tipoGrupo: grupo.tipoGrupo,
      cupoMaximo: grupo.cupoMaximo,
      estado: grupo.estado,
      profesorIdLegado: grupo.profesorId,
    };
  }

  private mapearHorario(horario: HorarioGrupo): HorarioGrupoLectura {
    if (horario.aulaId !== null && !horario.aula) {
      throw new InternalServerErrorException(
        'El horario académico no tiene el aula asociada.',
      );
    }
    return {
      id: horario.id,
      aula:
        horario.aulaId === null
          ? null
          : {
              id: horario.aula!.id,
              codigo: horario.aula!.codigo,
              nombre: horario.aula!.nombre,
            },
      diaSemana: horario.diaSemana,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin,
    };
  }

  private async consultar<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      const codigo =
        (error as { code?: string; driverError?: { code?: string } })
          ?.driverError?.code ?? (error as { code?: string })?.code;
      if (
        [
          'ER_NO_SUCH_TABLE',
          'ER_BAD_TABLE_ERROR',
          'ER_BAD_FIELD_ERROR',
        ].includes(codigo ?? '')
      ) {
        throw new ServiceUnavailableException(
          'El esquema de grupos y horarios académicos no está disponible.',
        );
      }
      throw error;
    }
  }
}
