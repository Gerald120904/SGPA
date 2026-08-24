import { IsBoolean } from 'class-validator';

export class CambiarEstadoSalidaAcademicaDto {
  @IsBoolean()
  activo!: boolean;
}
