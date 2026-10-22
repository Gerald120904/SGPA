import { TipoRequisito } from '../constants/tipo-requisito.constant';
import {
  AsignaturaRegla,
  DesmarcadoCascadaRegistro,
  DetalleRequisitoEvaluado,
  EstadoAsignaturaRegla,
  EvaluacionAsignaturaResultado,
  OpcionesEvaluacionMotor,
  PoliticaCorrequisito,
  RequisitoRegla,
  ResultadoEvaluacionMotor,
  ResumenNivelCiclo,
} from './types/motor-reglas.types';

/**
 * Motor determinista y desacoplado para la evaluación de prerrequisitos académicos.
 * Implementa resolución de grafos dirigidos acíclicos (DAG), poda en cascada,
 * validación de consistencia y cálculo reactivo de elegibilidad de asignaturas.
 */
export class MotorReglasAcademicas {
  /**
   * Evalúa el conjunto de asignaturas y requisitos de un plan académico frente
   * a la selección de asignaturas aprobadas declarada por un estudiante.
   *
   * @param asignaturas Catálogo de asignaturas registradas para el plan.
   * @param requisitos Relaciones de dependencia (requisitos y correquisitos).
   * @param aprobadasSeleccionadas Lista de IDs de asignaturas que el estudiante marca como aprobadas.
   * @param opciones Configuración de políticas de correquisito y tolerancia de inactivas.
   * @returns Resultado completo con asignaturas evaluadas, podas en cascada y resúmenes.
   */
  public static evaluar(
    asignaturas: AsignaturaRegla[],
    requisitos: RequisitoRegla[],
    aprobadasSeleccionadas: number[],
    opciones: OpcionesEvaluacionMotor = {},
  ): ResultadoEvaluacionMotor {
    const politicaCorrequisito =
      opciones.politicaCorrequisito ?? PoliticaCorrequisito.BLOQUEAR_REVISION;
    const permitirInactivas = opciones.permitirInactivas ?? false;

    // 1. Validar integridad y consistencia estructural del grafo del plan
    const { esValido: grafoValido, inconsistencias: inconsistenciasGrafo } =
      this.validarGrafo(asignaturas, requisitos);

    // 2. Mapeo indexado de asignaturas por ID
    const mapaAsignaturas = new Map<number, AsignaturaRegla>();
    for (const asig of asignaturas) {
      if (!mapaAsignaturas.has(asig.id)) {
        mapaAsignaturas.set(asig.id, asig);
      }
    }

    // 3. Mapeo indexado de requisitos por asignatura que los exige
    // asignaturaId -> RequisitoRegla[]
    const mapaRequisitosPorAsignatura = new Map<number, RequisitoRegla[]>();
    for (const req of requisitos) {
      const lista = mapaRequisitosPorAsignatura.get(req.asignaturaId) ?? [];
      lista.push(req);
      mapaRequisitosPorAsignatura.set(req.asignaturaId, lista);
    }

    // 4. Filtrar y sanear la selección inicial declarada por el estudiante:
    // - Ignorar IDs que no existen en el plan
    // - Ignorar IDs de asignaturas inactivas (a menos que se permita explícitamente)
    // - Eliminar duplicados manteniendo orden determinista
    const solicitadasOriginales = [
      ...new Set(
        aprobadasSeleccionadas.filter((id) => typeof id === 'number' && Number.isInteger(id)),
      ),
    ];

    const candidatosIniciales = new Set<number>();
    for (const id of solicitadasOriginales) {
      const asig = mapaAsignaturas.get(id);
      if (asig && (asig.activo || permitirInactivas)) {
        candidatosIniciales.add(id);
      }
    }

    // 5. Algoritmo de poda en cascada (Pruning) hacia punto fijo:
    // Una asignatura aprobada solo puede considerarse válidamente aprobada si
    // TODOS sus requisitos previos están simultáneamente en el conjunto de aprobadas válidas.
    const desmarcadasCascada: DesmarcadoCascadaRegistro[] = [];
    const conjuntoAprobadasValidas = new Set<number>(candidatosIniciales);

    let cambioEnIteracion = true;
    while (cambioEnIteracion) {
      cambioEnIteracion = false;

      // Iterar en orden canónico determinista para consistencia de resultados
      const candidatosOrdenados = [...conjuntoAprobadasValidas].sort((a, b) => {
        const asigA = mapaAsignaturas.get(a);
        const asigB = mapaAsignaturas.get(b);
        const nivelA = asigA?.nivel ?? 0;
        const nivelB = asigB?.nivel ?? 0;
        if (nivelA !== nivelB) return nivelB - nivelA; // De mayor a menor nivel
        const cicloA = asigA?.ciclo ?? 0;
        const cicloB = asigB?.ciclo ?? 0;
        if (cicloA !== cicloB) return cicloB - cicloA;
        return a - b;
      });

      for (const id of candidatosOrdenados) {
        const asig = mapaAsignaturas.get(id)!;
        const reqs = mapaRequisitosPorAsignatura.get(id) ?? [];

        let invalida = false;
        let motivoInvalidez = '';
        let requisitoFaltanteId = 0;
        let requisitoFaltanteCodigo = '';

        for (const req of reqs) {
          if (req.tipo === TipoRequisito.REQUISITO) {
            if (!conjuntoAprobadasValidas.has(req.requisitoAsignaturaId)) {
              const asigFaltante = mapaAsignaturas.get(req.requisitoAsignaturaId);
              invalida = true;
              requisitoFaltanteId = req.requisitoAsignaturaId;
              requisitoFaltanteCodigo = asigFaltante?.codigo ?? `#${req.requisitoAsignaturaId}`;
              motivoInvalidez = `La asignatura requiere haber aprobado ${requisitoFaltanteCodigo} (${asigFaltante?.nombre ?? 'No encontrada'}).`;
              break;
            }
          } else if (req.tipo === TipoRequisito.CORREQUISITO) {
            if (politicaCorrequisito === PoliticaCorrequisito.BLOQUEAR_REVISION) {
              const asigCorreq = mapaAsignaturas.get(req.requisitoAsignaturaId);
              invalida = true;
              requisitoFaltanteId = req.requisitoAsignaturaId;
              requisitoFaltanteCodigo = asigCorreq?.codigo ?? `#${req.requisitoAsignaturaId}`;
              motivoInvalidez = `La asignatura posee el correquisito ${requisitoFaltanteCodigo} pendiente de definición de regla académica por el Product Owner. Bloqueada preventivamente.`;
              break;
            } else if (politicaCorrequisito === PoliticaCorrequisito.EXIGIR_APROBADO) {
              if (!conjuntoAprobadasValidas.has(req.requisitoAsignaturaId)) {
                const asigCorreq = mapaAsignaturas.get(req.requisitoAsignaturaId);
                invalida = true;
                requisitoFaltanteId = req.requisitoAsignaturaId;
                requisitoFaltanteCodigo = asigCorreq?.codigo ?? `#${req.requisitoAsignaturaId}`;
                motivoInvalidez = `La asignatura exige haber aprobado su correquisito ${requisitoFaltanteCodigo} (${asigCorreq?.nombre ?? 'No encontrada'}).`;
                break;
              }
            }
          }
        }

        if (invalida) {
          conjuntoAprobadasValidas.delete(id);
          desmarcadasCascada.push({
            asignaturaId: id,
            codigo: asig.codigo,
            nombre: asig.nombre,
            requisitoFaltanteId,
            requisitoFaltanteCodigo,
            motivo: motivoInvalidez,
          });
          cambioEnIteracion = true;
          break; // Reiniciar ciclo de verificación tras modificar el conjunto
        }
      }
    }

    const aprobadasValidas = [...conjuntoAprobadasValidas].sort((a, b) => a - b);

    // 6. Evaluar cada asignatura del plan para determinar su estado para el estudiante
    const evaluadas: EvaluacionAsignaturaResultado[] = [];
    const mapaEvaluadas = new Map<number, EvaluacionAsignaturaResultado>();

    // Ordenar asignaturas del plan: Nivel ASC, Ciclo ASC, Orden ASC, ID ASC
    const asignaturasOrdenadas = [...asignaturas].sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      if (a.ciclo !== b.ciclo) return a.ciclo - b.ciclo;
      const ordenA = a.orden ?? 0;
      const ordenB = b.orden ?? 0;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.id - b.id;
    });

    for (const asig of asignaturasOrdenadas) {
      const estaAprobada = conjuntoAprobadasValidas.has(asig.id);
      const reqs = mapaRequisitosPorAsignatura.get(asig.id) ?? [];

      const detallesRequisitos: DetalleRequisitoEvaluado[] = [];
      const requisitosFaltantes: DetalleRequisitoEvaluado[] = [];

      let todosRequisitosCumplidos = true;
      let primerMotivoBloqueo: string | null = null;

      if (!asig.activo && !permitirInactivas) {
        const itemInactivo: EvaluacionAsignaturaResultado = {
          asignaturaId: asig.id,
          codigo: asig.codigo,
          nombre: asig.nombre,
          nivel: asig.nivel,
          ciclo: asig.ciclo,
          orden: asig.orden ?? 0,
          activo: false,
          tipo: asig.tipo,
          creditos: asig.creditos ?? 0,
          estado: 'INACTIVA',
          aprobada: false,
          requisitosTotales: 0,
          requisitosCumplidos: 0,
          detallesRequisitos: [],
          requisitosFaltantes: [],
          bloqueadaPorRequisitos: true,
          motivoBloqueo: 'La asignatura está inactiva en el plan de estudios.',
        };
        evaluadas.push(itemInactivo);
        mapaEvaluadas.set(asig.id, itemInactivo);
        continue;
      }

      for (const req of reqs) {
        const asigReq = mapaAsignaturas.get(req.requisitoAsignaturaId);
        const cumplido = conjuntoAprobadasValidas.has(req.requisitoAsignaturaId);

        const detalle: DetalleRequisitoEvaluado = {
          requisitoAsignaturaId: req.requisitoAsignaturaId,
          codigo: asigReq?.codigo,
          nombre: asigReq?.nombre,
          tipo: req.tipo,
          cumplido,
        };

        detallesRequisitos.push(detalle);

        if (req.tipo === TipoRequisito.REQUISITO) {
          if (!cumplido) {
            todosRequisitosCumplidos = false;
            const descRequisito = asigReq
              ? `${asigReq.codigo} - ${asigReq.nombre}`
              : `#${req.requisitoAsignaturaId} (No pertenece al plan)`;
            detalle.motivo = asigReq
              ? `Falta aprobar ${descRequisito}`
              : `Requisito #${req.requisitoAsignaturaId} no pertenece al plan o está inactivo`;
            requisitosFaltantes.push(detalle);

            if (!primerMotivoBloqueo) {
              primerMotivoBloqueo = asigReq
                ? `Requiere aprobación previa de ${asigReq.codigo} (${asigReq.nombre}).`
                : `Bloqueada: requiere #${req.requisitoAsignaturaId}, que no pertenece al plan o está inactiva.`;
            }
          }
        } else if (req.tipo === TipoRequisito.CORREQUISITO) {
          if (politicaCorrequisito === PoliticaCorrequisito.BLOQUEAR_REVISION) {
            todosRequisitosCumplidos = false;
            detalle.motivo = `Asignatura con correquisito ${asigReq?.codigo ?? `#${req.requisitoAsignaturaId}`} pendiente de definición de regla académica por el Product Owner.`;
            requisitosFaltantes.push(detalle);

            if (!primerMotivoBloqueo) {
              primerMotivoBloqueo = `Bloqueada preventivamente: posee el correquisito ${asigReq?.codigo ?? `#${req.requisitoAsignaturaId}`} pendiente de confirmación de política académica.`;
            }
          } else if (politicaCorrequisito === PoliticaCorrequisito.EXIGIR_APROBADO) {
            if (!cumplido) {
              todosRequisitosCumplidos = false;
              detalle.motivo = `Falta aprobar correquisito ${asigReq?.codigo ?? `#${req.requisitoAsignaturaId}`} - ${asigReq?.nombre ?? 'Desconocida'}`;
              requisitosFaltantes.push(detalle);

              if (!primerMotivoBloqueo) {
                primerMotivoBloqueo = `Requiere aprobación de correquisito ${asigReq?.codigo ?? `#${req.requisitoAsignaturaId}`} (${asigReq?.nombre ?? 'Asignatura'}).`;
              }
            }
          }
        }
      }

      const estado: EstadoAsignaturaRegla = todosRequisitosCumplidos
        ? 'HABILITADA'
        : 'BLOQUEADA';

      const evaluacion: EvaluacionAsignaturaResultado = {
        asignaturaId: asig.id,
        codigo: asig.codigo,
        nombre: asig.nombre,
        nivel: asig.nivel,
        ciclo: asig.ciclo,
        orden: asig.orden ?? 0,
        activo: asig.activo,
        tipo: asig.tipo,
        creditos: asig.creditos ?? 0,
        estado,
        aprobada: estaAprobada,
        requisitosTotales: detallesRequisitos.length,
        requisitosCumplidos: detallesRequisitos.filter((r) => r.cumplido).length,
        detallesRequisitos,
        requisitosFaltantes,
        bloqueadaPorRequisitos: !todosRequisitosCumplidos,
        motivoBloqueo: primerMotivoBloqueo,
      };

      evaluadas.push(evaluacion);
      mapaEvaluadas.set(asig.id, evaluacion);
    }

    // 7. Calcular resumen consolidado por Nivel (Año) y Ciclo
    const mapaResumen = new Map<string, ResumenNivelCiclo>();
    for (const item of evaluadas) {
      const clave = `${item.nivel}-${item.ciclo}`;
      let resumen = mapaResumen.get(clave);
      if (!resumen) {
        resumen = {
          nivel: item.nivel,
          ciclo: item.ciclo,
          totalAsignaturas: 0,
          habilitadas: 0,
          aprobadas: 0,
          bloqueadas: 0,
          inactivas: 0,
        };
        mapaResumen.set(clave, resumen);
      }

      resumen.totalAsignaturas++;
      if (item.estado === 'HABILITADA') resumen.habilitadas++;
      if (item.estado === 'BLOQUEADA') resumen.bloqueadas++;
      if (item.estado === 'INACTIVA') resumen.inactivas++;
      if (item.aprobada) resumen.aprobadas++;
    }

    const resumenPorNivelCiclo = [...mapaResumen.values()].sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      return a.ciclo - b.ciclo;
    });

    return {
      esValido: grafoValido && inconsistenciasGrafo.length === 0,
      inconsistenciasGrafo,
      solicitadasOriginales,
      aprobadasValidas,
      desmarcadasCascada,
      asignaturas: evaluadas,
      mapaAsignaturas: mapaEvaluadas,
      resumenPorNivelCiclo,
    };
  }

  /**
   * Valida la consistencia estructural del grafo del plan:
   * - Ausencia de referencias a asignaturas inexistentes o ajenas.
   * - Ausencia de bucles autorreferenciales (A -> A).
   * - Ausencia de ciclos entre requisitos (A -> B -> A).
   * - Coherencia en pertenencia de plan.
   */
  public static validarGrafo(
    asignaturas: AsignaturaRegla[],
    requisitos: RequisitoRegla[],
  ): { esValido: boolean; inconsistencias: string[] } {
    const inconsistencias: string[] = [];

    const idsAsignaturas = new Set<number>();
    const planEstudioIds = new Set<number>();

    for (const asig of asignaturas) {
      if (idsAsignaturas.has(asig.id)) {
        inconsistencias.push(`El catálogo del plan contiene la asignatura duplicada ID #${asig.id}.`);
      }
      idsAsignaturas.add(asig.id);
      planEstudioIds.add(asig.planEstudioId);
    }

    if (planEstudioIds.size > 1) {
      inconsistencias.push(
        `Se detectaron asignaturas de múltiples planes de estudio distintos (${[...planEstudioIds].join(', ')}).`,
      );
    }

    const mapaAsignaturas = new Map(asignaturas.map((a) => [a.id, a]));

    // Grafo dirigido de requisitos para detección de ciclos: A -> B significa "A requiere a B"
    const grafo = new Map<number, Set<number>>();
    for (const id of idsAsignaturas) {
      grafo.set(id, new Set<number>());
    }

    for (const req of requisitos) {
      // 1. Validar existencia de ambos extremos
      if (!idsAsignaturas.has(req.asignaturaId)) {
        inconsistencias.push(
          `La relación académica hace referencia a la asignatura #${req.asignaturaId} que no existe en el plan.`,
        );
        continue;
      }

      if (!idsAsignaturas.has(req.requisitoAsignaturaId)) {
        inconsistencias.push(
          `La relación académica de la asignatura #${req.asignaturaId} exige como requisito la asignatura #${req.requisitoAsignaturaId} que no existe en el plan.`,
        );
        continue;
      }

      const asigReq = mapaAsignaturas.get(req.requisitoAsignaturaId);
      if (asigReq && !asigReq.activo) {
        inconsistencias.push(
          `La relación académica de la asignatura #${req.asignaturaId} exige como requisito la asignatura #${req.requisitoAsignaturaId} (${asigReq.codigo}) que se encuentra inactiva en el plan.`,
        );
      }

      // 2. Validar autorreferencia
      if (req.asignaturaId === req.requisitoAsignaturaId) {
        inconsistencias.push(
          `La asignatura #${req.asignaturaId} no puede ser requisito de sí misma.`,
        );
        continue;
      }

      // 3. Registrar arista para análisis de ciclos si es de tipo REQUISITO
      if (req.tipo === TipoRequisito.REQUISITO) {
        grafo.get(req.asignaturaId)!.add(req.requisitoAsignaturaId);
      }
    }

    // 4. Detección de ciclos mediante DFS
    const visitados = new Set<number>();
    const enRecursion = new Set<number>();
    let cicloDetectado: number[] | null = null;

    const dfs = (nodo: number, camino: number[]): boolean => {
      visitados.add(nodo);
      enRecursion.add(nodo);
      camino.push(nodo);

      const vecinos = grafo.get(nodo) ?? new Set<number>();
      for (const vecino of vecinos) {
        if (!visitados.has(vecino)) {
          if (dfs(vecino, camino)) return true;
        } else if (enRecursion.has(vecino)) {
          const idx = camino.indexOf(vecino);
          cicloDetectado = [...camino.slice(idx), vecino];
          return true;
        }
      }

      enRecursion.delete(nodo);
      camino.pop();
      return false;
    };

    for (const id of idsAsignaturas) {
      if (!visitados.has(id)) {
        if (dfs(id, [])) {
          inconsistencias.push(
            `El plan de estudios contiene un ciclo entre requisitos académicos: ${cicloDetectado!.join(' -> ')}.`,
          );
          break;
        }
      }
    }

    return {
      esValido: inconsistencias.length === 0,
      inconsistencias,
    };
  }
}
