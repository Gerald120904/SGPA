import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoSalidaAcademica } from '../entities/salida-academica.entity';

export class ActualizarSalidaAcademicaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nombre?: string;

  @IsOptional()
  @IsEnum(TipoSalidaAcademica)
  tipo?: TipoSalidaAcademica;

  @IsOptional()
  @IsInt()
  @Min(1)
  creditosRequeridos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
