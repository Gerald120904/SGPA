import { IsEnum, Matches } from 'class-validator';
import { DiaSemana } from '../constants/dia-semana.constant';

export class BloqueDisponibilidadDto {
  @IsEnum(DiaSemana)
  dia!: DiaSemana;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaInicio debe tener formato HH:mm.',
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaFin debe tener formato HH:mm.',
  })
  horaFin!: string;
}
