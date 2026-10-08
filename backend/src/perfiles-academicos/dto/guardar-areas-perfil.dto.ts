import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TipoAreaPerfil } from '../constants/tipo-area-perfil.constant';

export class AreaPerfilDto {
  @IsEnum(TipoAreaPerfil)
  tipo!: TipoAreaPerfil;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  descripcion!: string;

  @IsInt()
  @Min(1)
  orden!: number;
}

export class GuardarAreasPerfilDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AreaPerfilDto)
  areas!: AreaPerfilDto[];
}
