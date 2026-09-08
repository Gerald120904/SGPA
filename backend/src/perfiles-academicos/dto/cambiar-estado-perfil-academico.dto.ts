import { IsBoolean } from 'class-validator';

export class CambiarEstadoPerfilAcademicoDto {
  @IsBoolean()
  activo!: boolean;
}
