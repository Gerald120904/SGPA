import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearEquipamientoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
