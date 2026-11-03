import { IsArray, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CambiarPlanEstudianteDto {
  @IsInt()
  @Min(1)
  planNuevoId!: number;

  @IsInt()
  @Min(1)
  periodoCambioId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  equivalenciaIds?: number[];
}
