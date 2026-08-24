import { IsBoolean } from 'class-validator';

export class CambiarEstadoCarreraDto {
  @IsBoolean()
  activo!: boolean;
}
