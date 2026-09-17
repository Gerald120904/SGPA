import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class ActualizarEstudianteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/\S/, { message: 'La cédula no puede contener solo espacios.' })
  cedula?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'Los nombres no pueden contener solo espacios.' })
  nombres?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El primer apellido no puede contener solo espacios.',
  })
  apellido1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido2?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  correoInstitucional?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;
}
