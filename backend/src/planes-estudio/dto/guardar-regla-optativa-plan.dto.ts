import { IsInt, Max, Min } from 'class-validator';

export class GuardarReglaOptativaPlanDto {
  @IsInt()
  @Min(0)
  @Max(200)
  cantidadDisciplinarias!: number;

  @IsInt()
  @Min(0)
  @Max(200)
  cantidadAbiertas!: number;

  @IsInt()
  @Min(0)
  @Max(200)
  cantidadSede!: number;
}
