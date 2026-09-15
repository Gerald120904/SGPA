import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ActualizarConfiguracionFormularioDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(/\S/, { message: 'El nombre no puede contener solo espacios.' })
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El ID de Google Form no puede contener solo espacios.',
  })
  googleFormId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/, {
    message: 'El ID de Google Sheet no puede contener solo espacios.',
  })
  googleSheetId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  carreraId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  planEstudioId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  ultimaFilaProcesada?: number;
}
