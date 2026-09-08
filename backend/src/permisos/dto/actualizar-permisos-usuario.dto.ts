import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { PermisoSistema } from '../constants/permisos.constant';

export class ActualizarPermisosUsuarioDto {
  @IsArray()
  @ArrayUnique()
  @IsEnum(PermisoSistema, { each: true })
  permisos!: PermisoSistema[];
}
