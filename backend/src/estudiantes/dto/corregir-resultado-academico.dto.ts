import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { OrigenAcademico } from '../constants/origen-academico.constant';
import { ResultadoAcademico } from '../constants/resultado-academico.constant';

export class CorregirResultadoAcademicoDto {
  @IsEnum(ResultadoAcademico)
  resultado!: ResultadoAcademico;

  @IsOptional()
  @IsEnum(OrigenAcademico)
  origenAcademico?: OrigenAcademico;

  @IsNotEmpty({ message: 'El motivo de la corrección es obligatorio.' })
  @IsString()
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres.' })
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}

