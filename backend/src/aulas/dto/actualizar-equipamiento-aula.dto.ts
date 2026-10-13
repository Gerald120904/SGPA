import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ActualizarEquipamientoAulaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  cantidadAsignada?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;
}
