import { IsBoolean } from 'class-validator';

export class CambiarEstadoPlanEstudioDto {
  @IsBoolean()
  activo!: boolean;
}
