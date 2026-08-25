import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoRequisito } from './constants/tipo-requisito.constant';
import { BloquePlan } from './entities/bloque-plan.entity';
import { PlanAsignatura } from './entities/plan-asignatura.entity';
import { PlanEstudio } from './entities/plan-estudio.entity';
import { PlanRequisito } from './entities/plan-requisito.entity';
import { SalidaAcademica } from './entities/salida-academica.entity';
type Resultado = {
  codigo: string;
  nivel: 'ADVERTENCIA' | 'ERROR';
  mensaje: string;
  asignaturaId?: number;
  bloqueId?: number;
  salidaId?: number;
};

@Injectable()
export class PlanValidacionesService {
  constructor(
    @InjectRepository(PlanEstudio)
    private readonly planes: Repository<PlanEstudio>,
    @InjectRepository(PlanAsignatura)
    private readonly asignaturas: Repository<PlanAsignatura>,
    @InjectRepository(BloquePlan)
    private readonly bloques: Repository<BloquePlan>,
    @InjectRepository(PlanRequisito)
    private readonly requisitos: Repository<PlanRequisito>,
    @InjectRepository(SalidaAcademica)
    private readonly salidas: Repository<SalidaAcademica>,
  ) {}
  private nombre(a: PlanAsignatura) {
    const codigo =
      a.codigoReferencia?.trim() || a.curso?.codigo?.trim() || '';
    const nombre =
      a.nombreReferencia?.trim() || a.curso?.nombre?.trim() || '';

    if (codigo && nombre) {
      return `${codigo} - ${nombre}`;
    }

    return codigo || nombre || `Asignatura #${a.id}`;
  }
  private codigo(a: PlanAsignatura) {
    return (
      a.codigoReferencia?.trim().toUpperCase() ||
      a.curso?.codigo?.trim().toUpperCase() ||
      ''
    );
  }
  private despues(r: PlanAsignatura, a: PlanAsignatura) {
    return r.nivel > a.nivel || (r.nivel === a.nivel && r.ciclo > a.ciclo);
  }
  private ciclo(relaciones: PlanRequisito[]) {
    const g = new Map<number, Set<number>>();
    for (const r of relaciones.filter(
      (x) => x.tipo === TipoRequisito.REQUISITO,
    )) {
      if (!g.has(r.requisitoAsignaturaId))
        g.set(r.requisitoAsignaturaId, new Set());
      g.get(r.requisitoAsignaturaId)!.add(r.asignaturaId);
      if (!g.has(r.asignaturaId)) g.set(r.asignaturaId, new Set());
    }
    const vistos = new Set<number>(),
      pila = new Set<number>();
    let hay = false;
    const visitar = (n: number) => {
      if (pila.has(n)) {
        hay = true;
        return;
      }
      if (vistos.has(n) || hay) return;
      pila.add(n);
      for (const s of g.get(n) || []) visitar(s);
      pila.delete(n);
      vistos.add(n);
    };
    for (const n of g.keys()) visitar(n);
    return hay;
  }
  async validar(planId: number) {
    const plan = await this.planes.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('El plan de estudio no existe.');
    const [asignaturas, bloques, requisitos, salidas] = await Promise.all([
      this.asignaturas.find({
        where: { planEstudioId: planId },
        relations: { curso: true, bloque: true },
      }),
      this.bloques.find({ where: { planEstudioId: planId } }),
      this.requisitos.find({
        where: { asignatura: { planEstudioId: planId } },
        relations: { asignatura: true, requisitoAsignatura: true },
      }),
      this.salidas.find({
        where: { planEstudioId: planId },
        relations: { asignaturas: true },
      }),
    ]);
    const advertencias: Resultado[] = [],
      errores: Resultado[] = [],
      activas = asignaturas.filter((a) => a.activo);
    for (const a of activas) {
      const nombreAsignatura =
        a.nombreReferencia?.trim() || a.curso?.nombre?.trim() || '';

      if (!nombreAsignatura)
        errores.push({
          codigo: 'ASIGNATURA_SIN_NOMBRE',
          nivel: 'ERROR',
          asignaturaId: a.id,
          mensaje: `${this.nombre(a)} no tiene nombre curricular.`,
        });

      if (a.bloqueId == null)
        advertencias.push({
          codigo: 'ASIGNATURA_SIN_BLOQUE',
          nivel: 'ADVERTENCIA',
          asignaturaId: a.id,
          mensaje: `${this.nombre(a)} no tiene un bloque asignado.`,
        });
      const c = [
        a.horasTeoria,
        a.horasPractica,
        a.horasLaboratorio,
        a.horasGira,
        a.horasEstudioIndependiente,
      ];
      if (a.horasTotales != null && c.some((v) => v != null)) {
        const suma = c.reduce<number>((t, v) => t + Number(v || 0), 0),
          ht = Number(a.horasTotales);
        if (Math.abs(suma - ht) > 0.01)
          advertencias.push({
            codigo: 'HORAS_NO_COINCIDEN',
            nivel: 'ADVERTENCIA',
            asignaturaId: a.id,
            mensaje: `${this.nombre(a)} registra HT ${ht}, pero la suma T + P + L + G + EI es ${suma}.`,
          });
      }
    }
    for (const b of bloques.filter((b) => b.activo))
      if (!activas.some((a) => Number(a.bloqueId) === Number(b.id)))
        advertencias.push({
          codigo: 'BLOQUE_VACIO',
          nivel: 'ADVERTENCIA',
          bloqueId: b.id,
          mensaje: `El bloque "${b.nombre}" no contiene asignaturas activas.`,
        });
    const codigosUsados = new Set<string>();
    for (const a of activas) {
      const codigo = this.codigo(a);

      if (!codigo) {
        errores.push({
          codigo: 'ASIGNATURA_SIN_CODIGO',
          nivel: 'ERROR',
          asignaturaId: a.id,
          mensaje: `La asignatura #${a.id} no tiene código curricular.`,
        });
        continue;
      }

      if (codigosUsados.has(codigo)) {
        errores.push({
          codigo: 'CODIGO_ASIGNATURA_DUPLICADO',
          nivel: 'ERROR',
          asignaturaId: a.id,
          mensaje: `El código ${codigo} aparece más de una vez dentro del mismo plan.`,
        });
        continue;
      }

      codigosUsados.add(codigo);
    }
    for (const r of requisitos.filter(
      (r) => r.tipo === TipoRequisito.REQUISITO,
    )) {
      const a = r.asignatura,
        req = r.requisitoAsignatura;
      if (!a || !req) continue;
      if (!a.activo || !req.activo)
        advertencias.push({
          codigo: 'REQUISITO_INACTIVO',
          nivel: 'ADVERTENCIA',
          asignaturaId: a.id,
          mensaje: `${this.nombre(a)} tiene una relación de requisito con una asignatura inactiva.`,
        });
      else if (this.despues(req, a))
        advertencias.push({
          codigo: 'REQUISITO_POSTERIOR',
          nivel: 'ADVERTENCIA',
          asignaturaId: a.id,
          mensaje: `${this.nombre(a)} requiere ${this.nombre(req)}, pero el requisito está ubicado en un ciclo posterior.`,
        });
    }
    if (this.ciclo(requisitos))
      errores.push({
        codigo: 'CICLO_REQUISITOS',
        nivel: 'ERROR',
        mensaje: 'El plan contiene un ciclo entre requisitos académicos.',
      });
    for (const s of salidas.filter((s) => s.activo)) {
      const m = (s.asignaturas || []).filter((a) => a.activo),
        c = m.reduce((t, a) => t + Number(a.creditos || 0), 0);
      if (!m.length)
        advertencias.push({
          codigo: 'SALIDA_SIN_ASIGNATURAS',
          nivel: 'ADVERTENCIA',
          salidaId: s.id,
          mensaje: `La salida académica "${s.nombre}" no tiene asignaturas asociadas.`,
        });
      if (c !== Number(s.creditosRequeridos))
        advertencias.push({
          codigo: 'CREDITOS_SALIDA_NO_COINCIDEN',
          nivel: 'ADVERTENCIA',
          salidaId: s.id,
          mensaje: `"${s.nombre}" requiere ${s.creditosRequeridos} créditos, pero tiene ${c} créditos asociados.`,
        });
    }
    return {
      valido: errores.length === 0,
      totalErrores: errores.length,
      totalAdvertencias: advertencias.length,
      errores,
      advertencias,
    };
  }
}
