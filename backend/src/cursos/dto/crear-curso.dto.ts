import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearCursoDto {
  @IsInt()
  @Min(1)
  planAsignaturaId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
