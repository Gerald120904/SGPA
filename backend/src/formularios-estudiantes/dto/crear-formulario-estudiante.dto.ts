import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ProveedorFormulario } from '../constants/proveedor-formulario.constant';

export class CrearFormularioEstudianteDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  titulo!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  descripcion!: string;

  @IsInt()
  @IsPositive()
  carreraId!: number;

  @IsInt()
  @IsPositive()
  planEstudioId!: number;

  @IsOptional()
  @IsEnum(ProveedorFormulario)
  proveedor?: ProveedorFormulario;
}
