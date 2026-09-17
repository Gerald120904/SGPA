import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
