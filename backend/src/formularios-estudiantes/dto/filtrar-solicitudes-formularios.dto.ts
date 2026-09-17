import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class FiltrarSolicitudesFormulariosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planEstudioId?: number;
}
