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

export class CrearSalidaAcademicaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nombre!: string;

  @IsEnum(TipoSalidaAcademica)
  tipo!: TipoSalidaAcademica;

  @IsInt()
  @Min(1)
  creditosRequeridos!: number;

  @IsInt()
  @Min(1)
  orden!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
