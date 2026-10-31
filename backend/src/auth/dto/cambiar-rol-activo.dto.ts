import { IsEnum, IsNotEmpty } from 'class-validator';
import { RolSistema, ROLES_SISTEMA } from '../constants/roles.constants';

export class CambiarRolActivoDto {
  @IsNotEmpty({ message: 'El rol es obligatorio.' })
  @IsEnum(RolSistema, {
    message: `El rol debe ser uno de los roles válidos: ${ROLES_SISTEMA.join(', ')}`,
  })
  rol!: RolSistema;
}
