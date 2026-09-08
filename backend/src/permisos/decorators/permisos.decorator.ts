import { SetMetadata } from '@nestjs/common';
import { PermisoSistema } from '../constants/permisos.constant';

export const PERMISOS_KEY = 'permisos_sistema';

export const Permisos = (...permisos: PermisoSistema[]) =>
  SetMetadata(PERMISOS_KEY, permisos);
