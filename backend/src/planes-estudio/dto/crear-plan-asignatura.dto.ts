import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoPlanAsignatura } from '../constants/tipo-plan-asignatura.constant';

export class CrearPlanAsignaturaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cursoId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bloqueId?: number;

  @IsInt()
  @Min(1)
  @Max(20)
  nivel!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  ciclo!: number;

  @IsInt()
  @Min(1)
  @Max(999)
  orden!: number;

  @IsInt()
  @Min(0)
  @Max(30)
  creditos!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasTeoria?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasPractica?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasLaboratorio?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasGira?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasEstudioIndependiente?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasTotales?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasDocente?: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacionHoras?: string;

  @IsEnum(TipoPlanAsignatura)
  tipo!: TipoPlanAsignatura;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  codigoReferencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreReferencia?: string;
}
