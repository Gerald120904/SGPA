import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearNotificacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  claveIdempotencia?: string | null;
  @IsInt()
  @Min(1)
  usuarioId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  carreraId?: number | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  titulo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  mensaje!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  tipo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  enlace?: string | null;

  @IsOptional()
  metadatos?: Record<string, unknown> | null;
}
