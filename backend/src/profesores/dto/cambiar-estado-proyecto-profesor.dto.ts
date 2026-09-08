import { IsBoolean } from 'class-validator';

export class CambiarEstadoProyectoProfesorDto {
  @IsBoolean()
  activo!: boolean;
}
