import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RechazarRespuestaFormularioDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
