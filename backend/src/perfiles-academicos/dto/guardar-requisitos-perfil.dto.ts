import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoRequisitoPerfil } from '../constants/tipo-requisito-perfil.constant';

export class RequisitoPerfilDto {
  @IsEnum(TipoRequisitoPerfil)
  tipo!: TipoRequisitoPerfil;

  @IsBoolean()
  obligatorio!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  descripcion!: string;

  @IsInt()
  @Min(1)
  orden!: number;
}

export class GuardarRequisitosPerfilDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequisitoPerfilDto)
  requisitos!: RequisitoPerfilDto[];
}
