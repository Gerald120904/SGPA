import { CondicionAcademica } from '../constants/condicion-academica.constant';
import { DictamenGraduacion } from '../constants/dictamen-graduacion.constant';
import { EstadoEstudiante } from '../constants/estado-estudiante.constant';

export interface AsignaturaEvaluadaResumen {
  id: number;
  codigo: string;
  nombre: string;
  nivel: number;
  ciclo: number;
  creditos: number;
  tipo?: string;
  tipoOptativa?: string | null;
  aprobada: boolean;
  origen?: string;
  periodoNombre?: string;
}

export interface CategoriaOptativaEvaluada {
  requeridas: number;
  aprobadas: number;
  cumplidas: boolean;
  asignaturas: AsignaturaEvaluadaResumen[];
}

export interface ResumenOptativasEvaluacion {
  reglaDefinida: boolean;
  disciplinarias: CategoriaOptativaEvaluada;
  abiertas: CategoriaOptativaEvaluada;
  sede: CategoriaOptativaEvaluada;
  cumpleDistribucion: boolean;
}

export interface ResumenCreditosEvaluacion {
  requeridosTotal: number;
  obligatoriosRequeridos: number;
  aprobadosTotal: number;
  obligatoriosAprobados: number;
  optativosAprobados: number;
  reconocidosEquivalencias: number;
  cumpleCreditos: boolean;
}

export interface ResultadoEvaluacionGraduacion {
  dictamen: DictamenGraduacion;
  condicionAcademica: CondicionAcademica;
  estudiante: {
    id: number;
    cedula: string;
    nombreCompleto: string;
    correoInstitucional: string;
    carreraId: number;
    planEstudioId: number;
    estadoAdministrativo: EstadoEstudiante;
    fechaGraduacion?: Date | null;
    graduadoPor?: {
      id: number;
      nombreCompleto: string;
    } | null;
    observacionGraduacion?: string | null;
  };
  carrera: {
    id: number;
    codigo: string;
    nombre: string;
  };
  planEstudio: {
    id: number;
    codigo: string;
    nombre: string;
    activo: boolean;
  };
  obligatorias: {
    total: number;
    aprobadasCount: number;
    pendientesCount: number;
    cumplidas: AsignaturaEvaluadaResumen[];
    pendientes: AsignaturaEvaluadaResumen[];
  };
  optativas: ResumenOptativasEvaluacion;
  creditos: ResumenCreditosEvaluacion;
  equivalenciasReconocidas: Array<{
    id: number;
    codigo: string;
    nombre: string;
    creditos: number;
    observaciones: string | null;
  }>;
  motivosBloqueo: string[];
  cumpleTodosLosRequisitos: boolean;
}

