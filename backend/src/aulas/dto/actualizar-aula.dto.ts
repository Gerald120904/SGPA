import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { OrigenAula } from '../constants/origen-aula.constant';
import { TipoAula } from '../constants/tipo-aula.constant';
import { TipoMobiliarioAula } from '../constants/tipo-mobiliario-aula.constant';

export class ActualizarAulaDto {
  @IsOptional()
  @IsBoolean()
  confirmarReduccionCapacidad?: boolean;
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ubicacion?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  capacidad?: number;

  @IsOptional()
  @IsEnum(TipoAula)
  tipo?: TipoAula;

  @IsOptional()
  @IsEnum(TipoMobiliarioAula)
  tipoMobiliario?: TipoMobiliarioAula;

  @IsOptional()
  @IsEnum(OrigenAula)
  origen?: OrigenAula;
}
