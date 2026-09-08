import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearPerfilAcademicoDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
