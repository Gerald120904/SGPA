import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ActualizarCursoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
