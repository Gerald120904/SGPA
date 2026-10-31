import { IsInt, IsPositive } from 'class-validator';

export class ReasignarSolicitudDto {
  @IsInt()
  @IsPositive()
  nuevoCoordinadorId!: number;
}
