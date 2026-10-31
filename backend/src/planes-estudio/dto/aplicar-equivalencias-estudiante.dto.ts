import { ArrayNotEmpty, IsArray, IsInt, IsPositive } from 'class-validator';

export class AplicarEquivalenciasEstudianteDto {
  @IsInt()
  @IsPositive()
  estudianteId!: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @IsPositive({ each: true })
  equivalenciaIds!: number[];
}
