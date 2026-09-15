import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from '../../carreras/entities/carrera.entity';
import { EstructuraAcademicaService } from '../../estructura-academica/estructura-academica.service';
import { PlanEstudio } from '../../planes-estudio/entities/plan-estudio.entity';
import { EstadoImportacionGoogle } from './constants/estado-importacion-google.constant';
import { ActualizarConfiguracionFormularioDto } from './dto/actualizar-configuracion-formulario.dto';
import { CrearConfiguracionFormularioDto } from './dto/crear-configuracion-formulario.dto';
import { ConfiguracionFormularioEstudiantes } from './entities/configuracion-formulario-estudiantes.entity';
import { ImportacionGoogleEstudiante } from './entities/importacion-google-estudiante.entity';

@Injectable()
export class GoogleFormsService {
  constructor(
    @InjectRepository(ConfiguracionFormularioEstudiantes)
    private readonly configuracionRepository: Repository<ConfiguracionFormularioEstudiantes>,
    @InjectRepository(ImportacionGoogleEstudiante)
    private readonly importacionRepository: Repository<ImportacionGoogleEstudiante>,
    @InjectRepository(Carrera)
    private readonly carreraRepository: Repository<Carrera>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    private readonly estructuraAcademicaService: EstructuraAcademicaService,
  ) {}

  async crearConfiguracion(
    usuarioId: number,
    dto: CrearConfiguracionFormularioDto,
  ): Promise<ConfiguracionFormularioEstudiantes> {
    await this.validarAlcanceYPlan(usuarioId, dto.carreraId, dto.planEstudioId);

    const nueva = this.configuracionRepository.create({
      nombre: dto.nombre.trim(),
      googleFormId: dto.googleFormId.trim(),
      googleSheetId: dto.googleSheetId.trim(),
      carreraId: dto.carreraId,
      planEstudioId: dto.planEstudioId,
      activo: true,
      ultimaFilaProcesada: dto.ultimaFilaProcesada ?? 1,
    });

    return this.configuracionRepository.save(nueva);
  }

  async listarConfiguraciones(
    usuarioId: number,
    filtro?: { carreraId?: number; activo?: boolean },
  ): Promise<ConfiguracionFormularioEstudiantes[]> {
    const query = this.configuracionRepository
      .createQueryBuilder('config')
      .leftJoinAndSelect('config.carrera', 'carrera')
      .leftJoinAndSelect('config.planEstudio', 'planEstudio')
      .orderBy('config.id', 'DESC');

    if (filtro?.carreraId) {
      query.andWhere('config.carreraId = :carreraId', {
        carreraId: filtro.carreraId,
      });
    }

    if (filtro?.activo !== undefined) {
      query.andWhere('config.activo = :activo', { activo: filtro.activo });
    }

    const configs = await query.getMany();

    // Filtrar por alcance académico
    const permitidas: ConfiguracionFormularioEstudiantes[] = [];
    for (const config of configs) {
      const tieneAlcance =
        await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
          usuarioId,
          config.carreraId,
        );
      if (tieneAlcance) {
        permitidas.push(config);
      }
    }

    return permitidas;
  }

  async obtenerConfiguracionPorId(
    usuarioId: number,
    id: number,
  ): Promise<ConfiguracionFormularioEstudiantes> {
    const config = await this.configuracionRepository.findOne({
      where: { id },
      relations: { carrera: true, planEstudio: true },
    });

    if (!config) {
      throw new NotFoundException('La configuración no existe.');
    }

    await this.validarAlcanceCarrera(usuarioId, config.carreraId);
    return config;
  }

  async actualizarConfiguracion(
    usuarioId: number,
    id: number,
    dto: ActualizarConfiguracionFormularioDto,
  ): Promise<ConfiguracionFormularioEstudiantes> {
    const config = await this.obtenerConfiguracionPorId(usuarioId, id);

    const carreraId = dto.carreraId ?? config.carreraId;
    const planEstudioId = dto.planEstudioId ?? config.planEstudioId;

    if (dto.carreraId !== undefined || dto.planEstudioId !== undefined) {
      await this.validarAlcanceYPlan(usuarioId, carreraId, planEstudioId);
    }

    if (dto.nombre !== undefined) config.nombre = dto.nombre.trim();
    if (dto.googleFormId !== undefined)
      config.googleFormId = dto.googleFormId.trim();
    if (dto.googleSheetId !== undefined)
      config.googleSheetId = dto.googleSheetId.trim();
    if (dto.carreraId !== undefined) config.carreraId = dto.carreraId;
    if (dto.planEstudioId !== undefined) config.planEstudioId = dto.planEstudioId;
    if (dto.activo !== undefined) config.activo = dto.activo;
    if (dto.ultimaFilaProcesada !== undefined)
      config.ultimaFilaProcesada = dto.ultimaFilaProcesada;

    return this.configuracionRepository.save(config);
  }

  async cambiarEstado(
    usuarioId: number,
    id: number,
    activo: boolean,
  ): Promise<ConfiguracionFormularioEstudiantes> {
    const config = await this.obtenerConfiguracionPorId(usuarioId, id);
    config.activo = activo;
    return this.configuracionRepository.save(config);
  }

  async listarRespuestas(
    usuarioId: number,
    configuracionId: number,
    estado?: EstadoImportacionGoogle,
  ): Promise<ImportacionGoogleEstudiante[]> {
    const config = await this.obtenerConfiguracionPorId(
      usuarioId,
      configuracionId,
    );

    const where: { configuracionId: number; estado?: EstadoImportacionGoogle } = {
      configuracionId: config.id,
    };
    if (estado) {
      where.estado = estado;
    }

    return this.importacionRepository.find({
      where,
      order: { filaOrigen: 'ASC', id: 'ASC' },
    });
  }

  private async validarAlcanceYPlan(
    usuarioId: number,
    carreraId: number,
    planEstudioId: number,
  ) {
    await this.validarAlcanceCarrera(usuarioId, carreraId);

    const carrera = await this.carreraRepository.findOne({
      where: { id: carreraId },
    });
    if (!carrera) throw new BadRequestException('La carrera no existe.');
    if (!carrera.activo)
      throw new BadRequestException('La carrera se encuentra inactiva.');

    const plan = await this.planRepository.findOne({
      where: { id: planEstudioId },
    });
    if (!plan) throw new BadRequestException('El plan de estudio no existe.');
    if (!plan.activo)
      throw new BadRequestException(
        'El plan de estudio se encuentra inactivo.',
      );
    if (plan.carreraId !== carreraId) {
      throw new BadRequestException(
        'El plan de estudio no pertenece a la carrera indicada.',
      );
    }
  }

  private async validarAlcanceCarrera(usuarioId: number, carreraId: number) {
    const tieneAlcance =
      await this.estructuraAcademicaService.tieneAlcanceSobreCarrera(
        usuarioId,
        carreraId,
      );
    if (!tieneAlcance) {
      throw new ForbiddenException(
        'No posee alcance académico sobre la carrera indicada.',
      );
    }
  }
}
