import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndisponibilidadAula } from '../aulas/entities/indisponibilidad-aula.entity';
import { ReservaAula } from '../aulas/entities/reserva-aula.entity';
import {
  HorarioAulaEnFechaLectura,
  OfertaAcademicaService,
} from './oferta-academica.service';

const ZONA_INSTITUCIONAL = 'America/Costa_Rica';

export interface SolicitudConflictoAcademico {
  aulaId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  excluirHorarioId?: number;
}

export interface CoincidenciaAcademica {
  origen: 'CLASE' | 'RESERVA' | 'INDISPONIBILIDAD';
  id: number;
  grupoId?: number;
  estadoGrupo?: string;
  clasificacion: 'CONFLICTO' | 'INDETERMINADA';
}

export interface ResultadoConflictoAcademico {
  resultado: 'CONFLICTO' | 'INDETERMINADA' | 'SIN_COINCIDENCIA';
  coincidencias: CoincidenciaAcademica[];
  historicos: { origen: 'RESERVA' | 'INDISPONIBILIDAD'; id: number }[];
  zonaHoraria: typeof ZONA_INSTITUCIONAL;
}

export interface DatosConflictoAcademico {
  horarios: HorarioAulaEnFechaLectura[];
  reservas: Pick<
    ReservaAula,
    'id' | 'aulaId' | 'activo' | 'fechaHoraInicio' | 'fechaHoraFin'
  >[];
  indisponibilidades: Pick<
    IndisponibilidadAula,
    'id' | 'aulaId' | 'activo' | 'fechaHoraInicio' | 'fechaHoraFin'
  >[];
}

function fechaValida(fecha: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD.');
  }
  const valor = new Date(`${fecha}T00:00:00.000Z`);
  if (
    Number.isNaN(valor.getTime()) ||
    valor.toISOString().slice(0, 10) !== fecha
  ) {
    throw new BadRequestException('La fecha no es válida.');
  }
}

function horaValida(hora: string): string {
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(hora)) {
    throw new BadRequestException(
      'La hora debe tener formato HH:mm o HH:mm:ss.',
    );
  }
  const [h, m, s = 0] = hora.split(':').map(Number);
  if (h > 23 || m > 59 || s > 59) {
    throw new BadRequestException('La hora no es válida.');
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function instanteInstitucional(fecha: string, hora: string): Date {
  const objetivo = Date.parse(`${fecha}T${hora}.000Z`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_INSTITUCIONAL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let instante = objetivo + 6 * 60 * 60 * 1000;
  for (let i = 0; i < 3; i++) {
    const partes = Object.fromEntries(
      formatter
        .formatToParts(new Date(instante))
        .map((parte) => [parte.type, parte.value]),
    );
    const observado = Date.parse(
      `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}.000Z`,
    );
    instante += objetivo - observado;
  }
  const resultado = new Date(instante);
  const partes = Object.fromEntries(
    formatter
      .formatToParts(resultado)
      .map((parte) => [parte.type, parte.value]),
  );
  if (
    `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}.000Z` !==
    `${fecha}T${hora}.000Z`
  ) {
    throw new BadRequestException(
      'La hora local no existe en la zona institucional.',
    );
  }
  return resultado;
}

function rangoSolicitud(solicitud: SolicitudConflictoAcademico) {
  if (!Number.isInteger(solicitud.aulaId) || solicitud.aulaId <= 0) {
    throw new BadRequestException(
      'El aula debe tener un identificador válido.',
    );
  }
  fechaValida(solicitud.fecha);
  const horaInicio = horaValida(solicitud.horaInicio);
  const horaFin = horaValida(solicitud.horaFin);
  if (horaInicio >= horaFin) {
    throw new BadRequestException(
      'La hora final debe ser posterior a la inicial.',
    );
  }
  return {
    inicio: instanteInstitucional(solicitud.fecha, horaInicio),
    fin: instanteInstitucional(solicitud.fecha, horaFin),
    horaInicio,
    horaFin,
    diaSemana: new Date(`${solicitud.fecha}T00:00:00.000Z`).getUTCDay() || 7,
  };
}

function seSolapan(
  inicioA: number,
  finA: number,
  inicioB: number,
  finB: number,
): boolean {
  return inicioA < finB && finA > inicioB;
}

// El parámetro de estados solo se suministra desde pruebas; producción no define política.
export function analizarConflictosTemporales(
  solicitud: SolicitudConflictoAcademico,
  datos: DatosConflictoAcademico,
  estadosOcupantesDePrueba?: ReadonlySet<string>,
): ResultadoConflictoAcademico {
  const rango = rangoSolicitud(solicitud);
  const coincidencias: CoincidenciaAcademica[] = [];
  const historicos: ResultadoConflictoAcademico['historicos'] = [];

  for (const item of datos.horarios) {
    const { horario, grupo } = item;
    if (
      horario.id === solicitud.excluirHorarioId ||
      horario.aula?.id !== solicitud.aulaId ||
      horario.diaSemana !== rango.diaSemana ||
      item.fecha !== solicitud.fecha ||
      solicitud.fecha < grupo.periodo.fechaInicio ||
      solicitud.fecha > grupo.periodo.fechaFin
    )
      continue;
    const inicio = horaValida(horario.horaInicio);
    const fin = horaValida(horario.horaFin);
    if (rango.horaInicio < fin && rango.horaFin > inicio) {
      coincidencias.push({
        origen: 'CLASE',
        id: horario.id,
        grupoId: grupo.id,
        estadoGrupo: grupo.estado,
        clasificacion: estadosOcupantesDePrueba?.has(grupo.estado)
          ? 'CONFLICTO'
          : 'INDETERMINADA',
      });
    }
  }

  for (const [origen, registros] of [
    ['RESERVA', datos.reservas],
    ['INDISPONIBILIDAD', datos.indisponibilidades],
  ] as const) {
    for (const registro of registros) {
      if (registro.aulaId !== solicitud.aulaId) continue;
      const inicio = new Date(registro.fechaHoraInicio).getTime();
      const fin = new Date(registro.fechaHoraFin).getTime();
      if (!Number.isFinite(inicio) || !Number.isFinite(fin)) {
        throw new BadRequestException(
          'Un registro de ocupación tiene fechas inválidas.',
        );
      }
      if (seSolapan(rango.inicio.getTime(), rango.fin.getTime(), inicio, fin)) {
        if (registro.activo) {
          coincidencias.push({
            origen,
            id: registro.id,
            clasificacion: 'CONFLICTO',
          });
        } else {
          historicos.push({ origen, id: registro.id });
        }
      }
    }
  }

  return {
    resultado: coincidencias.some((item) => item.clasificacion === 'CONFLICTO')
      ? 'CONFLICTO'
      : coincidencias.some((item) => item.clasificacion === 'INDETERMINADA')
        ? 'INDETERMINADA'
        : 'SIN_COINCIDENCIA',
    coincidencias,
    historicos,
    zonaHoraria: ZONA_INSTITUCIONAL,
  };
}

@Injectable()
export class ConflictosAcademicosService {
  constructor(
    private readonly ofertaAcademica: OfertaAcademicaService,
    @InjectRepository(ReservaAula)
    private readonly reservas: Repository<ReservaAula>,
    @InjectRepository(IndisponibilidadAula)
    private readonly indisponibilidades: Repository<IndisponibilidadAula>,
  ) {}

  private async leerIntervalosLocales(
    repositorio: Repository<ReservaAula> | Repository<IndisponibilidadAula>,
    tabla: 'reservas_aulas' | 'indisponibilidades_aulas',
    aulaId: number,
    inicioLocal: string,
    finLocal: string,
  ): Promise<DatosConflictoAcademico['reservas']> {
    const filas: {
      id: number;
      aulaId: number;
      activo: number;
      inicioLocal: string;
      finLocal: string;
    }[] = await repositorio.query(
      `SELECT id, aula_id AS aulaId, activo,
         DATE_FORMAT(fecha_hora_inicio, '%Y-%m-%d %H:%i:%s') AS inicioLocal,
         DATE_FORMAT(fecha_hora_fin, '%Y-%m-%d %H:%i:%s') AS finLocal
       FROM \`${tabla}\`
       WHERE aula_id = ? AND fecha_hora_inicio < ? AND fecha_hora_fin > ?`,
      [aulaId, finLocal, inicioLocal],
    );
    return filas.map((fila) => ({
      id: fila.id,
      aulaId: fila.aulaId,
      activo: Boolean(fila.activo),
      fechaHoraInicio: instanteInstitucional(
        fila.inicioLocal.slice(0, 10),
        fila.inicioLocal.slice(11),
      ),
      fechaHoraFin: instanteInstitucional(
        fila.finLocal.slice(0, 10),
        fila.finLocal.slice(11),
      ),
    }));
  }

  async analizar(
    solicitud: SolicitudConflictoAcademico,
  ): Promise<ResultadoConflictoAcademico> {
    const rango = rangoSolicitud(solicitud);
    const inicioLocal = `${solicitud.fecha} ${rango.horaInicio}`;
    const finLocal = `${solicitud.fecha} ${rango.horaFin}`;
    const [horarios, reservas, indisponibilidades] = await Promise.all([
      this.ofertaAcademica.consultarHorariosAulaEnFecha(
        solicitud.aulaId,
        solicitud.fecha,
      ),
      this.leerIntervalosLocales(
        this.reservas,
        'reservas_aulas',
        solicitud.aulaId,
        inicioLocal,
        finLocal,
      ),
      this.leerIntervalosLocales(
        this.indisponibilidades,
        'indisponibilidades_aulas',
        solicitud.aulaId,
        inicioLocal,
        finLocal,
      ),
    ]);
    return analizarConflictosTemporales(solicitud, {
      horarios,
      reservas,
      indisponibilidades,
    });
  }
}
