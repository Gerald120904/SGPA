import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoBloquePlan } from '../constants/tipo-bloque-plan.constant';

export class CrearBloquePlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;

  @IsEnum(TipoBloquePlan)
  tipo!: TipoBloquePlan;

  @IsInt()
  @Min(1)
  @Max(999)
  orden!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
