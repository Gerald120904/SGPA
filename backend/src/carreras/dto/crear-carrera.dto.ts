import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GradoAcademico } from '../constants/grado-academico.constant';

export class CrearCarreraDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;

  @IsEnum(GradoAcademico)
  grado!: GradoAcademico;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
