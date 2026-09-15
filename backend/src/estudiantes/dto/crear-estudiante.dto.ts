import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CrearEstudianteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Matches(/\S/, { message: 'La cédula no puede contener solo espacios.' })
  cedula!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, { message: 'Los nombres no pueden contener solo espacios.' })
  nombres!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El primer apellido no puede contener solo espacios.',
  })
  apellido1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido2?: string | null;

  @IsEmail()
  @MaxLength(150)
  correoInstitucional!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string | null;

  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsInt()
  @Min(1)
  planEstudioId!: number;

  @IsInt()
  @Min(1)
  periodoIngresoId!: number;
}
