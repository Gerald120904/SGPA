import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ListarAsignaturasDisponiblesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nivel?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ciclo?: number;
}
