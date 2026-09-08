import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  }> {
    await this.obtenerPlan(planId);

    const [regla, cantidadEspaciosOptativos] = await Promise.all([
      this.reglaRepository.findOne({
        where: { planEstudioId: planId },
        relations: { planEstudio: true },
      }),
      this.contarEspaciosOptativos(planId),
    ]);

    return {
      regla,
      cantidadEspaciosOptativos,
    };
  }

  async guardar(
    planId: number,
    dto: GuardarReglaOptativaPlanDto,
  ): Promise<ReglaOptativaPlan> {
    await this.obtenerPlan(planId, true);

    const cantidadEspacios = await this.contarEspaciosOptativos(planId);

    if (cantidadEspacios === 0) {
      throw new BadRequestException(
        'El plan de estudio no contiene espacios optativos activos para configurar una regla.',
      );
    }

    if (dto.minimoDisciplinariasPropias > cantidadEspacios) {
      throw new BadRequestException(
        `El mínimo de optativas disciplinarias propias (${dto.minimoDisciplinariasPropias}) no puede ser mayor a la cantidad de espacios optativos (${cantidadEspacios}).`,
      );
    }

    if (
      dto.maximoOtrasAreas !== undefined &&
      dto.maximoOtrasAreas !== null &&
      dto.maximoOtrasAreas > cantidadEspacios
    ) {
      throw new BadRequestException(
        `El máximo de optativas de otras áreas (${dto.maximoOtrasAreas}) no puede ser mayor a la cantidad de espacios optativos (${cantidadEspacios}).`,
      );
    }

    let regla = await this.reglaRepository.findOne({
      where: { planEstudioId: planId },
    });

    if (!regla) {
      regla = this.reglaRepository.create({
        planEstudioId: planId,
        minimoDisciplinariasPropias: dto.minimoDisciplinariasPropias,
        maximoOtrasAreas: dto.maximoOtrasAreas ?? null,
      });
    } else {
      regla.minimoDisciplinariasPropias = dto.minimoDisciplinariasPropias;
      regla.maximoOtrasAreas = dto.maximoOtrasAreas ?? null;
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

    await this.reglaRepository.remove(regla);
  }
}
