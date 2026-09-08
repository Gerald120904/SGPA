import { IsDateString, IsOptional } from 'class-validator';

export class InactivarAsignacionAcademicaDto {
  @IsOptional()
  @IsDateString()
  fechaFin?: string;
}
