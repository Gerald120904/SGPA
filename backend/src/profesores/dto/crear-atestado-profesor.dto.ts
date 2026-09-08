import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoAtestadoProfesor } from '../constants/tipo-atestado-profesor.constant';

export class CrearAtestadoProfesorDto {
  @IsEnum(TipoAtestadoProfesor)
  tipo!: TipoAtestadoProfesor;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  nombre!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  institucion!: string;

  @IsOptional()
  @IsDateString()
  fechaObtencion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
