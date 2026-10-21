import { BadRequestException, Injectable } from '@nestjs/common';
import { ConflictosAcademicosService } from '../oferta-academica/conflictos-academicos.service';
import { AulasService } from './aulas.service';
import { BuscarAulasDisponiblesDto } from './dto/buscar-aulas-disponibles.dto';

const ZONA_INSTITUCIONAL = 'America/Costa_Rica';

function fechaHoraInstitucional(valor: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::00(?:\.0{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      valor,
    )
  ) {
    throw new BadRequestException(
      'Se requiere una fecha y hora con zona y precisión de minutos.',
    );
  }
  const fecha = valor.slice(0, 10);
  const fechaUtc = new Date(`${fecha}T00:00:00.000Z`);
  if (
    Number.isNaN(fechaUtc.getTime()) ||
    fechaUtc.toISOString().slice(0, 10) !== fecha
  ) {
    throw new BadRequestException('La fecha y hora indicada no es válida.');
  }
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) {
    throw new BadRequestException('La fecha y hora indicada no es válida.');
  }
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_INSTITUCIONAL,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
    iso: `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:00-06:00`,
  };
}

/** Evaluación interna; ningún controlador invoca este servicio. */
@Injectable()
export class AulasAnalisisAcademicoService {
  constructor(
    private readonly aulas: AulasService,
    private readonly conflictos: ConflictosAcademicosService,
  ) {}

  async analizar(aulaId: number, dto: BuscarAulasDisponiblesDto) {
    const inicio = fechaHoraInstitucional(dto.fechaHoraInicio);
    const fin = fechaHoraInstitucional(dto.fechaHoraFin);
    if (inicio.fecha !== fin.fecha || inicio.hora >= fin.hora) {
      throw new BadRequestException(
        'El análisis debe tener un rango válido dentro de un mismo día.',
      );
    }

    // Conserva los filtros y las validaciones vigentes sin alterar su ruta pública.
    const evaluacionActual = await this.aulas.evaluarAulaParaAsignacion(
      aulaId,
      {
        ...dto,
        fechaHoraInicio: inicio.iso,
        fechaHoraFin: fin.iso,
      },
    );
    const analisisAcademico = await this.conflictos.analizar({
      aulaId,
      fecha: inicio.fecha,
      horaInicio: inicio.hora,
      horaFin: fin.hora,
    });
    return { evaluacionActual, analisisAcademico };
  }
}
