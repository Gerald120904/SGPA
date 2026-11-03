import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RechazoItemDto {
  @IsInt()
  @Min(1)
  id!: number;

  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio para cada estudiante.' })
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres.' })
  motivo!: string;
}

export class RechazarRevisionMasivaDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un registro para rechazar.' })
  @ValidateNested({ each: true })
  @Type(() => RechazoItemDto)
  rechazos!: RechazoItemDto[];
}

