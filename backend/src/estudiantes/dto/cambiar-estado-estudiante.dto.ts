import { IsEnum } from 'class-validator';
import { EstadoEstudiante } from '../constants/estado-estudiante.constant';

export class CambiarEstadoEstudianteDto {
  @IsEnum(EstadoEstudiante)
  estado!: EstadoEstudiante;
}
