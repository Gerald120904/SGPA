import { IsBoolean } from 'class-validator';

export class CambiarEstadoIndisponibilidadAulaDto {
  @IsBoolean()
  activo!: boolean;
}
