import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoReservaAula } from '../constants/tipo-reserva-aula.constant';

export class CrearReservaAulaDto {
  @IsEnum(TipoReservaAula)
  tipo!: TipoReservaAula;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsDateString()
  fechaHoraInicio!: string;

  @IsDateString()
  fechaHoraFin!: string;
}
