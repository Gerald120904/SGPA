import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para la recepción de respuestas enviadas por estudiantes a través del enlace público.
 * Implementa validación estricta y defensiva (zero-trust).
 */
export class EnviarRespuestaPublicaDto {
  @IsUUID('4', { message: 'La clave del intento de envío debe ser un UUID válido.' })
  idempotencyKey?: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'La identificación debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'La identificación es obligatoria.' })
  @MinLength(3, { message: 'La identificación debe tener al menos 3 caracteres.' })
  @MaxLength(30, { message: 'La identificación no puede exceder 30 caracteres.' })
  identificacion!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'El primer nombre debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El primer nombre es obligatorio.' })
  @MinLength(1, { message: 'El primer nombre no puede estar vacío.' })
  @MaxLength(60, { message: 'El primer nombre no puede exceder 60 caracteres.' })
  primerNombre!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsOptional()
  @IsString({ message: 'El segundo nombre debe ser una cadena de texto.' })
  @MaxLength(60, { message: 'El segundo nombre no puede exceder 60 caracteres.' })
  segundoNombre?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'El primer apellido debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El primer apellido es obligatorio.' })
  @MinLength(1, { message: 'El primer apellido no puede estar vacío.' })
  @MaxLength(60, { message: 'El primer apellido no puede exceder 60 caracteres.' })
  primerApellido!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser una cadena de texto.' })
  @MaxLength(60, { message: 'El segundo apellido no puede exceder 60 caracteres.' })
  segundoApellido?: string | null;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  @IsEmail({}, { message: 'El correo electrónico suministrado no tiene un formato válido.' })
  @MaxLength(150, { message: 'El correo electrónico no puede exceder 150 caracteres.' })
  correoEstudiantil!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsOptional()
  @IsString({ message: 'El teléfono de contacto debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono no puede exceder 30 caracteres.' })
  contacto?: string | null;

  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  @IsInt({ message: 'El período de ingreso debe ser un número entero.' })
  @IsPositive({ message: 'El período de ingreso debe ser un identificador válido.' })
  periodoIngresoId!: number;

  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    return [...new Set(value.map((v) => Number(v)).filter((n) => !isNaN(n)))];
  })
  @IsArray({ message: 'Las asignaturas aprobadas deben enviarse en una lista.' })
  @IsInt({ each: true, message: 'Cada identificador de asignatura debe ser un número entero.' })
  @IsPositive({ each: true, message: 'Cada identificador de asignatura debe ser positivo.' })
  @ArrayUnique({ message: 'No se permiten asignaturas duplicadas en la selección.' })
  asignaturasAprobadasIds!: number[];

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString({ message: 'Las optativas no disciplinarias deben ser texto.' })
  @MaxLength(1000, { message: 'Las optativas no disciplinarias no pueden superar 1000 caracteres.' })
  optativasNoDisciplinarias?: string | null;

  /**
   * Campo señuelo anti-bots (honeypot). Si un bot completa este campo, la solicitud es rechazada.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sitioWeb?: string;
}
