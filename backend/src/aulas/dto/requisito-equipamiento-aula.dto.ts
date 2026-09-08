import { IsInt, Min } from 'class-validator';

export class RequisitoEquipamientoAulaDto {
  @IsInt()
  @Min(1)
  equipamientoId!: number;

  @IsInt()
  @Min(1)
  cantidadMinima!: number;
}
