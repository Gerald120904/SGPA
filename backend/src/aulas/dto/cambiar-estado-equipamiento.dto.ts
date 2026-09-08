import { IsBoolean } from 'class-validator';

export class CambiarEstadoEquipamientoDto {
  @IsBoolean()
  activo!: boolean;
}
