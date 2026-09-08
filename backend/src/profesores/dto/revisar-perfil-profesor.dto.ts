import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPerfilProfesor } from '../../perfiles-academicos/constants/estado-perfil-profesor.constant';

export class RevisarPerfilProfesorDto {
  @IsIn([EstadoPerfilProfesor.APROBADO, EstadoPerfilProfesor.RECHAZADO])
  estado!: EstadoPerfilProfesor.APROBADO | EstadoPerfilProfesor.RECHAZADO;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
