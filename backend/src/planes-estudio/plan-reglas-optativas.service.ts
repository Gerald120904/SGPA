import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TipoOptativa } from '../optativas/constants/tipo-optativa.constant';
import { TipoPlanAsignatura } from './constants/tipo-plan-asignatura.constant';
import { GuardarReglaOptativaPlanDto } from './dto/guardar-regla-optativa-plan.dto';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { ReglaOptativaPlan } from './entities/regla-optativa-plan.entity';

@Injectable()
export class PlanReglasOptativasService {
  constructor(
    @InjectRepository(ReglaOptativaPlan)
    private readonly reglaRepository: Repository<ReglaOptativaPlan>,
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
  ) {}

  private async obtenerPlan(
    planId: number,
    exigirActivo = false,
  ): Promise<PlanEstudio> {
    const plan = await this.planRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan de estudio no encontrado.');
    }

    if (exigirActivo && !plan.activo) {
      throw new BadRequestException(
        'No se puede modificar un plan de estudio inactivo.',
      );
    }

    return plan;
  }

  private async contarPorTipo(planId: number, tipoOptativa: TipoOptativa) {
    return this.asignaturaRepository.count({
      where: {
        planEstudioId: planId,
        tipo: TipoPlanAsignatura.OPTATIVA,
        tipoOptativa,
        activo: true,
      },
    });
  }

  private async obtenerConteoActual(planId: number) {
    const [disciplinarias, abiertas, sede, sinClasificar] = await Promise.all([
      this.contarPorTipo(planId, TipoOptativa.DISCIPLINARIA),
      this.contarPorTipo(planId, TipoOptativa.ABIERTA),
      this.contarPorTipo(planId, TipoOptativa.SEDE),
      this.asignaturaRepository.count({
        where: {
          planEstudioId: planId,
          tipo: TipoPlanAsignatura.OPTATIVA,
          tipoOptativa: IsNull(),
          activo: true,
        },
      }),
    ]);

    return {
      disciplinarias,
      abiertas,
      sede,
      sinClasificar,
      total: disciplinarias + abiertas + sede + sinClasificar,
    };
  }

  async contarEspaciosOptativos(planId: number): Promise<number> {
    return this.asignaturaRepository.count({
      where: {
        planEstudioId: planId,
        tipo: TipoPlanAsignatura.OPTATIVA,
        activo: true,
      },
    });
  }

  async obtener(planId: number): Promise<{
    regla: ReglaOptativaPlan | null;
    cantidadEspaciosOptativos: number;
    cantidadEspaciosConfigurados: number;
    conteoActual: {
      disciplinarias: number;
      abiertas: number;
      sede: number;
      sinClasificar: number;
      total: number;
    };
  }> {
    await this.obtenerPlan(planId);

    const [regla, conteoActual] = await Promise.all([
      this.reglaRepository.findOne({
        where: { planEstudioId: planId },
        relations: { planEstudio: true },
      }),
      this.obtenerConteoActual(planId),
    ]);

    const cantidadEspaciosConfigurados = regla
      ? Number(regla.cantidadDisciplinarias || 0) +
        Number(regla.cantidadAbiertas || 0) +
        Number(regla.cantidadSede || 0)
      : 0;

    return {
      regla,
      cantidadEspaciosOptativos: conteoActual.total,
      cantidadEspaciosConfigurados,
      conteoActual,
    };
  }

  async guardar(
    planId: number,
    dto: GuardarReglaOptativaPlanDto,
  ): Promise<ReglaOptativaPlan> {
    await this.obtenerPlan(planId, true);

    const totalConfigurado =
      dto.cantidadDisciplinarias + dto.cantidadAbiertas + dto.cantidadSede;

    if (totalConfigurado > 200) {
      throw new BadRequestException(
        'La suma de espacios optativos no puede superar 200.',
      );
    }

    const conteo = await this.obtenerConteoActual(planId);

    if (conteo.sinClasificar > 0) {
      throw new BadRequestException(
        'Existen asignaturas optativas sin clasificar. Clasifíquelas antes de modificar la regla.',
      );
    }

    if (conteo.disciplinarias > dto.cantidadDisciplinarias) {
      throw new BadRequestException(
        `El plan ya tiene ${conteo.disciplinarias} optativas disciplinarias activas. No puede fijar un límite de ${dto.cantidadDisciplinarias}.`,
      );
    }

    if (conteo.abiertas > dto.cantidadAbiertas) {
      throw new BadRequestException(
        `El plan ya tiene ${conteo.abiertas} optativas abiertas activas. No puede fijar un límite de ${dto.cantidadAbiertas}.`,
      );
    }

    if (conteo.sede > dto.cantidadSede) {
      throw new BadRequestException(
        `El plan ya tiene ${conteo.sede} optativas de sede activas. No puede fijar un límite de ${dto.cantidadSede}.`,
      );
    }

    let regla = await this.reglaRepository.findOne({
      where: { planEstudioId: planId },
    });

    const datos = {
      cantidadDisciplinarias: dto.cantidadDisciplinarias,
      cantidadAbiertas: dto.cantidadAbiertas,
      cantidadSede: dto.cantidadSede,
      // Compatibilidad con el esquema anterior.
      minimoDisciplinariasPropias: dto.cantidadDisciplinarias,
      maximoOtrasAreas: dto.cantidadAbiertas + dto.cantidadSede,
    };

    if (!regla) {
      regla = this.reglaRepository.create({
        planEstudioId: planId,
        ...datos,
      });
    } else {
      Object.assign(regla, datos);
    }

    return this.reglaRepository.save(regla);
  }

  async eliminar(planId: number): Promise<void> {
    await this.obtenerPlan(planId, true);

    const regla = await this.reglaRepository.findOne({
      where: { planEstudioId: planId },
    });

    if (!regla) {
      throw new NotFoundException(
        'Regla de optativas no encontrada para este plan.',
      );
    }

    const cantidadOptativas = await this.contarEspaciosOptativos(planId);

    if (cantidadOptativas > 0) {
      throw new BadRequestException(
        'No se puede eliminar la regla mientras existan asignaturas optativas activas en el plan.',
      );
    }

    await this.reglaRepository.remove(regla);
  }
}
