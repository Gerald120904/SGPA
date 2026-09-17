export interface ResultadoSincronizacionFormulario {
  recibidasGoogle: number;
  nuevas: number;
  ignoradasExistentes: number;
  pendientes: number;
  requierenRevision: number;
  errores: number;
}
