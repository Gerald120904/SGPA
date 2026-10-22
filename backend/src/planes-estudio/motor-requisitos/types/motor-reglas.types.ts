import { TipoRequisito } from '../../constants/tipo-requisito.constant';

/**
 * Representación simplificada de una asignatura dentro del motor de reglas.
 */
export interface AsignaturaRegla {
  id: number;
  planEstudioId: number;
  cursoId?: number | null;
  codigo: string;
  nombre: string;
  nivel: number;
  ciclo: number;
  orden?: number;
  activo: boolean;
  tipo?: string;
  creditos?: number;
}

/**
 * Representación simplificada de un requisito dentro del motor de reglas.
 */
export interface RequisitoRegla {
  id?: number;
  asignaturaId: number;
  requisitoAsignaturaId: number;
  tipo: TipoRequisito;
}

/**
 * Estados posibles de una asignatura calculados por el motor.
 */
export type EstadoAsignaturaRegla =
  | 'HABILITADA'
  | 'BLOQUEADA'
  | 'INACTIVA'
  | 'INCONSISTENTE';

/**
 * Política para el tratamiento de correquisitos en asignaturas ya aprobadas.
 */
export enum PoliticaCorrequisito {
  /**
   * Comportamiento seguro por defecto: Bloquea automáticamente la validación
   * de asignaturas que tienen correquisitos registrados, requiriendo revisión
   * y evitando aplicar reglas académicas no confirmadas por el Product Owner.
   */
  BLOQUEAR_REVISION = 'BLOQUEAR_REVISION',

  /**
   * Exige que el correquisito esté en el conjunto de aprobadas para considerar la asignatura válida.
   */
  EXIGIR_APROBADO = 'EXIGIR_APROBADO',

  /**
   * Trata el correquisito como informativo; no bloquea la condición de aprobado histórico.
   */
  INFORMATIVO = 'INFORMATIVO',
}

/**
 * Detalle individual de un requisito asociado a una asignatura.
 */
export interface DetalleRequisitoEvaluado {
  requisitoAsignaturaId: number;
  codigo?: string;
  nombre?: string;
  tipo: TipoRequisito;
  cumplido: boolean;
  motivo?: string;
}

/**
 * Evaluación completa del estado de una asignatura para un estudiante.
 */
export interface EvaluacionAsignaturaResultado {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  nivel: number;
  ciclo: number;
  orden: number;
  activo: boolean;
  tipo?: string;
  creditos: number;
  estado: EstadoAsignaturaRegla;
  aprobada: boolean;
  requisitosTotales: number;
  requisitosCumplidos: number;
  detallesRequisitos: DetalleRequisitoEvaluado[];
  requisitosFaltantes: DetalleRequisitoEvaluado[];
  bloqueadaPorRequisitos: boolean;
  motivoBloqueo: string | null;
}

/**
 * Registro de una asignatura invalidada automáticamente en cascada.
 */
export interface DesmarcadoCascadaRegistro {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  requisitoFaltanteId: number;
  requisitoFaltanteCodigo?: string;
  motivo: string;
}

/**
 * Resumen consolidado por nivel (año) y ciclo.
 */
export interface ResumenNivelCiclo {
  nivel: number;
  ciclo: number;
  totalAsignaturas: number;
  habilitadas: number;
  aprobadas: number;
  bloqueadas: number;
  inactivas: number;
}

/**
 * Opciones para la ejecución de la evaluación.
 */
export interface OpcionesEvaluacionMotor {
  politicaCorrequisito?: PoliticaCorrequisito;
  permitirInactivas?: boolean;
}

/**
 * Resultado completo entregado por el motor de reglas académicas.
 */
export interface ResultadoEvaluacionMotor {
  esValido: boolean;
  inconsistenciasGrafo: string[];
  solicitadasOriginales: number[];
  aprobadasValidas: number[];
  desmarcadasCascada: DesmarcadoCascadaRegistro[];
  asignaturas: EvaluacionAsignaturaResultado[];
  mapaAsignaturas: Map<number, EvaluacionAsignaturaResultado>;
  resumenPorNivelCiclo: ResumenNivelCiclo[];
}
