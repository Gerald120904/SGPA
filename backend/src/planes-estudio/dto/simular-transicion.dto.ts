import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsPositive } from 'class-validator';

export class SimularTransicionDto {
  @IsInt()
  @IsPositive()
  carreraId!: number;

  @IsInt()
  @IsPositive()
  planOrigenId!: number;

  @IsInt()
  @IsPositive()
  planDestinoId!: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  estudianteIds?: number[];
}

