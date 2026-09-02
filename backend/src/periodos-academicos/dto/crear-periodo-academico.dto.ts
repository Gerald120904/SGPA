import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearPeriodoAcademicoDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  anio!: number;

  @IsInt()
  @Min(1)
  @Max(2)
  ciclo!: number;

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsDateString()
  fechaLimiteDisponibilidad!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
