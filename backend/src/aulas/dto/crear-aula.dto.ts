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
import { OrigenAula } from '../constants/origen-aula.constant';
import { TipoAula } from '../constants/tipo-aula.constant';
import { TipoMobiliarioAula } from '../constants/tipo-mobiliario-aula.constant';

export class CrearAulaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  ubicacion?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  capacidad!: number;

  @IsEnum(TipoAula)
  tipo!: TipoAula;

  @IsEnum(TipoMobiliarioAula)
  tipoMobiliario!: TipoMobiliarioAula;

  @IsEnum(OrigenAula)
  origen!: OrigenAula;
}
