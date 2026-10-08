import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { TipoRegistroPerfil } from '../constants/tipo-registro-perfil.constant';

export class CrearPerfilAcademicoDto {
  @IsInt()
  @Min(1)
  carreraId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numeroPerfil?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  consecutivo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  acuerdoAprobacion?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  fechaAprobacion?: string | null;

  @IsOptional()
  @IsEnum(TipoRegistroPerfil)
  tipoRegistro?: TipoRegistroPerfil | null;
}
