import { IsBoolean } from 'class-validator';

export class CambiarEstadoPlanAsignaturaDto {
  @IsBoolean()
  activo!: boolean;
}
