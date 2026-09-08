import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoAtestadoProfesor } from '../constants/estado-atestado-profesor.constant';

export class RevisarAtestadoProfesorDto {
  @IsIn([EstadoAtestadoProfesor.APROBADO, EstadoAtestadoProfesor.RECHAZADO])
  estado!: EstadoAtestadoProfesor.APROBADO | EstadoAtestadoProfesor.RECHAZADO;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
