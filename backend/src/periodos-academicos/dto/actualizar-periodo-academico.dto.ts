import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ActualizarPeriodoAcademicoDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  ciclo?: number;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsDateString()
  fechaLimiteDisponibilidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}
