import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { OrigenAula } from '../constants/origen-aula.constant';
import { TipoAula } from '../constants/tipo-aula.constant';
import { TipoMobiliarioAula } from '../constants/tipo-mobiliario-aula.constant';

export class FiltrarAulasDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(TipoAula)
  tipo?: TipoAula;

  @IsOptional()
  @IsEnum(TipoMobiliarioAula)
  tipoMobiliario?: TipoMobiliarioAula;

  @IsOptional()
  @IsEnum(OrigenAula)
  origen?: OrigenAula;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacidadMinima?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  texto?: string;
}
