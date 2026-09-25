import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoRegistroPerfil } from '../constants/tipo-registro-perfil.constant';

export class ActualizarPerfilAcademicoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

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
