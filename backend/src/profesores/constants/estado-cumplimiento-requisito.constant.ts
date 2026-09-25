export enum EstadoCumplimientoRequisito {
  PENDIENTE = 'PENDIENTE',
  CUMPLE = 'CUMPLE',
  NO_CUMPLE = 'NO_CUMPLE',
  NO_APLICA = 'NO_APLICA',
}

export const ESTADOS_CUMPLIMIENTO_REQUISITO = Object.values(
  EstadoCumplimientoRequisito,
);
