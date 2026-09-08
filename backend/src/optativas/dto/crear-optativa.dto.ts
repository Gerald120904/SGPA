import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TipoOptativa } from '../constants/tipo-optativa.constant';

export class CrearOptativaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsEnum(TipoOptativa)
  tipo!: TipoOptativa;

  @IsOptional()
  @IsInt()
  @Min(1)
  carreraOrigenId?: number;
}
