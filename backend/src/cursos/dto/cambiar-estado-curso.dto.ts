import { IsBoolean } from 'class-validator';

export class CambiarEstadoCursoDto {
  @IsBoolean()
  activo!: boolean;
}
