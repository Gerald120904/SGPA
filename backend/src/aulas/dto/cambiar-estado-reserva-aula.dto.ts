import { IsBoolean } from 'class-validator';

export class CambiarEstadoReservaAulaDto {
  @IsBoolean()
  activo!: boolean;
}
