import { IsEnum, IsInt, Min } from 'class-validator';
import { TipoRequisito } from '../../planes-estudio/constants/tipo-requisito.constant';

export class CrearCursoRequisitoDto {
  @IsInt()
  @Min(1)
  requisitoCursoId!: number;

  @IsEnum(TipoRequisito)
  tipo!: TipoRequisito;
}
