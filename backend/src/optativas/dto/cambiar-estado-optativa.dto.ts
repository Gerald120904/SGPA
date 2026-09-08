import { IsBoolean } from 'class-validator';

export class CambiarEstadoOptativaDto {
  @IsBoolean()
  activo!: boolean;
}
