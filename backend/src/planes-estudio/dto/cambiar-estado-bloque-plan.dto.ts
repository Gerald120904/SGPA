import { IsBoolean } from 'class-validator';

export class CambiarEstadoBloquePlanDto {
  @IsBoolean()
  activo!: boolean;
}
