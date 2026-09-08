import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ActualizarEquipamientoAulaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidadTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadDisponible?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}
