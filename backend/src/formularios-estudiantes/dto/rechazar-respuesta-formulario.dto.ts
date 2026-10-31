import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class RechazarRespuestaFormularioDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsNotEmpty({
    message:
      'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
  })
  @IsString({
    message: 'El motivo de rechazo debe ser una cadena de texto.',
  })
  @MaxLength(500, {
    message: 'El motivo de rechazo no puede superar los 500 caracteres.',
  })
  motivo!: string;
}
