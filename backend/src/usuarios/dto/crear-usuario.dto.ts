import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { RolSistema } from '../../auth/constants/roles.constants';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';

export class CrearUsuarioDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'La cédula solo debe contener números, letras o guiones.',
  })
  cedula!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, {
    message: 'Los nombres solo deben contener letras y espacios válidos.',
  })
  nombres!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, {
    message: 'El primer apellido solo debe contener letras.',
  })
  apellido1!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim() || undefined) : value,
  )
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/, {
    message: 'El segundo apellido solo debe contener letras.',
  })
  apellido2?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  correo!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(RolSistema, {
    each: true,
  })
  roles!: RolSistema[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(PermisoSistema, {
    each: true,
  })
  permisos?: PermisoSistema[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({
    each: true,
  })
  @Min(1, {
    each: true,
  })
  carreraIds?: number[];
}
