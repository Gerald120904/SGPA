import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class RespuestaCrudaGoogleFormsDto {
  @IsOptional()
  @IsString()
  identificadorExterno?: string;

  @IsInt()
  @Min(2)
  filaOrigen!: number;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class SincronizarGoogleFormsSimuladoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => RespuestaCrudaGoogleFormsDto)
  respuestas!: RespuestaCrudaGoogleFormsDto[];
}
