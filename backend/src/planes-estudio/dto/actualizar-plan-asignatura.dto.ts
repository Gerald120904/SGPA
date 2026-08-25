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

export class ActualizarPlanAsignaturaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  bloqueId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  nivel?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  ciclo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(999)
  orden?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditos?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasTeoria?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasPractica?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasLaboratorio?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasGira?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasEstudioIndependiente?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasTotales?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999)
  horasDocente?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  observacionHoras?: string | null;

  @IsOptional()
  @IsEnum(TipoPlanAsignatura)
  tipo?: TipoPlanAsignatura;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  codigoReferencia?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombreReferencia?: string | null;
}
