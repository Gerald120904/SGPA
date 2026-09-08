import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarPerfilAcademicoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
