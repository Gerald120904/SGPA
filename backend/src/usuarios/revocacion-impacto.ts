import { createHash } from 'node:crypto';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { SolicitudCambio } from './entities/solicitud-cambio.entity';

export const ESTADOS_ABIERTOS_SOLICITUD = [
  'PENDIENTE', 'CORREGIDA', 'DEVUELTA_PARA_CORRECCION',
] as const;

export function permisoDeSolicitud(modulo: string): PermisoSistema | null {
  switch (modulo) {
    case 'ESTUDIANTES': return PermisoSistema.ESTUDIANTES_GESTIONAR;
    case 'CURSOS': return PermisoSistema.CURSOS_GESTIONAR;
    case 'PLANES_ESTUDIO': return PermisoSistema.PLANES_ESTUDIO_GESTIONAR;
    case 'OPTATIVAS': return PermisoSistema.OPTATIVAS_GESTIONAR;
    default: return null;
  }
}

export function carrerasDeSolicitud(solicitud: SolicitudCambio): number[] {
  const ids = [solicitud.carreraId];
  const datos = solicitud.datosPropuestos ?? {};
  if (solicitud.modulo === 'CURSOS' && Array.isArray(datos.carrerasAfectadas)) {
    ids.push(...datos.carrerasAfectadas.map(Number));
  }
  if (solicitud.modulo === 'ESTUDIANTES' && solicitud.operacion === 'CAMBIAR_PLAN') {
    ids.push(Number(datos.carreraDestinoId));
  }
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

export function solicitudAfectada(solicitud: SolicitudCambio, revocados: Set<string>): boolean {
  const permiso = permisoDeSolicitud(solicitud.modulo);
  return !!permiso && carrerasDeSolicitud(solicitud).some((id) => revocados.has(`${id}:${permiso}`));
}

export function firmaImpacto(datos: unknown): string {
  return createHash('sha256').update(JSON.stringify(datos)).digest('hex');
}
