import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GradoAcademico } from '../../carreras/constants/grado-academico.constant';

export class ActualizarPlanEstudioDto {
  @IsOptional()
  @IsEnum(GradoAcademico)
  grado?: GradoAcademico;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
