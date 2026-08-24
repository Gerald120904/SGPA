import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';

@Injectable()
export class PlanResumenService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planRepository: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturaRepository: Repository<PlanAsignatura>,
    @InjectRepository(BloquePlan)
    private readonly bloqueRepository: Repository<BloquePlan>,
    @InjectRepository(PlanRequisito)
    private readonly requisitoRepository: Repository<PlanRequisito>,
    @InjectRepository(SalidaAcademica)
    private readonly salidaRepository: Repository<SalidaAcademica>,
  ) {}

  private sumar(asignaturas: PlanAsignatura[], campo: keyof PlanAsignatura) {
    return asignaturas.reduce((total, asignatura) => {
      const numero = Number(asignatura[campo]);
      return Number.isFinite(numero) ? total + numero : total;
    }, 0);
  }

  async obtener(planId: number) {
    const plan = await this.planRepository.findOne({
      where: { id: planId },
      relations: { carrera: true },
    });

    if (!plan) {
      throw new NotFoundException('El plan de estudio no existe.');
    }

    const [asignaturas, bloques, requisitos, salidas] = await Promise.all([
      this.asignaturaRepository.find({
        where: { planEstudioId: planId },
        relations: { curso: true, bloque: true },
        order: { nivel: 'ASC', ciclo: 'ASC', orden: 'ASC' },
      }),
      this.bloqueRepository.find({ where: { planEstudioId: planId } }),
      this.requisitoRepository.find({
        where: { asignatura: { planEstudioId: planId } },
        relations: { asignatura: true },
      }),
      this.salidaRepository.find({
        where: { planEstudioId: planId },
        relations: { asignaturas: true },
        order: { orden: 'ASC' },
      }),
    ]);

    const activas = asignaturas.filter((item) => item.activo);
    const ciclosMap = new Map();
    for (const asignatura of activas) {
      const clave = `${asignatura.nivel}-${asignatura.ciclo}`;
      const grupo = ciclosMap.get(clave) ?? {
        nivel: asignatura.nivel,
        ciclo: asignatura.ciclo,
        cantidadAsignaturas: 0,
        creditos: 0,
      };
      grupo.cantidadAsignaturas += 1;
      grupo.creditos += Number(asignatura.creditos || 0);
      ciclosMap.set(clave, grupo);
    }

    return {
      plan: {
        id: plan.id,
        codigo: plan.codigo,
        nombre: plan.nombre,
        activo: plan.activo,
        carrera: plan.carrera
          ? {
              id: plan.carrera.id,
              codigo: plan.carrera.codigo,
              nombre: plan.carrera.nombre,
            }
          : null,
      },
      asignaturas: {
        total: asignaturas.length,
        activas: activas.length,
        inactivas: asignaturas.length - activas.length,
        sinBloque: activas.filter((item) => item.bloqueId == null).length,
      },
      creditos: { total: this.sumar(activas, 'creditos') },
      horas: {
        teoria: this.sumar(activas, 'horasTeoria'),
        practica: this.sumar(activas, 'horasPractica'),
        laboratorio: this.sumar(activas, 'horasLaboratorio'),
        gira: this.sumar(activas, 'horasGira'),
        estudioIndependiente: this.sumar(activas, 'horasEstudioIndependiente'),
        totales: this.sumar(activas, 'horasTotales'),
        docente: this.sumar(activas, 'horasDocente'),
      },
      bloques: {
        total: bloques.length,
        activos: bloques.filter((item) => item.activo).length,
        detalle: bloques
          .slice()
          .sort((a, b) => Number(a.orden) - Number(b.orden))
          .map((bloque) => {
            const materias = activas.filter(
              (asignatura) => Number(asignatura.bloqueId) === Number(bloque.id),
            );
            return {
              id: bloque.id,
              codigo: bloque.codigo,
              nombre: bloque.nombre,
              tipo: bloque.tipo,
              activo: bloque.activo,
              cantidadAsignaturas: materias.length,
              creditos: this.sumar(materias, 'creditos'),
            };
          }),
      },
      relaciones: {
        requisitos: requisitos.filter(
          (item) => item.tipo === TipoRequisito.REQUISITO,
        ).length,
        correquisitos: requisitos.filter(
          (item) => item.tipo === TipoRequisito.CORREQUISITO,
        ).length,
      },
      ciclos: [...ciclosMap.values()].sort(
        (a, b) => a.nivel - b.nivel || a.ciclo - b.ciclo,
      ),
      salidas: salidas.map((salida) => {
        const asociadas = (salida.asignaturas || []).filter(
          (item) => item.activo,
        );
        const creditosAsociados = this.sumar(asociadas, 'creditos');
        return {
          id: salida.id,
          codigo: salida.codigo,
          nombre: salida.nombre,
          tipo: salida.tipo,
          activo: salida.activo,
          cantidadAsignaturas: asociadas.length,
          creditosRequeridos: salida.creditosRequeridos,
          creditosAsociados,
          diferenciaCreditos: creditosAsociados - salida.creditosRequeridos,
          cumpleCreditos: creditosAsociados === salida.creditosRequeridos,
        };
      }),
    };
  }
}
