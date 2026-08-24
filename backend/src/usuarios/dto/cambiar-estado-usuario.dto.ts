import { IsBoolean } from 'class-validator';

export class CambiarEstadoUsuarioDto {
  @IsBoolean()
  activo!: boolean;
}
