import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ActualizarDisponibilidadAulaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  diaSemana?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaInicio debe tener formato HH:mm.',
  })
  horaInicio?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'horaFin debe tener formato HH:mm.',
  })
  horaFin?: string;
}
