import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CrearFormularioEstudianteDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titulo!: string;

  @IsInt()
  @IsPositive()
  carreraId!: number;

  @IsInt()
  @IsPositive()
  planEstudioId!: number;
}
