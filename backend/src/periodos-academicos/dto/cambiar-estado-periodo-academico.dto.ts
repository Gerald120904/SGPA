import { IsEnum } from 'class-validator';
import { EstadoPeriodoAcademico } from '../constants/estado-periodo-academico.constant';

export class CambiarEstadoPeriodoAcademicoDto {
  @IsEnum(EstadoPeriodoAcademico)
  estado!: EstadoPeriodoAcademico;
}
