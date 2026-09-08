import { IsDateString } from 'class-validator';

export class ConsultarOcupacionAulaDto {
  @IsDateString()
  fechaHoraInicio!: string;

  @IsDateString()
  fechaHoraFin!: string;
}
