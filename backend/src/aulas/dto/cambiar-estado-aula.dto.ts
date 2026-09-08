import { IsBoolean } from 'class-validator';

export class CambiarEstadoAulaDto {
  @IsBoolean()
  activo!: boolean;
}
