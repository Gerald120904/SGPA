import { IsNotEmpty, IsObject } from 'class-validator';

export class EditarSolicitudDto {
  @IsObject()
  @IsNotEmpty()
  datosActualizados!: Record<string, unknown>;
}
