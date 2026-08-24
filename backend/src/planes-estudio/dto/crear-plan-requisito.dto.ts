import { IsEnum, IsInt, Min } from 'class-validator';
import { TipoRequisito } from '../constants/tipo-requisito.constant';

export class CrearPlanRequisitoDto {
  @IsInt()
  @Min(1)
  asignaturaId!: number;

  @IsInt()
  @Min(1)
  requisitoAsignaturaId!: number;

  @IsEnum(TipoRequisito)
  tipo!: TipoRequisito;
}
