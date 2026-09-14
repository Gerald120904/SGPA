import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TipoOptativa } from '../../optativas/constants/tipo-optativa.constant';
import { TipoPlanAsignatura } from '../constants/tipo-plan-asignatura.constant';

export class CrearPlanAsignaturaDto {
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

  @ValidateIf((dto: CrearPlanAsignaturaDto) =>
    dto.tipo === TipoPlanAsignatura.OPTATIVA,
  )
  @IsEnum(TipoOptativa)
  tipoOptativa?: TipoOptativa;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigoReferencia!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombreReferencia!: string;
}
