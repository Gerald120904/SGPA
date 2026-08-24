import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CrearPlanRequisitoDto } from './crear-plan-requisito.dto';

export class CargaMasivaPlanRequisitosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CrearPlanRequisitoDto)
  requisitos!: CrearPlanRequisitoDto[];
}
