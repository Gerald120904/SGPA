import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { TipoAula } from '../constants/tipo-aula.constant';
import { TipoMobiliarioAula } from '../constants/tipo-mobiliario-aula.constant';
import { RequisitoEquipamientoAulaDto } from './requisito-equipamiento-aula.dto';

export class BuscarAulasDisponiblesDto {
  @IsInt()
  @Min(1)
  periodoId!: number;

  @IsDateString() fechaHoraInicio!: string;
  @IsDateString() fechaHoraFin!: string;
  @IsOptional() @IsInt() @Min(1) cantidadEstudiantes?: number;
  @IsOptional() @IsEnum(TipoAula) tipo?: TipoAula;
  @IsOptional() @IsEnum(TipoMobiliarioAula) tipoMobiliario?: TipoMobiliarioAula;
  @IsOptional() @IsBoolean() incluirSobrecupo?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitoEquipamientoAulaDto)
  equipamientos?: RequisitoEquipamientoAulaDto[];
}
