import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class GuardarEvidenciasRequisitoDto {
  @IsInt()
  @Min(1)
  requisitoId!: number;

  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  atestadoIds!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string | null;
}
