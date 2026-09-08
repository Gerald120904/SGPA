import { IsInt, Matches, Max, Min } from 'class-validator';

export class CrearDisponibilidadAulaDto {
  @IsInt()
  @Min(1)
  periodoId!: number;

  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaInicio debe tener formato HH:mm.',
  })
  horaInicio!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaFin debe tener formato HH:mm.',
  })
  horaFin!: string;
}
