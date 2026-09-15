export interface ResultadoProcesamientoFormulario {
  candidatas: number;
  procesadas: number;
  omitidasYaProcesadas: number;

  requierenRevision: number;
  errores: number;

  estudiantesCreados: number;
  estudiantesActualizados: number;
  aprobacionesNuevas: number;
}
