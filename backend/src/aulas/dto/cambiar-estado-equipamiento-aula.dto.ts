import { IsBoolean } from 'class-validator';

export class CambiarEstadoEquipamientoAulaDto {
  @IsBoolean()
  activo!: boolean;
}
