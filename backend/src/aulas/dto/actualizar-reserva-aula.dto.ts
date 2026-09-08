import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoReservaAula } from '../constants/tipo-reserva-aula.constant';

export class ActualizarReservaAulaDto {
  @IsOptional()
  @IsEnum(TipoReservaAula)
  tipo?: TipoReservaAula;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;
}
