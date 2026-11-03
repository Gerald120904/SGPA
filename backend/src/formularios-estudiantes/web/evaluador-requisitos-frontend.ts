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
export interface OpcionesEvaluacionFrontend {
  politicaCorrequisito?: 'INFORMATIVO' | 'BLOQUEAR_REVISION';
}

export interface AdvertenciaCorrequisitoFrontend {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  correquisitoId: number;
  correquisitoCodigo?: string;
  correquisitoNombre?: string;
  mensaje: string;
}

export function esAsignaturaElegibleFrontend(
  asignatura: AsignaturaFrontend,
  aprobadasSeleccionadas: Set<number>,
  opciones?: OpcionesEvaluacionFrontend,
): boolean {
  if (asignatura.activo === false || asignatura.estado === 'INACTIVA' || asignatura.estado === 'INCONSISTENTE') {
    return false;
  }

  const requisitos = asignatura.detallesRequisitos || [];

  if (requisitos.length === 0) {
    return true;
  }

  const politica = opciones?.politicaCorrequisito ?? 'INFORMATIVO';

  for (const req of requisitos) {
    // Solo bloquea si la política es explícitamente BLOQUEAR_REVISION.
    // Bajo la política oficial INFORMATIVO de SGPA, los correquisitos no bloquean la declaración retrospectiva de materias ya aprobadas.
    if (req.tipo === 'CORREQUISITO' && politica === 'BLOQUEAR_REVISION') {
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
 * Detecta advertencias no bloqueantes de correquisitos:
 * Si una materia marcada como aprobada exige un correquisito que no fue seleccionado,
 * genera la advertencia correspondiente para orientación del estudiante y decisión del coordinador.
 */
export function detectarAdvertenciasCorrequisitosFrontend(
  asignaturas: AsignaturaFrontend[],
  aprobadasSeleccionadas: Set<number>,
): AdvertenciaCorrequisitoFrontend[] {
  const mapaAsignaturas = new Map<number, AsignaturaFrontend>();
  for (const asig of asignaturas) {
    mapaAsignaturas.set(asig.asignaturaId, asig);
  }

  const advertencias: AdvertenciaCorrequisitoFrontend[] = [];

  for (const asigId of Array.from(aprobadasSeleccionadas)) {
    const asig = mapaAsignaturas.get(asigId);
    if (!asig) continue;

    const requisitos = asig.detallesRequisitos || [];
    for (const req of requisitos) {
      if (req.tipo === 'CORREQUISITO' && !aprobadasSeleccionadas.has(req.requisitoAsignaturaId)) {
        const correq = mapaAsignaturas.get(req.requisitoAsignaturaId);
        const correquisitoCodigo = correq?.codigo || req.codigo || `#${req.requisitoAsignaturaId}`;
        const correquisitoNombre = correq?.nombre || req.nombre || 'Asignatura correquisito';

        advertencias.push({
          asignaturaId: asig.asignaturaId,
          codigo: asig.codigo,
          nombre: asig.nombre,
          correquisitoId: req.requisitoAsignaturaId,
          correquisitoCodigo,
          correquisitoNombre,
          mensaje: `Advertencia: Has seleccionado ${asig.codigo} (${asig.nombre}), que tiene como correquisito ${correquisitoCodigo} (${correquisitoNombre}). Si aprobaste ambas, asegúrate de marcar también ${correquisitoCodigo}. Si sólo aprobaste una, puedes continuar.`,
        });
      }
    }
  }

  return advertencias;
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
