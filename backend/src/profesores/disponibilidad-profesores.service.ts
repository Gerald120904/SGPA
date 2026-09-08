import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RolSistema } from '../auth/constants/roles.constants';
import { EstadoPeriodoAcademico } from '../periodos-academicos/constants/estado-periodo-academico.constant';
import { PeriodoAcademico } from '../periodos-academicos/entities/periodo-academico.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { DiaSemana } from './constants/dia-semana.constant';
import { EstadoDisponibilidad } from './constants/estado-disponibilidad.constant';
import { BloqueDisponibilidadDto } from './dto/bloque-disponibilidad.dto';
import { CopiarDisponibilidadDto } from './dto/copiar-disponibilidad.dto';
import { GuardarDisponibilidadDto } from './dto/guardar-disponibilidad.dto';
import { BloqueDisponibilidadProfesor } from './entities/bloque-disponibilidad-profesor.entity';
import { DisponibilidadProfesor } from './entities/disponibilidad-profesor.entity';
import { HistorialDisponibilidadProfesor } from './entities/historial-disponibilidad-profesor.entity';

@Injectable()
export class DisponibilidadProfesoresService {
  private readonly ordenDias: Record<DiaSemana, number> = {
    [DiaSemana.LUNES]: 1,
    [DiaSemana.MARTES]: 2,
    [DiaSemana.MIERCOLES]: 3,
    [DiaSemana.JUEVES]: 4,
    [DiaSemana.VIERNES]: 5,
    [DiaSemana.SABADO]: 6,
    [DiaSemana.DOMINGO]: 7,
  };

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(PeriodoAcademico)
    private readonly periodoRepository: Repository<PeriodoAcademico>,

    @InjectRepository(DisponibilidadProfesor)
    private readonly disponibilidadRepository: Repository<DisponibilidadProfesor>,

    @InjectRepository(BloqueDisponibilidadProfesor)
    private readonly bloqueRepository: Repository<BloqueDisponibilidadProfesor>,

    @InjectRepository(HistorialDisponibilidadProfesor)
    private readonly historialRepository: Repository<HistorialDisponibilidadProfesor>,

    private readonly dataSource: DataSource,
  ) {}

  private async obtenerProfesor(
    usuarioId: number,
    exigirActivo = false,
  ): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: {
        id: usuarioId,
      },
      relations: {
        usuarioRoles: {
          rol: true,
        },
      },
    });

    if (!usuario) {
      throw new NotFoundException('Profesor no encontrado.');
    }

    const tieneRolProfesor = (usuario.usuarioRoles ?? []).some(
      (relacion) =>
        relacion.rol &&
        relacion.rol.activo &&
        (relacion.rol.nombre as RolSistema) === RolSistema.PROFESOR,
    );

    if (!tieneRolProfesor) {
      throw new ForbiddenException(
        'El usuario no posee actualmente el rol PROFESOR.',
      );
    }

    if (exigirActivo && !usuario.activo) {
      throw new ForbiddenException('El profesor se encuentra inactivo.');
    }

    return usuario;
  }

  private async obtenerPeriodo(periodoId: number): Promise<PeriodoAcademico> {
    const periodo = await this.periodoRepository.findOne({
      where: {
        id: periodoId,
      },
    });

    if (!periodo) {
      throw new NotFoundException('Periodo académico no encontrado.');
    }

    return periodo;
  }

  private obtenerFechaActualLocal(): string {
    const ahora = new Date();

    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private obtenerEstadoEfectivo(
    disponibilidad: DisponibilidadProfesor | null,
    periodo: PeriodoAcademico,
  ): EstadoDisponibilidad {
    if (!disponibilidad) {
      return EstadoDisponibilidad.PENDIENTE;
    }

    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      return EstadoDisponibilidad.BLOQUEADA;
    }

    return disponibilidad.estado;
  }

  private puedeEditarDisponibilidad(periodo: PeriodoAcademico): boolean {
    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      return false;
    }

    const hoy = this.obtenerFechaActualLocal();

    return hoy <= periodo.fechaLimiteDisponibilidad;
  }

  private async validarPeriodoEditable(
    periodoId: number,
  ): Promise<PeriodoAcademico> {
    const periodo = await this.obtenerPeriodo(periodoId);

    if (periodo.estado !== EstadoPeriodoAcademico.EN_PREPARACION) {
      throw new BadRequestException(
        'La disponibilidad únicamente puede registrarse para el periodo que se encuentra en preparación.',
      );
    }

    const periodosAbiertos = await this.periodoRepository.find({
      where: {
        estado: EstadoPeriodoAcademico.EN_PREPARACION,
      },
    });

    if (periodosAbiertos.length > 1) {
      throw new ConflictException(
        'Existe más de un periodo académico en preparación. Debe corregirse la configuración de periodos antes de registrar disponibilidad.',
      );
    }

    const hoy = this.obtenerFechaActualLocal();

    if (hoy > periodo.fechaLimiteDisponibilidad) {
      throw new BadRequestException(
        'La fecha límite para registrar o modificar la disponibilidad docente ya venció.',
      );
    }

    return periodo;
  }

  private convertirHoraMinutos(hora: string): number {
    const [horas, minutos] = hora.slice(0, 5).split(':').map(Number);

    return horas * 60 + minutos;
  }

  private validarBloques(bloques: BloqueDisponibilidadDto[]): void {
    for (const bloque of bloques) {
      const inicio = this.convertirHoraMinutos(bloque.horaInicio);

      const fin = this.convertirHoraMinutos(bloque.horaFin);

      if (fin <= inicio) {
        throw new BadRequestException(
          `El bloque del ${bloque.dia} debe tener una hora final posterior a la hora inicial.`,
        );
      }
    }

    const porDia = new Map<string, BloqueDisponibilidadDto[]>();

    for (const bloque of bloques) {
      const actuales = porDia.get(bloque.dia) ?? [];

      actuales.push(bloque);
      porDia.set(bloque.dia, actuales);
    }

    for (const [dia, bloquesDia] of porDia) {
      const ordenados = [...bloquesDia].sort(
        (a, b) =>
          this.convertirHoraMinutos(a.horaInicio) -
          this.convertirHoraMinutos(b.horaInicio),
      );

      for (let i = 1; i < ordenados.length; i++) {
        const anterior = ordenados[i - 1];
        const actual = ordenados[i];

        const finAnterior = this.convertirHoraMinutos(anterior.horaFin);

        const inicioActual = this.convertirHoraMinutos(actual.horaInicio);

        if (inicioActual < finAnterior) {
          throw new ConflictException(
            `Existen bloques de disponibilidad superpuestos el ${dia}.`,
          );
        }
      }
    }
  }

  private normalizarHora(hora: string): string {
    return hora.slice(0, 5);
  }

  private ordenarBloques<
    T extends {
      dia: DiaSemana;
      horaInicio: string;
    },
  >(bloques: T[]): T[] {
    return [...bloques].sort((a, b) => {
      const diferenciaDia = this.ordenDias[a.dia] - this.ordenDias[b.dia];

      if (diferenciaDia !== 0) {
        return diferenciaDia;
      }

      return a.horaInicio.localeCompare(b.horaInicio);
    });
  }

  private mapearPeriodo(periodo: PeriodoAcademico) {
    return {
      id: periodo.id,
      codigo: periodo.codigo,
      nombre: periodo.nombre,
      anio: periodo.anio,
      ciclo: periodo.ciclo,
      estado: periodo.estado,
      fechaInicio: periodo.fechaInicio,
      fechaFin: periodo.fechaFin,
      fechaLimiteDisponibilidad: periodo.fechaLimiteDisponibilidad,
    };
  }

  private mapearDisponibilidad(disponibilidad: DisponibilidadProfesor) {
    const periodo = disponibilidad.periodoAcademico;

    const estadoEfectivo = periodo
      ? this.obtenerEstadoEfectivo(disponibilidad, periodo)
      : disponibilidad.estado;

    const puedeEditar = periodo
      ? this.puedeEditarDisponibilidad(periodo)
      : false;

    return {
      id: disponibilidad.id,
      profesorUsuarioId: disponibilidad.profesorUsuarioId,
      periodoAcademicoId: disponibilidad.periodoAcademicoId,
      estado: estadoEfectivo,
      puedeEditar,
      observaciones: disponibilidad.observaciones,
      periodo: periodo ? this.mapearPeriodo(periodo) : null,
      bloques: this.ordenarBloques(
        (disponibilidad.bloques ?? []).map((bloque) => ({
          id: bloque.id,
          dia: bloque.dia,
          horaInicio: this.normalizarHora(bloque.horaInicio),
          horaFin: this.normalizarHora(bloque.horaFin),
        })),
      ),
      createdAt: disponibilidad.createdAt,
      updatedAt: disponibilidad.updatedAt,
    };
  }

  private async obtenerDisponibilidadEntidad(
    profesorUsuarioId: number,
    periodoAcademicoId: number,
  ): Promise<DisponibilidadProfesor | null> {
    return this.disponibilidadRepository.findOne({
      where: {
        profesorUsuarioId,
        periodoAcademicoId,
      },
      relations: {
        periodoAcademico: true,
        bloques: true,
      },
    });
  }

  async consultarMiDisponibilidad(usuarioId: number, periodoId: number) {
    await this.obtenerProfesor(usuarioId, true);

    const periodo = await this.obtenerPeriodo(periodoId);

    const disponibilidad = await this.obtenerDisponibilidadEntidad(
      usuarioId,
      periodoId,
    );

    if (!disponibilidad) {
      return {
        registrada: false,
        profesorUsuarioId: usuarioId,
        periodoAcademicoId: periodoId,
        estado: EstadoDisponibilidad.PENDIENTE,
        puedeEditar: this.puedeEditarDisponibilidad(periodo),
        observaciones: null,
        periodo: this.mapearPeriodo(periodo),
        bloques: [],
      };
    }

    return {
      registrada: true,
      ...this.mapearDisponibilidad(disponibilidad),
    };
  }

  async obtenerDisponibilidadProfesor(profesorId: number, periodoId: number) {
    await this.obtenerProfesor(profesorId);
    const periodo = await this.obtenerPeriodo(periodoId);

    const disponibilidad = await this.obtenerDisponibilidadEntidad(
      profesorId,
      periodoId,
    );

    if (!disponibilidad) {
      return {
        registrada: false,
        profesorUsuarioId: profesorId,
        periodoAcademicoId: periodoId,
        estado: EstadoDisponibilidad.PENDIENTE,
        puedeEditar: false,
        periodo: this.mapearPeriodo(periodo),
        bloques: [],
        observaciones: null,
      };
    }

    return {
      registrada: true,
      ...this.mapearDisponibilidad(disponibilidad),
      puedeEditar: false,
    };
  }

  async guardarMiDisponibilidad(
    usuarioId: number,
    dto: GuardarDisponibilidadDto,
  ) {
    await this.obtenerProfesor(usuarioId, true);

    await this.validarPeriodoEditable(dto.periodoAcademicoId);

    this.validarBloques(dto.bloques);

    await this.dataSource.transaction(async (manager) => {
      const disponibilidadRepo = manager.getRepository(DisponibilidadProfesor);

      const bloqueRepo = manager.getRepository(BloqueDisponibilidadProfesor);

      const historialRepo = manager.getRepository(
        HistorialDisponibilidadProfesor,
      );

      let disponibilidad = await disponibilidadRepo.findOne({
        where: {
          profesorUsuarioId: usuarioId,
          periodoAcademicoId: dto.periodoAcademicoId,
        },
        relations: {
          bloques: true,
        },
      });

      const existia = disponibilidad !== null;

      const datosAnteriores = disponibilidad
        ? {
            estado: disponibilidad.estado,
            observaciones: disponibilidad.observaciones,
            bloques: (disponibilidad.bloques ?? []).map((bloque) => ({
              dia: bloque.dia,
              horaInicio: this.normalizarHora(bloque.horaInicio),
              horaFin: this.normalizarHora(bloque.horaFin),
            })),
          }
        : null;

      if (!disponibilidad) {
        disponibilidad = disponibilidadRepo.create({
          profesorUsuarioId: usuarioId,
          periodoAcademicoId: dto.periodoAcademicoId,
          estado: EstadoDisponibilidad.REGISTRADA,
          observaciones: dto.observaciones?.trim() || null,
        });

        disponibilidad = await disponibilidadRepo.save(disponibilidad);
      } else {
        if (disponibilidad.estado === EstadoDisponibilidad.BLOQUEADA) {
          throw new BadRequestException(
            'La disponibilidad se encuentra bloqueada y no puede modificarse.',
          );
        }

        disponibilidad.estado = EstadoDisponibilidad.REGISTRADA;

        disponibilidad.observaciones = dto.observaciones?.trim() || null;

        disponibilidad = await disponibilidadRepo.save(disponibilidad);

        await bloqueRepo.delete({
          disponibilidadId: disponibilidad.id,
        });
      }

      if (dto.bloques.length > 0) {
        const nuevosBloques = dto.bloques.map((bloque) =>
          bloqueRepo.create({
            disponibilidadId: disponibilidad.id,
            dia: bloque.dia,
            horaInicio: bloque.horaInicio,
            horaFin: bloque.horaFin,
          }),
        );

        await bloqueRepo.save(nuevosBloques);
      }

      const datosNuevos = {
        estado: EstadoDisponibilidad.REGISTRADA,
        observaciones: dto.observaciones?.trim() || null,
        bloques: dto.bloques.map((bloque) => ({
          dia: bloque.dia,
          horaInicio: bloque.horaInicio,
          horaFin: bloque.horaFin,
        })),
      };

      const historial = historialRepo.create({
        disponibilidadId: disponibilidad.id,
        usuarioId,
        accion: existia ? 'MODIFICAR' : 'CREAR',
        datosAnteriores,
        datosNuevos,
      });

      await historialRepo.save(historial);
    });

    const resultado = await this.obtenerDisponibilidadEntidad(
      usuarioId,
      dto.periodoAcademicoId,
    );

    if (!resultado) {
      throw new NotFoundException(
        'No fue posible recuperar la disponibilidad registrada.',
      );
    }

    return this.mapearDisponibilidad(resultado);
  }

  private esPeriodoAnteriorInmediato(
    origen: PeriodoAcademico,
    destino: PeriodoAcademico,
  ): boolean {
    if (destino.ciclo === 2) {
      return origen.anio === destino.anio && origen.ciclo === 1;
    }

    return (
      destino.ciclo === 1 &&
      origen.anio === destino.anio - 1 &&
      origen.ciclo === 2
    );
  }

  async copiarDisponibilidadAnterior(
    usuarioId: number,
    dto: CopiarDisponibilidadDto,
  ) {
    await this.obtenerProfesor(usuarioId, true);

    if (dto.periodoOrigenId === dto.periodoDestinoId) {
      throw new BadRequestException(
        'El periodo de origen y destino no pueden ser iguales.',
      );
    }

    const origen = await this.obtenerPeriodo(dto.periodoOrigenId);

    await this.validarPeriodoEditable(dto.periodoDestinoId);

    const destino = await this.obtenerPeriodo(dto.periodoDestinoId);

    if (!this.esPeriodoAnteriorInmediato(origen, destino)) {
      throw new BadRequestException(
        'Solo se puede copiar la disponibilidad del periodo académico inmediatamente anterior.',
      );
    }

    const disponibilidadOrigen = await this.obtenerDisponibilidadEntidad(
      usuarioId,
      origen.id,
    );

    if (!disponibilidadOrigen) {
      throw new NotFoundException(
        'No existe disponibilidad registrada en el periodo anterior.',
      );
    }

    const existenteDestino = await this.obtenerDisponibilidadEntidad(
      usuarioId,
      destino.id,
    );

    if (existenteDestino) {
      throw new ConflictException(
        'Ya existe disponibilidad registrada para el periodo destino.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const disponibilidadRepo = manager.getRepository(DisponibilidadProfesor);

      const bloqueRepo = manager.getRepository(BloqueDisponibilidadProfesor);

      const historialRepo = manager.getRepository(
        HistorialDisponibilidadProfesor,
      );

      let nuevaDisponibilidad = disponibilidadRepo.create({
        profesorUsuarioId: usuarioId,
        periodoAcademicoId: destino.id,
        estado: EstadoDisponibilidad.REGISTRADA,
        observaciones: null,
      });

      nuevaDisponibilidad = await disponibilidadRepo.save(nuevaDisponibilidad);

      const bloques = (disponibilidadOrigen.bloques ?? []).map((bloque) =>
        bloqueRepo.create({
          disponibilidadId: nuevaDisponibilidad.id,
          dia: bloque.dia,
          horaInicio: this.normalizarHora(bloque.horaInicio),
          horaFin: this.normalizarHora(bloque.horaFin),
        }),
      );

      if (bloques.length > 0) {
        await bloqueRepo.save(bloques);
      }

      const historial = historialRepo.create({
        disponibilidadId: nuevaDisponibilidad.id,
        usuarioId,
        accion: 'COPIAR_PERIODO_ANTERIOR',
        datosAnteriores: null,
        datosNuevos: {
          periodoOrigenId: origen.id,
          bloques: (disponibilidadOrigen.bloques ?? []).map((bloque) => ({
            dia: bloque.dia,
            horaInicio: this.normalizarHora(bloque.horaInicio),
            horaFin: this.normalizarHora(bloque.horaFin),
          })),
        },
      });

      await historialRepo.save(historial);
    });

    const resultado = await this.obtenerDisponibilidadEntidad(
      usuarioId,
      destino.id,
    );

    if (!resultado) {
      throw new NotFoundException(
        'No fue posible recuperar la disponibilidad copiada.',
      );
    }

    return this.mapearDisponibilidad(resultado);
  }

  async obtenerHistorialMiDisponibilidad(usuarioId: number, periodoId: number) {
    await this.obtenerProfesor(usuarioId, true);

    await this.obtenerPeriodo(periodoId);

    const disponibilidad = await this.disponibilidadRepository.findOne({
      where: {
        profesorUsuarioId: usuarioId,
        periodoAcademicoId: periodoId,
      },
    });

    if (!disponibilidad) {
      return [];
    }

    const historial = await this.historialRepository.find({
      where: {
        disponibilidadId: disponibilidad.id,
      },
      select: {
        id: true,
        disponibilidadId: true,
        usuarioId: true,
        accion: true,
        datosAnteriores: true,
        datosNuevos: true,
        createdAt: true,
        usuario: {
          id: true,
          cedula: true,
          nombres: true,
          apellido1: true,
          apellido2: true,
          correo: true,
          activo: true,
        },
      },
      relations: {
        usuario: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return historial.map((item) => ({
      id: item.id,
      disponibilidadId: item.disponibilidadId,
      usuarioId: item.usuarioId,
      accion: item.accion,
      datosAnteriores: item.datosAnteriores,
      datosNuevos: item.datosNuevos,

      usuario: item.usuario
        ? {
            id: item.usuario.id,
            cedula: item.usuario.cedula,
            nombres: item.usuario.nombres,
            apellido1: item.usuario.apellido1,
            apellido2: item.usuario.apellido2,
            correo: item.usuario.correo,
            activo: item.usuario.activo,
          }
        : null,

      createdAt: item.createdAt,
    }));
  }
}
