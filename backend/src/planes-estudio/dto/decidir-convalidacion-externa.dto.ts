import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { EstadoConvalidacionExterna } from '../constants/estado-convalidacion-externa.constant';

export class DecidirConvalidacionExternaDto {
  @IsIn([EstadoConvalidacionExterna.APROBADA, EstadoConvalidacionExterna.RECHAZADA])
  decision!: EstadoConvalidacionExterna.APROBADA | EstadoConvalidacionExterna.RECHAZADA;

  @IsString() @MinLength(5) @MaxLength(500)
  motivo!: string;
}
