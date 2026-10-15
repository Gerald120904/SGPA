import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  cedula?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apellido1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido2?: string | null;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(150)
  correo?: string;

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
