import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class ActualizarCarrerasPerfilDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  carreraIds!: number[];
}
