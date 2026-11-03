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

    // Support N:1 composite equivalence
    if (dto.tipoEquivalencia === 'N_A_1' || (dto.asignaturasOrigenIds && dto.asignaturasOrigenIds.length > 1)) {
      const origenIds = dto.asignaturasOrigenIds || (dto.asignaturaOrigenId ? [dto.asignaturaOrigenId] : []);
      if (!origenIds.length) {
        throw new BadRequestException('Se requieren asignaturas de origen para equivalencia N a 1.');
      }
      if (!dto.asignaturaDestinoId) {
        throw new BadRequestException('Se requiere una asignatura de destino para equivalencia N a 1.');
      }
      const asigDestino = await this.planAsignaturaRepo.findOne({
        where: { id: dto.asignaturaDestinoId, planEstudioId: dto.planDestinoId },
      });
      if (!asigDestino) {
        throw new BadRequestException('La asignatura de destino no pertenece al plan de destino.');
      }

      const groupId = `COMP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const creadas: EquivalenciaPlan[] = [];

      for (let i = 0; i < origenIds.length; i++) {
        const origId = origenIds[i];
        const asigOrigen = await this.planAsignaturaRepo.findOne({
          where: { id: origId, planEstudioId: dto.planOrigenId },
        });
        if (!asigOrigen) {
          throw new BadRequestException(`La asignatura de origen #${origId} no pertenece al plan de origen.`);
        }

        const tag = `[COMPUESTA_N1:${groupId}:${i + 1}:${origenIds.length}:${JSON.stringify(origenIds)}]`;
        const justif = dto.justificacion?.trim() ? `${tag} ${dto.justificacion.trim()}` : tag;

        const entidad = this.equivalenciaRepo.create({
          carreraOrigenId: dto.carreraOrigenId,
          planOrigenId: dto.planOrigenId,
          asignaturaOrigenId: origId,
          carreraDestinoId: dto.carreraDestinoId,
          planDestinoId: dto.planDestinoId,
          asignaturaDestinoId: dto.asignaturaDestinoId,
          justificacion: justif,
          autorizadoPorUsuarioId: usuarioId,
          activo: true,
        });
        creadas.push(await this.equivalenciaRepo.save(entidad));
      }
      return creadas[0];
    }

    // Support 1:N composite equivalence
    if (dto.tipoEquivalencia === '1_A_N' || (dto.asignaturasDestinoIds && dto.asignaturasDestinoIds.length > 1)) {
      const destIds = dto.asignaturasDestinoIds || (dto.asignaturaDestinoId ? [dto.asignaturaDestinoId] : []);
      if (!destIds.length) {
        throw new BadRequestException('Se requieren asignaturas de destino para equivalencia 1 a N.');
      }
      if (!dto.asignaturaOrigenId) {
        throw new BadRequestException('Se requiere una asignatura de origen para equivalencia 1 a N.');
      }
      const asigOrigen = await this.planAsignaturaRepo.findOne({
        where: { id: dto.asignaturaOrigenId, planEstudioId: dto.planOrigenId },
      });
      if (!asigOrigen) {
        throw new BadRequestException('La asignatura de origen no pertenece al plan de origen.');
      }

      const groupId = `COMP1N_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const creadas: EquivalenciaPlan[] = [];

      for (let i = 0; i < destIds.length; i++) {
        const dId = destIds[i];
        const asigDestino = await this.planAsignaturaRepo.findOne({
          where: { id: dId, planEstudioId: dto.planDestinoId },
        });
        if (!asigDestino) {
          throw new BadRequestException(`La asignatura de destino #${dId} no pertenece al plan de destino.`);
        }

        const tag = `[COMPUESTA_1N:${groupId}:${i + 1}:${destIds.length}:${JSON.stringify(destIds)}]`;
        const justif = dto.justificacion?.trim() ? `${tag} ${dto.justificacion.trim()}` : tag;

        const entidad = this.equivalenciaRepo.create({
          carreraOrigenId: dto.carreraOrigenId,
          planOrigenId: dto.planOrigenId,
          asignaturaOrigenId: dto.asignaturaOrigenId,
          carreraDestinoId: dto.carreraDestinoId,
          planDestinoId: dto.planDestinoId,
          asignaturaDestinoId: dId,
          justificacion: justif,
          autorizadoPorUsuarioId: usuarioId,
          activo: true,
        });
        creadas.push(await this.equivalenciaRepo.save(entidad));
      }
      return creadas[0];
    }

    // Standard 1:1
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

  async eliminar(usuarioId: number, id: number): Promise<{ success: boolean; eliminadas: number }> {
    const eq = await this.equivalenciaRepo.findOne({
      where: { id, activo: true },
    });
    if (!eq) {
      throw new NotFoundException('Equivalencia no encontrada o ya inactiva.');
    }

    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
      eq.carreraDestinoId,
    );
    if (!puede) {
      throw new ForbiddenException('No tiene permisos para eliminar equivalencias en la carrera destino.');
    }

    let eliminadas = 1;
    const matchGroup = eq.justificacion?.match(/\[COMPUESTA_(?:N1|1N):([^:]+):/);
    if (matchGroup && matchGroup[1]) {
      const groupId = matchGroup[1];
      const grupo = await this.equivalenciaRepo.find({
        where: { planOrigenId: eq.planOrigenId, planDestinoId: eq.planDestinoId, activo: true },
      });
      const relacionadas = grupo.filter((e) => e.justificacion && e.justificacion.includes(`:${groupId}:`));
      for (const rel of relacionadas) {
        rel.activo = false;
        await this.equivalenciaRepo.save(rel);
      }
      eliminadas = relacionadas.length || 1;
    } else {
      eq.activo = false;
      await this.equivalenciaRepo.save(eq);
    }

    return { success: true, eliminadas };
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
        eq.asignaturaOrigen?.cursoId != null && cursosAprobadosIds.has(eq.asignaturaOrigen.cursoId);
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
          codigo: eq.asignaturaOrigen?.curso?.codigo || eq.asignaturaOrigen?.codigoReferencia,
          nombre: eq.asignaturaOrigen?.curso?.nombre || eq.asignaturaOrigen?.nombreReferencia || 'Sin nombre',
          creditos: eq.asignaturaOrigen?.creditos,
        },
        destino: {
          asignaturaId: eq.asignaturaDestinoId,
          codigo: eq.asignaturaDestino?.curso?.codigo || eq.asignaturaDestino?.codigoReferencia,
          nombre: eq.asignaturaDestino?.curso?.nombre || eq.asignaturaDestino?.nombreReferencia || 'Sin nombre',
          creditos: eq.asignaturaDestino?.creditos,
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
  async autorizar(usuarioId: number, id: number): Promise<EquivalenciaPlan> {
    const eq = await this.equivalenciaRepo.findOne({
      where: { id },
      relations: { planDestino: true },
    });
    if (!eq) throw new NotFoundException('Equivalencia no encontrada.');

    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
      eq.carreraDestinoId,
    );
    if (!puede) throw new ForbiddenException('No tiene permisos para autorizar equivalencias en la carrera destino.');

    eq.activo = true;
    eq.autorizadoPorUsuarioId = usuarioId;
    return this.equivalenciaRepo.save(eq);
  }

  async rechazar(usuarioId: number, id: number, motivo: string): Promise<EquivalenciaPlan> {
    const eq = await this.equivalenciaRepo.findOne({
      where: { id },
      relations: { planDestino: true },
    });
    if (!eq) throw new NotFoundException('Equivalencia no encontrada.');

    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
      eq.carreraDestinoId,
    );
    if (!puede) throw new ForbiddenException('No tiene permisos para rechazar equivalencias en la carrera destino.');

    if (!motivo || motivo.trim().length < 5) {
      throw new BadRequestException('El motivo de rechazo de la equivalencia es obligatorio (mínimo 5 caracteres).');
    }

    eq.activo = false;
    eq.justificacion = `[RECHAZADA: ${motivo.trim()}] ${eq.justificacion || ''}`.substring(0, 500);
    return this.equivalenciaRepo.save(eq);
  }
}
