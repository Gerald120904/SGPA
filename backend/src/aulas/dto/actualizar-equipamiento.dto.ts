import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ActualizarEquipamientoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;
}
