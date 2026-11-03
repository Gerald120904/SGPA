import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReingresarEstudianteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  nuevoPlanId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodoCambioId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  equivalenciaIds?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

