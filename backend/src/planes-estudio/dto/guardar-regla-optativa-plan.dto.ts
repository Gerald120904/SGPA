import { IsInt, IsOptional, Min } from 'class-validator';

export class GuardarReglaOptativaPlanDto {
  @IsInt()
  @Min(0)
  minimoDisciplinariasPropias!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maximoOtrasAreas?: number | null;
}
