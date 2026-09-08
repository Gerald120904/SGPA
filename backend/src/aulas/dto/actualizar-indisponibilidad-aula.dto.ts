import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoIndisponibilidadAula } from '../constants/tipo-indisponibilidad-aula.constant';

export class ActualizarIndisponibilidadAulaDto {
  @IsOptional()
  @IsEnum(TipoIndisponibilidadAula)
  tipo?: TipoIndisponibilidadAula;

  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo?: string;
}
