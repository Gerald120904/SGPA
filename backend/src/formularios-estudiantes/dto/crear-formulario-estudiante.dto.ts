import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CrearFormularioEstudianteDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsInt()
  @IsPositive()
  carreraId!: number;

  @IsInt()
  @IsPositive()
  planEstudioId!: number;
}
