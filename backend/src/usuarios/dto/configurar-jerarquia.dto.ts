import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'La cédula debe ser una cadena de texto.' })
  @Matches(/^\d{1,9}$/, {
    message: 'La cédula debe contener solo números (máximo 9 dígitos, sin guiones).',
  })
  cedula!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Los nombres deben ser una cadena de texto.' })
  @IsNotEmpty({ message: 'Los nombres son obligatorios.' })
  @MaxLength(60, { message: 'Los nombres no pueden superar 60 caracteres.' })
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message: 'Los nombres solo pueden contener letras, espacios, guiones y apóstrofes.',
  })
  nombres!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El primer apellido debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El primer apellido es obligatorio.' })
  @MaxLength(50, { message: 'El primer apellido no puede superar 50 caracteres.' })
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message: 'El primer apellido solo puede contener letras, espacios, guiones y apóstrofes.',
  })
  apellido1!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? (value.trim() || undefined) : value,
  )
  @IsString({ message: 'El segundo apellido debe ser una cadena de texto.' })
  @MaxLength(50, { message: 'El segundo apellido no puede superar 50 caracteres.' })
  @Matches(/^[\p{L}\p{M}\s'-]+$/u, {
    message: 'El segundo apellido solo puede contener letras, espacios, guiones y apóstrofes.',
  })
  apellido2?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido (por ejemplo: nombre@dominio.com).' })
  @MaxLength(150, { message: 'El correo electrónico no puede superar 150 caracteres.' })
  correo!: string;
}
