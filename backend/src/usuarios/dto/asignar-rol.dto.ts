import { IsEnum } from 'class-validator';
import { RolSistema } from '../../auth/constants/roles.constants';

export class AsignarRolDto {
  @IsEnum(RolSistema)
  rol!: RolSistema;
}
