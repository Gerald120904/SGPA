import { IsInt, Min } from 'class-validator';

export class CopiarDisponibilidadDto {
  @IsInt()
  @Min(1)
  periodoOrigenId!: number;

  @IsInt()
  @Min(1)
  periodoDestinoId!: number;
}
