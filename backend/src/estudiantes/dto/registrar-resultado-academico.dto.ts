import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OrigenAcademico } from '../constants/origen-academico.constant';
import { ResultadoAcademico } from '../constants/resultado-academico.constant';

export class RegistrarResultadoAcademicoDto {
  @IsInt()
  @Min(1)
  planAsignaturaId!: number;

  @IsInt()
  @Min(1)
  periodoId!: number;

  @IsEnum(ResultadoAcademico)
  resultado!: ResultadoAcademico;

  @IsEnum(OrigenAcademico)
  origenAcademico!: OrigenAcademico;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string | null;
}
