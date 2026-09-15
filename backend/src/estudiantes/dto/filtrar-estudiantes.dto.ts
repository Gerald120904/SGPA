import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EstadoEstudiante } from '../constants/estado-estudiante.constant';

export class FiltrarEstudiantesDto {
  @IsOptional()
  @IsString()
  texto?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planEstudioId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodoIngresoId?: number;

  @IsOptional()
  @IsEnum(EstadoEstudiante)
  estado?: EstadoEstudiante;
}
