import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class AprobarRevisionMasivaDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un registro para aprobar.' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  registroIds!: number[];
}

