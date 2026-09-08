import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class ActualizarAsignacionAcademicaDto {
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
