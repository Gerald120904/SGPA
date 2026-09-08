import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BloqueDisponibilidadDto } from './bloque-disponibilidad.dto';

export class GuardarDisponibilidadDto {
  @IsInt()
  @Min(1)
  periodoAcademicoId!: number;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({
    each: true,
  })
  @Type(() => BloqueDisponibilidadDto)
  bloques!: BloqueDisponibilidadDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
