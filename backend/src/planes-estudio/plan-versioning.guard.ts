import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EstadoPlanEstudio } from './constants/estado-plan-estudio.constant';
import { PlanEstudio } from './entities/plan-estudio.entity';

/** Serializes curriculum writes with activation and allows writes only on drafts. */
export async function exigirPlanBorrador(manager: EntityManager, planId: number): Promise<PlanEstudio> {
  const plan = await manager.getRepository(PlanEstudio).findOne({
    where: { id: planId }, lock: { mode: 'pessimistic_write' },
  });
  if (!plan) throw new NotFoundException('Plan de estudio no encontrado.');
  if (plan.estado && plan.estado !== EstadoPlanEstudio.BORRADOR) {
    throw new BadRequestException('Los cambios curriculares solo se permiten en un plan BORRADOR.');
  }
  return plan;
}
