import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AsociarCarreraAreaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  carreraId!: number;
}
