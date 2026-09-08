import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearProyectoProfesorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  unidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rol?: string;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
