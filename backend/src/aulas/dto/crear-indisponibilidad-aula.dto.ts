import {
  IsDateString,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoIndisponibilidadAula } from '../constants/tipo-indisponibilidad-aula.constant';

export class CrearIndisponibilidadAulaDto {
  @IsEnum(TipoIndisponibilidadAula)
  tipo!: TipoIndisponibilidadAula;

  @IsDateString()
  fechaHoraInicio!: string;

  @IsDateString()
  fechaHoraFin!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;
}
