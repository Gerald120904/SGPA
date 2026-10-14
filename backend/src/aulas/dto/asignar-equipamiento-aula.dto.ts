import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AsignarEquipamientoAulaDto {
  @IsInt()
  @Min(1)
  equipamientoId!: number;

  @IsInt()
  @Min(1)
  @Max(9999)
  cantidadAsignada!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
