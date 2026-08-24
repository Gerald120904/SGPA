import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RolSistema } from '../../auth/constants/roles.constants';

export class CrearUsuarioDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  cedula!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombres!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apellido1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido2?: string;

  @IsEmail()
  @MaxLength(150)
  correo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(RolSistema, {
    each: true,
  })
  roles!: RolSistema[];
}
