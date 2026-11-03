import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EstadoPlanEstudio } from '../constants/estado-plan-estudio.constant';

export class CambiarEstadoPlanEstudioDto {
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsEnum(EstadoPlanEstudio, {
    message: 'El estado del plan debe ser VIGENTE, EN_TRANSICION o CERRADO.',
  })
  estado?: EstadoPlanEstudio;

  @IsOptional()
  @IsString()
  @MinLength(5, { message: 'El motivo del cambio de estado debe tener al menos 5 caracteres.' })
  @MaxLength(500, { message: 'El motivo no puede exceder los 500 caracteres.' })
  motivo?: string;
}
