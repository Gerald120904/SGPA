import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoOptativa } from '../constants/tipo-optativa.constant';

export class ActualizarOptativaDto {
  @IsOptional()
  @IsEnum(TipoOptativa)
  tipo?: TipoOptativa;

  @IsOptional()
  @IsInt()
  @Min(1)
  carreraOrigenId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
