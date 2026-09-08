import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Carrera } from '../carreras/entities/carrera.entity';
import { ProfesorCarrera } from '../profesores/entities/profesor-carrera.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoAsignacionAcademica } from './constants/tipo-asignacion-academica.constant';
import { ActualizarAreaAcademicaDto } from './dto/actualizar-area-academica.dto';
import { ActualizarAsignacionAcademicaDto } from './dto/actualizar-asignacion-academica.dto';
import { CrearAreaAcademicaDto } from './dto/crear-area-academica.dto';
import { CrearAsignacionAcademicaDto } from './dto/crear-asignacion-academica.dto';
import { InactivarAsignacionAcademicaDto } from './dto/inactivar-asignacion-academica.dto';
import { AreaAcademica } from './entities/area-academica.entity';
import { AreaCarrera } from './entities/area-carrera.entity';
import { AsignacionAcademica } from './entities/asignacion-academica.entity';

@Injectable()
export class EstructuraAcademicaService {
  constructor(
    @InjectRepository(AreaAcademica)
    private readonly areaRepository: Repository<AreaAcademica>,

    @InjectRepository(AreaCarrera)
    private readonly areaCarreraRepository: Repository<AreaCarrera>,

    @InjectRepository(AsignacionAcademica)
    private readonly asignacionRepository: Repository<AsignacionAcademica>,

    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,

    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(ProfesorCarrera)
    private readonly profesorCarreraRepository: Repository<ProfesorCarrera>,
  ) {}

  // --- Helper de Fecha Institucional y Vigencia ---

  private obtenerFechaInstitucional(fecha = new Date()): string {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(fecha);

    const obtener = (tipo: Intl.DateTimeFormatPartTypes) =>
      partes.find((parte) => parte.type === tipo)?.value ?? '';

    return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
  }

  private estaVigente(
    asignacion: AsignacionAcademica,
    fechaReferencia = this.obtenerFechaInstitucional(),
  ): boolean {
    if (!asignacion.activo) {
      return false;
    }

    if (asignacion.fechaInicio > fechaReferencia) {
      return false;
    }

    if (asignacion.fechaFin && asignacion.fechaFin < fechaReferencia) {
      return false;
    }

    return true;
  }

  private async obtenerAsignacionesVigentes(
    usuarioId: number,
  ): Promise<AsignacionAcademica[]> {
    const asignaciones = await this.asignacionRepository.find({
      where: {
        usuarioId,
        activo: true,
      },
    });

    return asignaciones.filter((asignacion) => this.estaVigente(asignacion));
  }

  // --- Validación de Ámbito y Alcance ---

  validarAmbito(
    tipo: TipoAsignacionAcademica,
    carreraId?: number | null,
    areaId?: number | null,
  ): void {
    const esCarrera = [
      TipoAsignacionAcademica.COORDINADOR_CARRERA,
      TipoAsignacionAcademica.ASISTENTE_CARRERA,
    ].includes(tipo);

    const esArea = [
      TipoAsignacionAcademica.COORDINADOR_AREA,
      TipoAsignacionAcademica.ASISTENTE_AREA,
    ].includes(tipo);

    const esDireccion = [
      TipoAsignacionAcademica.DIRECCION_ACADEMICA,
      TipoAsignacionAcademica.ASISTENTE_DIRECCION,
    ].includes(tipo);

    if (esCarrera && (!carreraId || areaId)) {
      throw new BadRequestException(
        'La asignación de carrera requiere carreraId y no permite areaAcademicaId.',
      );
    }

    if (esArea && (!areaId || carreraId)) {
      throw new BadRequestException(
        'La asignación de área requiere areaAcademicaId y no permite carreraId.',
      );
    }

    if (esDireccion && (carreraId || areaId)) {
      throw new BadRequestException(
        'La Dirección Académica no debe restringirse a una carrera o área.',
      );
    }
  }

  async tieneAlcanceSobreCarrera(
    usuarioId: number,
    carreraId: number,
  ): Promise<boolean> {
    const asignaciones = await this.obtenerAsignacionesVigentes(usuarioId);

    if (
      asignaciones.some(
        (item) => item.tipo === TipoAsignacionAcademica.DIRECCION_ACADEMICA,
      )
    ) {
      return true;
    }

    if (
      asignaciones.some(
        (item) =>
          item.carreraId === carreraId &&
          [
            TipoAsignacionAcademica.COORDINADOR_CARRERA,
            TipoAsignacionAcademica.ASISTENTE_CARRERA,
          ].includes(item.tipo),
      )
    ) {
      return true;
    }

    const areaIds = asignaciones
      .filter((item) =>
        [
          TipoAsignacionAcademica.COORDINADOR_AREA,
          TipoAsignacionAcademica.ASISTENTE_AREA,
        ].includes(item.tipo),
      )
      .map((item) => item.areaAcademicaId!)
      .filter(Boolean);

    if (!areaIds.length) {
      return false;
    }

    const relacion = await this.areaCarreraRepository.findOne({
      where: {
        areaAcademicaId: In(areaIds),
        carreraId,
      },
    });

    return Boolean(relacion);
  }

  async tieneAlcanceSobreProfesor(
    usuarioId: number,
    profesorUsuarioId: number,
  ): Promise<boolean> {
    const asignaciones = await this.obtenerAsignacionesVigentes(usuarioId);

    if (
      asignaciones.some(
        (item) => item.tipo === TipoAsignacionAcademica.DIRECCION_ACADEMICA,
      )
    ) {
      return true;
    }

    const carrerasProfesor = await this.profesorCarreraRepository.find({
      where: {
        profesorUsuarioId,
      },
    });

    if (!carrerasProfesor.length) {
      return false;
    }

    for (const rel of carrerasProfesor) {
      const tieneAlcance = await this.tieneAlcanceSobreCarrera(
        usuarioId,
        rel.carreraId,
      );
      if (tieneAlcance) {
        return true;
      }
    }

    return false;
  }

  // --- CRUD Áreas Académicas ---

  async crearArea(dto: CrearAreaAcademicaDto): Promise<AreaAcademica> {
    const codigo = dto.codigo.trim().toUpperCase();
    const nombre = dto.nombre.trim();

    const existeCodigo = await this.areaRepository.findOne({
      where: { codigo },
    });
    if (existeCodigo) {
      throw new ConflictException(
        `Ya existe un área académica con el código ${codigo}.`,
      );
    }

    const existeNombre = await this.areaRepository.findOne({
      where: { nombre },
    });
    if (existeNombre) {
      throw new ConflictException(
        `Ya existe un área académica con el nombre ${nombre}.`,
      );
    }

    const area = this.areaRepository.create({
      codigo,
      nombre,
      descripcion: dto.descripcion?.trim() || null,
      activo: true,
    });

    return this.areaRepository.save(area);
  }

  async listarAreas(): Promise<AreaAcademica[]> {
    return this.areaRepository.find({
      order: {
        nombre: 'ASC',
      },
    });
  }

  async obtenerAreaPorId(id: number): Promise<AreaAcademica> {
    const area = await this.areaRepository.findOne({
      where: { id },
    });

    if (!area) {
      throw new NotFoundException('Área académica no encontrada.');
    }

    return area;
  }

  async actualizarArea(
    id: number,
    dto: ActualizarAreaAcademicaDto,
  ): Promise<AreaAcademica> {
    const area = await this.obtenerAreaPorId(id);

    if (dto.codigo !== undefined) {
      const codigo = dto.codigo.trim().toUpperCase();
      if (codigo !== area.codigo) {
        const existe = await this.areaRepository.findOne({
          where: { codigo },
        });
        if (existe) {
          throw new ConflictException(
            `Ya existe un área académica con el código ${codigo}.`,
          );
        }
        area.codigo = codigo;
      }
    }

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (nombre !== area.nombre) {
        const existe = await this.areaRepository.findOne({
          where: { nombre },
        });
        if (existe) {
          throw new ConflictException(
            `Ya existe un área académica con el nombre ${nombre}.`,
          );
        }
        area.nombre = nombre;
      }
    }

    if (dto.descripcion !== undefined) {
      area.descripcion = dto.descripcion?.trim() || null;
    }

    if (dto.activo !== undefined) {
      area.activo = dto.activo;
    }

    return this.areaRepository.save(area);
  }

  // --- Relación Área ↔ Carrera ---

  async asociarCarreraArea(
    areaId: number,
    carreraId: number,
  ): Promise<AreaCarrera> {
    await this.obtenerAreaPorId(areaId);

    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });

    if (!carrera) {
      throw new NotFoundException('Carrera no encontrada.');
    }

    const existe = await this.areaCarreraRepository.findOne({
      where: {
        areaAcademicaId: areaId,
        carreraId,
      },
    });

    if (existe) {
      throw new ConflictException(
        'La carrera ya se encuentra asociada a esta área académica.',
      );
    }

    const relacion = this.areaCarreraRepository.create({
      areaAcademicaId: areaId,
      carreraId,
    });

    return this.areaCarreraRepository.save(relacion);
  }

  async desasociarCarreraArea(
    areaId: number,
    carreraId: number,
  ): Promise<void> {
    await this.obtenerAreaPorId(areaId);

    const relacion = await this.areaCarreraRepository.findOne({
      where: {
        areaAcademicaId: areaId,
        carreraId,
      },
    });

    if (!relacion) {
      throw new NotFoundException(
        'La carrera no está asociada a esta área académica.',
      );
    }

    await this.areaCarreraRepository.delete({
      areaAcademicaId: areaId,
      carreraId,
    });
  }

  async listarCarrerasDeArea(areaId: number): Promise<AreaCarrera[]> {
    await this.obtenerAreaPorId(areaId);

    return this.areaCarreraRepository.find({
      where: { areaAcademicaId: areaId },
      relations: {
        carrera: true,
      },
    });
  }

  // --- CRUD Asignaciones Académicas ---

  async crearAsignacion(
    dto: CrearAsignacionAcademicaDto,
  ): Promise<AsignacionAcademica> {
    this.validarAmbito(dto.tipo, dto.carreraId, dto.areaAcademicaId);

    const usuario = await this.usuarioRepository.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (dto.carreraId) {
      const carrera = await this.carreraRepository.findOne({
        where: { id: dto.carreraId },
      });
      if (!carrera) {
        throw new NotFoundException('Carrera no encontrada.');
      }
    }

    if (dto.areaAcademicaId) {
      await this.obtenerAreaPorId(dto.areaAcademicaId);
    }

    if (dto.fechaInicio && dto.fechaFin && dto.fechaFin < dto.fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }

    const asignacion = this.asignacionRepository.create({
      usuarioId: dto.usuarioId,
      tipo: dto.tipo,
      carreraId: dto.carreraId ?? null,
      areaAcademicaId: dto.areaAcademicaId ?? null,
      fechaInicio: dto.fechaInicio,
      fechaFin: dto.fechaFin ?? null,
      activo: true,
    });

    return this.asignacionRepository.save(asignacion);
  }

  async listarAsignaciones(usuarioId?: number): Promise<AsignacionAcademica[]> {
    const where = usuarioId ? { usuarioId } : {};

    return this.asignacionRepository.find({
      where,
      relations: {
        usuario: true,
        carrera: true,
        areaAcademica: true,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async obtenerAsignacionPorId(id: number): Promise<AsignacionAcademica> {
    const asignacion = await this.asignacionRepository.findOne({
      where: { id },
      relations: {
        usuario: true,
        carrera: true,
        areaAcademica: true,
      },
    });

    if (!asignacion) {
      throw new NotFoundException('Asignación académica no encontrada.');
    }

    return asignacion;
  }

  async actualizarAsignacion(
    id: number,
    dto: ActualizarAsignacionAcademicaDto,
  ): Promise<AsignacionAcademica> {
    const asignacion = await this.obtenerAsignacionPorId(id);

    const fechaInicio = dto.fechaInicio ?? asignacion.fechaInicio;
    const fechaFin =
      dto.fechaFin !== undefined ? dto.fechaFin : asignacion.fechaFin;

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }

    if (dto.fechaInicio !== undefined) {
      asignacion.fechaInicio = dto.fechaInicio;
    }

    if (dto.fechaFin !== undefined) {
      asignacion.fechaFin = dto.fechaFin;
    }

    if (dto.activo !== undefined) {
      asignacion.activo = dto.activo;
    }

    return this.asignacionRepository.save(asignacion);
  }

  async inactivarAsignacion(
    id: number,
    dto: InactivarAsignacionAcademicaDto = {},
  ): Promise<AsignacionAcademica> {
    const asignacion = await this.obtenerAsignacionPorId(id);

    if (!asignacion.activo) {
      throw new ConflictException(
        'La asignación académica ya se encuentra inactiva.',
      );
    }

    const fechaFin = dto.fechaFin ?? this.obtenerFechaInstitucional();

    if (fechaFin < asignacion.fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin no puede ser anterior a la fecha de inicio.',
      );
    }

    asignacion.activo = false;
    asignacion.fechaFin = fechaFin;

    return this.asignacionRepository.save(asignacion);
  }
}
