import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TipoAsignacionAcademica } from '../constants/tipo-asignacion-academica.constant';

export class CrearAsignacionAcademicaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usuarioId!: number;

  @IsEnum(TipoAsignacionAcademica)
  tipo!: TipoAsignacionAcademica;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaAcademicaId?: number;

  @IsDateString()
  fechaInicio!: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
