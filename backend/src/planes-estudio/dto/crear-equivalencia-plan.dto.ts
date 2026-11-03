import { IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CrearEquivalenciaPlanDto {
  @IsInt()
  @IsPositive()
  carreraOrigenId!: number;

  @IsInt()
  @IsPositive()
  planOrigenId!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  asignaturaOrigenId?: number;

  @IsOptional()
  @IsArray()
  asignaturasOrigenIds?: number[];

  @IsInt()
  @IsPositive()
  carreraDestinoId!: number;

  @IsInt()
  @IsPositive()
  planDestinoId!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  asignaturaDestinoId?: number;

  @IsOptional()
  @IsArray()
  asignaturasDestinoIds?: number[];

  @IsOptional()
  @IsString()
  tipoEquivalencia?: 'INDIVIDUAL' | 'N_A_1' | '1_A_N';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificacion?: string;
}
