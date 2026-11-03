import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class EjecutarTransicionDto {
  @IsInt()
  @IsPositive()
  carreraId!: number;

  @IsInt()
  @IsPositive()
  planOrigenId!: number;

  @IsInt()
  @IsPositive()
  planDestinoId!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos un estudiante para la transición curricular.' })
  estudianteIds!: number[];

  @IsNotEmpty({ message: 'El motivo institucional de la transición es obligatorio.' })
  @IsString()
  @MinLength(5, { message: 'El motivo institucional debe tener al menos 5 caracteres.' })
  @MaxLength(500, { message: 'El motivo institucional no puede superar los 500 caracteres.' })
  motivo!: string;
}

