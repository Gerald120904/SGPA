import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Estudiante } from '../estudiantes/entities/estudiante.entity';
import { HistorialAcademicoEstudiante } from '../estudiantes/entities/historial-academico-estudiante.entity';
import { ResultadoAcademico } from '../estudiantes/constants/resultado-academico.constant';
import { OrigenAcademico } from '../estudiantes/constants/origen-academico.constant';
import { FuenteRegistroAcademico } from '../estudiantes/constants/fuente-registro-academico.constant';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { EquivalenciaPlan } from './entities/equivalencia-plan.entity';
import { CrearEquivalenciaPlanDto } from './dto/crear-equivalencia-plan.dto';
import { AplicarEquivalenciasEstudianteDto } from './dto/aplicar-equivalencias-estudiante.dto';

@Injectable()
export class EquivalenciasService {
  constructor(
    @InjectRepository(EquivalenciaPlan)
    private readonly equivalenciaRepo: Repository<EquivalenciaPlan>,
    @InjectRepository(PlanEstudio)
    private readonly planRepo: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly planAsignaturaRepo: Repository<PlanAsignatura>,
    @InjectRepository(Estudiante)
    private readonly estudianteRepo: Repository<Estudiante>,
    @InjectRepository(HistorialAcademicoEstudiante)
    private readonly historialRepo: Repository<HistorialAcademicoEstudiante>,
    private readonly alcance: AlcanceJerarquicoService,
    private readonly dataSource: DataSource,
  ) {}

  async crear(usuarioId: number, dto: CrearEquivalenciaPlanDto): Promise<EquivalenciaPlan> {
    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
      dto.carreraDestinoId,
    );
    if (!puede) {
      throw new ForbiddenException('No tiene permisos para gestionar equivalencias en la carrera destino.');
    }

    const [asigOrigen, asigDestino] = await Promise.all([
      this.planAsignaturaRepo.findOne({
        where: { id: dto.asignaturaOrigenId, planEstudioId: dto.planOrigenId },
      }),
      this.planAsignaturaRepo.findOne({
        where: { id: dto.asignaturaDestinoId, planEstudioId: dto.planDestinoId },
      }),
    ]);

    if (!asigOrigen) {
      throw new BadRequestException('La asignatura de origen no pertenece al plan de origen.');
    }
    if (!asigDestino) {
      throw new BadRequestException('La asignatura de destino no pertenece al plan de destino.');
    }

    const existente = await this.equivalenciaRepo.findOne({
      where: {
        planOrigenId: dto.planOrigenId,
        asignaturaOrigenId: dto.asignaturaOrigenId,
        planDestinoId: dto.planDestinoId,
        asignaturaDestinoId: dto.asignaturaDestinoId,
        activo: true,
      },
    });
    if (existente) {
      throw new ConflictException('Ya existe una equivalencia activa registrada para estas asignaturas.');
    }

    const entidad = this.equivalenciaRepo.create({
      ...dto,
      justificacion: dto.justificacion?.trim() || null,
      autorizadoPorUsuarioId: usuarioId,
      activo: true,
    });
    return this.equivalenciaRepo.save(entidad);
  }

  async listarPorPlanes(planOrigenId: number, planDestinoId: number): Promise<EquivalenciaPlan[]> {
    return this.equivalenciaRepo.find({
      where: { planOrigenId, planDestinoId, activo: true },
      relations: {
        asignaturaOrigen: { curso: true },
        asignaturaDestino: { curso: true },
        planOrigen: true,
        planDestino: true,
      },
    });
  }

  async sugerirEquivalenciasParaEstudiante(
    usuarioId: number,
    estudianteId: number,
    planNuevoId: number,
  ) {
    const estudiante = await this.estudianteRepo.findOne({
      where: { id: estudianteId },
      relations: { planEstudio: true },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');

    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.ESTUDIANTES_VER,
      estudiante.carreraId,
    );
    if (!puede) throw new ForbiddenException('No tiene permisos para ver este estudiante.');

    const planNuevo = await this.planRepo.findOne({ where: { id: planNuevoId } });
    if (!planNuevo) throw new NotFoundException('Plan destino no encontrado.');

    // 1. Asignaturas aprobadas del estudiante en su plan origen
    const historiales = await this.historialRepo.find({
      where: { estudianteId, resultado: ResultadoAcademico.APROBADO },
      relations: { planAsignatura: { curso: true } },
    });
    const aprobadasOrigenIds = new Set(historiales.map((h) => h.planAsignaturaId));
    const cursosAprobadosIds = new Set(
      historiales.filter((h) => h.planAsignatura?.cursoId).map((h) => h.planAsignatura.cursoId!),
    );

    // 2. Equivalencias activas del plan actual al nuevo plan
    const equivalencias = await this.equivalenciaRepo.find({
      where: {
        planOrigenId: estudiante.planEstudioId,
        planDestinoId: planNuevoId,
        activo: true,
      },
      relations: {
        asignaturaOrigen: { curso: true },
        asignaturaDestino: { curso: true },
      },
    });

    // 3. Filtrar las que el estudiante tiene aprobadas en origen
    const sugerencias = equivalencias.filter((eq) => {
      const tieneAprobadaPorId = aprobadasOrigenIds.has(eq.asignaturaOrigenId);
      const tieneAprobadaPorCurso =
        eq.asignaturaOrigen.cursoId != null && cursosAprobadosIds.has(eq.asignaturaOrigen.cursoId);
      return tieneAprobadaPorId || tieneAprobadaPorCurso;
    });

    return {
      estudianteId,
      planActualId: estudiante.planEstudioId,
      planNuevoId,
      totalSugeridas: sugerencias.length,
      sugerencias: sugerencias.map((eq) => ({
        equivalenciaId: eq.id,
        origen: {
          asignaturaId: eq.asignaturaOrigenId,
          codigo: eq.asignaturaOrigen.curso?.codigo || eq.asignaturaOrigen.codigoReferencia,
          nombre: eq.asignaturaOrigen.curso?.nombre || eq.asignaturaOrigen.nombreReferencia || 'Sin nombre',
          creditos: eq.asignaturaOrigen.creditos,
        },
        destino: {
          asignaturaId: eq.asignaturaDestinoId,
          codigo: eq.asignaturaDestino.curso?.codigo || eq.asignaturaDestino.codigoReferencia,
          nombre: eq.asignaturaDestino.curso?.nombre || eq.asignaturaDestino.nombreReferencia || 'Sin nombre',
          creditos: eq.asignaturaDestino.creditos,
        },
        justificacion: eq.justificacion,
      })),
    };
  }

  async aplicarEquivalenciasEstudiante(
    usuarioId: number,
    dto: AplicarEquivalenciasEstudianteDto,
  ) {
    const estudiante = await this.estudianteRepo.findOne({
      where: { id: dto.estudianteId },
    });
    if (!estudiante) throw new NotFoundException('Estudiante no encontrado.');

    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.ESTUDIANTES_GESTIONAR,
      estudiante.carreraId,
    );
    if (!puede) throw new ForbiddenException('No tiene permisos para modificar el expediente del estudiante.');

    const equivalencias = await this.equivalenciaRepo.find({
      where: { id: In(dto.equivalenciaIds), activo: true },
      relations: { asignaturaOrigen: true, asignaturaDestino: true },
    });

    if (!equivalencias.length) {
      throw new BadRequestException('No se encontraron equivalencias activas válidas para aplicar.');
    }

    return this.dataSource.transaction(async (manager) => {
      const historialRepo = manager.getRepository(HistorialAcademicoEstudiante);
      let aplicadas = 0;

      for (const eq of equivalencias) {
        // Verificar si ya está aprobada la de destino para no duplicar créditos
        const yaAprobada = await historialRepo.findOne({
          where: {
            estudianteId: dto.estudianteId,
            planAsignaturaId: eq.asignaturaDestinoId,
            resultado: ResultadoAcademico.APROBADO,
          },
        });
        if (!yaAprobada) {
          await historialRepo.save(
            historialRepo.create({
              estudianteId: dto.estudianteId,
              planAsignaturaId: eq.asignaturaDestinoId,
              resultado: ResultadoAcademico.APROBADO,
              origenAcademico: OrigenAcademico.EQUIVALENCIA,
              fuenteRegistro: FuenteRegistroAcademico.MANUAL,
              observaciones: `Equivalencia institucional aplicada desde asignatura #${eq.asignaturaOrigenId}`,
              registradoPorUsuarioId: usuarioId,
            }),
          );
          aplicadas++;
        }
      }

      return {
        estudianteId: dto.estudianteId,
        solicitadas: dto.equivalenciaIds.length,
        aplicadas,
      };
    });
  }
}
