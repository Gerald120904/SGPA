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
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
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

  private guardarSinDuplicados(planDestinoId: number, entidades: EquivalenciaPlan[]): Promise<EquivalenciaPlan> {
    return this.dataSource.transaction(async (manager) => {
      // El bloqueo del plan serializa las altas concurrentes del mismo destino.
      // La comprobación de duplicados debe ocurrir dentro de esta transacción.
      const planes = await manager.query('SELECT id FROM planes_estudio WHERE id = ? FOR UPDATE', [planDestinoId]);
      if (!planes.length) throw new BadRequestException('El plan de destino no existe.');
      const repo = manager.getRepository(EquivalenciaPlan);
      const creadas: EquivalenciaPlan[] = [];
      for (const entidad of entidades) {
        const existente = await repo.findOne({ where: {
          planOrigenId: entidad.planOrigenId,
          asignaturaOrigenId: entidad.asignaturaOrigenId,
          planDestinoId: entidad.planDestinoId,
          asignaturaDestinoId: entidad.asignaturaDestinoId,
          activo: true,
        } });
        if (existente) {
          throw new ConflictException('Ya existe una equivalencia activa registrada para estas asignaturas.');
        }
        creadas.push(await repo.save(entidad));
      }
      return creadas[0];
    });
  }

  async crear(usuarioId: number, dto: CrearEquivalenciaPlanDto): Promise<EquivalenciaPlan> {
    const puede = await this.alcance.puedeEjecutar(
      usuarioId,
      PermisoSistema.PLANES_ESTUDIO_GESTIONAR,
      dto.carreraDestinoId,
    );
    if (!puede) {
      throw new ForbiddenException('No tiene permisos para gestionar equivalencias en la carrera destino.');
    }
    const planDestino = await this.planRepo.findOne({ where: { id: dto.planDestinoId } });
    const planOrigen = await this.planRepo.findOne({ where: { id: dto.planOrigenId } });
    if (!planDestino || !planOrigen || planDestino.carreraId !== dto.carreraDestinoId
      || planOrigen.carreraId !== dto.carreraOrigenId) {
      throw new BadRequestException('Las carreras declaradas deben corresponder a los planes de origen y destino.');
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
      const origenes = await Promise.all(origenIds.map((id) =>
        this.planAsignaturaRepo.findOne({ where: { id, planEstudioId: dto.planOrigenId } })));
      const origenInvalido = origenes.findIndex((asignatura) => !asignatura);
      if (origenInvalido >= 0) {
        throw new BadRequestException(`La asignatura de origen #${origenIds[origenInvalido]} no pertenece al plan de origen.`);
      }
      const entidades = origenIds.map((origId, i) => {
        const tag = `[COMPUESTA_N1:${groupId}:${i + 1}:${origenIds.length}:${JSON.stringify(origenIds)}]`;
        const justif = dto.justificacion?.trim() ? `${tag} ${dto.justificacion.trim()}` : tag;
        return this.equivalenciaRepo.create({
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
      });
      return this.guardarSinDuplicados(dto.planDestinoId, entidades);
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
      const destinos = await Promise.all(destIds.map((id) =>
        this.planAsignaturaRepo.findOne({ where: { id, planEstudioId: dto.planDestinoId } })));
      const destinoInvalido = destinos.findIndex((asignatura) => !asignatura);
      if (destinoInvalido >= 0) {
        throw new BadRequestException(`La asignatura de destino #${destIds[destinoInvalido]} no pertenece al plan de destino.`);
      }
      const entidades = destIds.map((dId, i) => {
        const tag = `[COMPUESTA_1N:${groupId}:${i + 1}:${destIds.length}:${JSON.stringify(destIds)}]`;
        const justif = dto.justificacion?.trim() ? `${tag} ${dto.justificacion.trim()}` : tag;
        return this.equivalenciaRepo.create({
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
      });
      return this.guardarSinDuplicados(dto.planDestinoId, entidades);
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

    const entidad = this.equivalenciaRepo.create({
      ...dto,
      justificacion: dto.justificacion?.trim() || null,
      autorizadoPorUsuarioId: usuarioId,
      activo: true,
    });
    return this.guardarSinDuplicados(dto.planDestinoId, [entidad]);
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
      await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(EquivalenciaPlan);
        for (const rel of relacionadas) await repo.save({ ...rel, activo: false });
      });
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
    const historialesValidos = historiales.filter((h) =>
      h.planAsignatura?.tipo !== TipoPlanAsignatura.OPTATIVA ||
      h.cursoOptativoId == null || h.reconocimientoOptativo === 'RECONOCIDO');
    const aprobadasOrigenIds = new Set(historialesValidos.map((h) => h.planAsignaturaId));
    const cursosAprobadosIds = new Set(
      historialesValidos.filter((h) => h.planAsignatura?.cursoId).map((h) => h.planAsignatura.cursoId!),
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
    if (new Set(equivalencias.map((eq) => eq.id)).size !== new Set(dto.equivalenciaIds).size) {
      throw new BadRequestException('Una o más equivalencias solicitadas no están activas.');
    }
    if (equivalencias.some((eq) => eq.planDestinoId !== estudiante.planEstudioId
      || eq.carreraDestinoId !== estudiante.carreraId)) {
      throw new BadRequestException('Las equivalencias deben corresponder al plan de destino y carrera actuales del estudiante.');
    }

    return this.dataSource.transaction(async (manager) => {
      const estudiantesBloqueados = await manager.query(
        'SELECT id, plan_estudio_id AS planEstudioId, carrera_id AS carreraId FROM estudiantes WHERE id = ? FOR UPDATE', [dto.estudianteId],
      );
      if (!estudiantesBloqueados.length) throw new NotFoundException('Estudiante no encontrado.');
      if (equivalencias.some((eq) => eq.planDestinoId !== Number(estudiantesBloqueados[0].planEstudioId)
        || eq.carreraDestinoId !== Number(estudiantesBloqueados[0].carreraId))) {
        throw new BadRequestException('El estudiante cambió de plan o carrera antes de aplicar las equivalencias.');
      }
      if (!(await this.alcance.puedeEjecutar(usuarioId, PermisoSistema.ESTUDIANTES_GESTIONAR,
        Number(estudiantesBloqueados[0].carreraId)))) {
        throw new ForbiddenException('El permiso sobre la carrera fue revocado antes de aplicar las equivalencias.');
      }
      const historialRepo = manager.getRepository(HistorialAcademicoEstudiante);
      let aplicadas = 0;

      for (const eq of equivalencias) {
        if (eq.asignaturaDestino?.tipo === TipoPlanAsignatura.OPTATIVA) {
          throw new BadRequestException('La equivalencia hacia un espacio optativo requiere vincular una asignatura real y una decisión curricular explícita.');
        }
        const origenAprobado = await historialRepo.findOne({ where: {
          estudianteId: dto.estudianteId,
          planAsignaturaId: eq.asignaturaOrigenId,
          resultado: ResultadoAcademico.APROBADO,
        } });
        if (!origenAprobado) {
          throw new BadRequestException('La asignatura de origen no tiene una aprobación válida en el historial del estudiante.');
        }
        if (eq.asignaturaOrigen?.tipo === TipoPlanAsignatura.OPTATIVA &&
            origenAprobado.reconocimientoOptativo !== 'RECONOCIDO') {
          throw new BadRequestException('La optativa de origen no tiene un reconocimiento curricular válido.');
        }
        const grupoN1 = eq.justificacion?.match(/\[COMPUESTA_N1:([^:]+):\d+:\d+:(\[[^\]]+\])\]/);
        if (grupoN1) {
          let idsRequeridos: number[];
          try {
            idsRequeridos = JSON.parse(grupoN1[2]);
          } catch {
            throw new BadRequestException('La equivalencia compuesta tiene una definición inválida.');
          }
          if (!Array.isArray(idsRequeridos) || idsRequeridos.length < 2 ||
              idsRequeridos.some((id) => !Number.isInteger(id))) {
            throw new BadRequestException('La equivalencia compuesta tiene asignaturas requeridas inválidas.');
          }
          const ramas = await this.equivalenciaRepo.find({ where: {
            planOrigenId: eq.planOrigenId,
            planDestinoId: eq.planDestinoId,
            activo: true,
          } });
          const grupo = ramas.filter((rama) =>
            rama.asignaturaDestinoId === eq.asignaturaDestinoId &&
            rama.justificacion?.includes(`[COMPUESTA_N1:${grupoN1[1]}:`));
          if (new Set(grupo.map((rama) => rama.asignaturaOrigenId)).size !== idsRequeridos.length ||
              idsRequeridos.some((id) => !grupo.some((rama) => rama.asignaturaOrigenId === id))) {
            throw new BadRequestException('La equivalencia compuesta N a 1 no tiene todas sus ramas activas.');
          }
          for (const origenId of idsRequeridos) {
            const aprobado = await historialRepo.findOne({ where: {
              estudianteId: dto.estudianteId,
              planAsignaturaId: origenId,
              resultado: ResultadoAcademico.APROBADO,
            } });
            if (!aprobado) {
              throw new BadRequestException('Faltan asignaturas de origen aprobadas para la equivalencia compuesta N a 1.');
            }
          }
        }
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
