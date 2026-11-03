import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FiltrarBandejaRevisionDto {
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

  @IsOptional()
  @IsString()
  fuente?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  texto?: string;
}

