import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EstudianteImportacionFilaDto {
  @IsInt()
  @Min(2)
  fila!: number;

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

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/\S/, {
    message:
      'El código del período de ingreso no puede contener solo espacios.',
  })
  periodoIngresoCodigo!: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  asignaturasAprobadas!: string[];
}

export class ImportarEstudiantesDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsInt()
  @Min(1)
  planEstudioId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => EstudianteImportacionFilaDto)
  estudiantes!: EstudianteImportacionFilaDto[];
}
