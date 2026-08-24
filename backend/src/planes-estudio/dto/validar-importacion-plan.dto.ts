import { ArrayMaxSize, IsArray } from 'class-validator';

export class ValidarImportacionPlanDto {
  @IsArray()
  @ArrayMaxSize(100)
  bloques!: Record<string, unknown>[];

  @IsArray()
  @ArrayMaxSize(500)
  asignaturas!: Record<string, unknown>[];

  @IsArray()
  @ArrayMaxSize(1000)
  requisitos!: Record<string, unknown>[];

  @IsArray()
  @ArrayMaxSize(100)
  salidas!: Record<string, unknown>[];

  @IsArray()
  @ArrayMaxSize(1000)
  salidaAsignaturas!: Record<string, unknown>[];
}
