import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { DiaSemana } from '../constants/dia-semana.constant';
import { EstadoDisponibilidad } from '../constants/estado-disponibilidad.constant';

export class FiltroProfesoresDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cedula?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursoId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perfilAcademicoId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodoAcademicoId?: number;

  @IsOptional()
  @IsEnum(EstadoDisponibilidad)
  estadoDisponibilidad?: EstadoDisponibilidad;

  @IsOptional()
  @IsEnum(DiaSemana)
  dia?: DiaSemana;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'hora debe tener formato HH:mm.',
  })
  hora?: string;
}
