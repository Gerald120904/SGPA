/**
 * Motor reactivo de evaluación de prerrequisitos para el frontend del estudiante.
 * Implementa la misma lógica determinista que MotorReglasAcademicas en el backend,
 * garantizando coherencia exacta en el contrato de evaluación.
 */

export interface AsignaturaFrontend {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  nivel: number;
  ciclo: number;
  orden?: number;
  creditos?: number;
  activo?: boolean;
  estado?: string;
  detallesRequisitos?: Array<{
    requisitoAsignaturaId: number;
    codigo?: string;
    nombre?: string;
    tipo: 'REQUISITO' | 'CORREQUISITO';
    cumplido?: boolean;
  }>;
}

/**
 * Determina si una asignatura está habilitada para ser seleccionada
 * basándose en el conjunto actual de asignaturas marcadas como aprobadas.
 *
 * Reglas fundamentales:
 * 1. Si está inactiva o con estado INCONSISTENTE, NO es elegible.
 * 2. Si posee algún CORREQUISITO bajo la política preventiva BLOQUEAR_REVISION, NO es elegible.
 * 3. Si no tiene requisitos obligatorios, ES elegible inmediatamente.
 * 4. Si tiene requisitos obligatorios, TODOS y cada uno de ellos deben estar en aprobadasSeleccionadas.
 */
export function esAsignaturaElegibleFrontend(
  asignatura: AsignaturaFrontend,
  aprobadasSeleccionadas: Set<number>,
): boolean {
  if (asignatura.activo === false || asignatura.estado === 'INACTIVA' || asignatura.estado === 'INCONSISTENTE') {
    return false;
  }

  const requisitos = asignatura.detallesRequisitos || [];

  if (requisitos.length === 0) {
    return true;
  }

  for (const req of requisitos) {
    // Correquisitos bloqueados preventivamente
    if (req.tipo === 'CORREQUISITO') {
      return false;
    }

    // Prerrequisito obligatorio
    if (req.tipo === 'REQUISITO') {
      if (!aprobadasSeleccionadas.has(req.requisitoAsignaturaId)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Poda en cascada de selecciones inválidas:
 * Si el estudiante desmarca una asignatura requisito previa, cualquier asignatura
 * dependiente que dependa directa o indirectamente de ella es automáticamente
 * desmarcada y removida del conjunto de aprobadas.
 *
 * @param asignaturas Lista completa de asignaturas del plan.
 * @param aprobadasSeleccionadas Conjunto mutable de IDs seleccionados.
 * @returns Array de IDs que fueron desmarcados en cascada.
 */
export function podarSeleccionesInvalidasFrontend(
  asignaturas: AsignaturaFrontend[],
  aprobadasSeleccionadas: Set<number>,
): number[] {
  const mapaAsignaturas = new Map<number, AsignaturaFrontend>();
  for (const asig of asignaturas) {
    mapaAsignaturas.set(asig.asignaturaId, asig);
  }

  const desmarcadas: number[] = [];
  let huboCambios = true;

  while (huboCambios) {
    huboCambios = false;

    for (const asigId of Array.from(aprobadasSeleccionadas)) {
      const asig = mapaAsignaturas.get(asigId);

      // Si la asignatura no existe en el plan o ya no es elegible, se desmarca
      if (!asig || !esAsignaturaElegibleFrontend(asig, aprobadasSeleccionadas)) {
        aprobadasSeleccionadas.delete(asigId);
        desmarcadas.push(asigId);
        huboCambios = true;
      }
    }
  }

  return desmarcadas;
}

/**
 * Filtra las asignaturas visibles para una página o ciclo específico.
 * REGLA FUNDAMENTAL: Las asignaturas cuyos prerrequisitos NO estén satisfechos
 * NO DEBEN APARECER en la página (no se muestran simplemente deshabilitadas, se omiten).
 */
export function filtrarAsignaturasVisiblesFrontend(
  asignaturas: AsignaturaFrontend[],
  aprobadasSeleccionadas: Set<number>,
): AsignaturaFrontend[] {
  return asignaturas.filter((asig) =>
    esAsignaturaElegibleFrontend(asig, aprobadasSeleccionadas),
  );
}
