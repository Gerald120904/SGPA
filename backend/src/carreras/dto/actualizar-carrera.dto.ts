import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GradoAcademico } from '../constants/grado-academico.constant';

export class ActualizarCarreraDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsEnum(GradoAcademico)
  grado?: GradoAcademico;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
