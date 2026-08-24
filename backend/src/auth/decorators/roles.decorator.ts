import { SetMetadata } from '@nestjs/common';
import { RolSistema } from '../constants/roles.constants';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: RolSistema[]) =>
  SetMetadata(ROLES_KEY, roles);
