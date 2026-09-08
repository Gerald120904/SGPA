import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GradoAcademico } from '../../carreras/constants/grado-academico.constant';

export class CrearPlanEstudioDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsEnum(GradoAcademico)
  grado!: GradoAcademico;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
