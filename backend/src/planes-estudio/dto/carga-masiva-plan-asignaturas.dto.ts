import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CrearPlanAsignaturaDto } from './crear-plan-asignatura.dto';

export class CargaMasivaPlanAsignaturasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CrearPlanAsignaturaDto)
  asignaturas!: CrearPlanAsignaturaDto[];
}
