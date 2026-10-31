import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CrearEquivalenciaPlanDto {
  @IsInt()
  @IsPositive()
  carreraOrigenId!: number;

  @IsInt()
  @IsPositive()
  planOrigenId!: number;

  @IsInt()
  @IsPositive()
  asignaturaOrigenId!: number;

  @IsInt()
  @IsPositive()
  carreraDestinoId!: number;

  @IsInt()
  @IsPositive()
  planDestinoId!: number;

  @IsInt()
  @IsPositive()
  asignaturaDestinoId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  justificacion?: string;
}
