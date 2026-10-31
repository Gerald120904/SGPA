import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProveedorFormulario } from '../constants/proveedor-formulario.constant';

export class CrearFormularioEstudianteDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'El título debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @MaxLength(255, { message: 'El título no puede superar 255 caracteres.' })
  titulo!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'La descripción debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @MaxLength(1000, { message: 'La descripción no puede superar 1000 caracteres.' })
  descripcion!: string;

  @IsInt({ message: 'El identificador de carrera debe ser un número entero.' })
  @IsPositive({ message: 'El identificador de carrera debe ser un número positivo.' })
  carreraId!: number;

  @IsInt({ message: 'El identificador de plan de estudio debe ser un número entero.' })
  @IsPositive({ message: 'El identificador de plan de estudio debe ser un número positivo.' })
  planEstudioId!: number;

  @IsEnum(ProveedorFormulario, {
    message: 'La modalidad/proveedor es obligatoria y debe ser INTERNO o GOOGLE_FORMS.',
  })
  proveedor!: ProveedorFormulario;
}
