export enum TipoIndisponibilidadAula {
  MANTENIMIENTO = 'MANTENIMIENTO',
  REPARACION = 'REPARACION',
  LIMPIEZA = 'LIMPIEZA',
  BLOQUEO = 'BLOQUEO',
  OTRO = 'OTRO',
}

export const TIPOS_INDISPONIBILIDAD_AULA = Object.values(
  TipoIndisponibilidadAula,
);
