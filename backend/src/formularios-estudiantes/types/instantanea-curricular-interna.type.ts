import { BadRequestException } from '@nestjs/common';
import { MotorReglasAcademicas } from '../../planes-estudio/motor-requisitos/motor-reglas-academicas';
import {
  AsignaturaRegla,
  OpcionesEvaluacionMotor,
  RequisitoRegla,
  ResultadoEvaluacionMotor,
} from '../../planes-estudio/motor-requisitos/types/motor-reglas.types';

export interface InstantaneaCurricularInterna {
  version: 3;
  plan: { id: number; nombre: string; codigo: string; carreraId: number };
  asignaturas: AsignaturaRegla[];
  requisitos: RequisitoRegla[];
}

export function esInstantaneaCurricularInterna(
  valor: unknown,
): valor is InstantaneaCurricularInterna {
  if (!valor || typeof valor !== 'object') return false;
  const candidato = valor as Partial<InstantaneaCurricularInterna>;
  return candidato.version === 3 &&
    typeof candidato.plan?.id === 'number' &&
    Array.isArray(candidato.asignaturas) &&
    Array.isArray(candidato.requisitos);
}

export function validarSeleccionInstantanea(
  instantanea: InstantaneaCurricularInterna,
  ids: number[],
  opciones?: OpcionesEvaluacionMotor,
): ResultadoEvaluacionMotor {
  const resultado = MotorReglasAcademicas.evaluar(
    instantanea.asignaturas,
    instantanea.requisitos,
    ids,
    opciones,
  );
  if (!resultado.esValido && resultado.inconsistenciasGrafo.length > 0) {
    throw new BadRequestException(
      `La instantánea curricular contiene inconsistencias: ${resultado.inconsistenciasGrafo.join('; ')}`,
    );
  }
  if (resultado.desmarcadasCascada.length > 0) {
    const primera = resultado.desmarcadasCascada[0];
    throw new BadRequestException(
      `Selección inválida: La asignatura "${primera.codigo} - ${primera.nombre}" no puede marcarse como aprobada porque falta su requisito previo. ${primera.motivo}`,
    );
  }
  const validos = new Set(resultado.asignaturas.map((a) => a.asignaturaId));
  for (const id of resultado.solicitadasOriginales) {
    if (!validos.has(id)) {
      throw new BadRequestException(
        `La asignatura #${id} no pertenece a la versión publicada del plan #${instantanea.plan.id}.`,
      );
    }
  }
  return resultado;
}

export function catalogoDesdeInstantanea(
  instantanea: InstantaneaCurricularInterna,
  opciones?: OpcionesEvaluacionMotor,
) {
  const resultado = MotorReglasAcademicas.evaluar(
    instantanea.asignaturas,
    instantanea.requisitos,
    [],
    opciones,
  );
  const niveles = new Map<number, Map<number, ResultadoEvaluacionMotor['asignaturas']>>();
  for (const asignatura of resultado.asignaturas) {
    if (!niveles.has(asignatura.nivel)) niveles.set(asignatura.nivel, new Map());
    const ciclos = niveles.get(asignatura.nivel)!;
    if (!ciclos.has(asignatura.ciclo)) ciclos.set(asignatura.ciclo, []);
    ciclos.get(asignatura.ciclo)!.push(asignatura);
  }
  return [...niveles.entries()]
    .sort(([a], [b]) => a - b)
    .map(([nivel, ciclos]) => ({
      nivel,
      ciclos: [...ciclos.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ciclo, asignaturas]) => ({ ciclo, asignaturas })),
    }));
}
