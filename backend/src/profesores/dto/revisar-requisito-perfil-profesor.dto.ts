import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoCumplimientoRequisito } from '../constants/estado-cumplimiento-requisito.constant';

export class RevisarRequisitoPerfilProfesorDto {
  @IsIn([
    EstadoCumplimientoRequisito.CUMPLE,
    EstadoCumplimientoRequisito.NO_CUMPLE,
    EstadoCumplimientoRequisito.NO_APLICA,
  ])
  estado!:
    | EstadoCumplimientoRequisito.CUMPLE
    | EstadoCumplimientoRequisito.NO_CUMPLE
    | EstadoCumplimientoRequisito.NO_APLICA;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;
}
