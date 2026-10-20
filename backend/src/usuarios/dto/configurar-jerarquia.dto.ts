import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';

export class AlcanceCarreraDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsArray()
  @ArrayUnique()
  @IsEnum(PermisoSistema, { each: true })
  permisos!: PermisoSistema[];
}

export class ConfigurarJerarquiaDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlcanceCarreraDto)
  carreras!: AlcanceCarreraDto[];
}

export class CrearAsistenteJerarquicoDto extends ConfigurarJerarquiaDto {
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
}
