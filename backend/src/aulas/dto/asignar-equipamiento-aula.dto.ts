import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AsignarEquipamientoAulaDto {
  @IsInt()
  @Min(1)
  equipamientoId!: number;

  @IsInt()
  @Min(1)
  cantidadTotal!: number;

  @IsInt()
  @Min(0)
  cantidadDisponible!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
