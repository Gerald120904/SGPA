import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearAreaAcademicaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
