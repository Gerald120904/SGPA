import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RechazoItemDto } from './rechazar-revision-masiva.dto';

export class ProponerRevisionBandejaDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  planEstudioId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  loteId?: number;

  @IsArray()
  @IsInt({ each: true })
  aprobarRegistroIds!: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RechazoItemDto)
  rechazarRegistros!: RechazoItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

