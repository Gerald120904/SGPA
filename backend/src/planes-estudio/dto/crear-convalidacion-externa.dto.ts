import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsPositive, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentoConvalidacionDto {
  @IsString() @IsNotEmpty() @MaxLength(180) nombre!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) referencia!: string;
  @IsString() @MaxLength(64) sha256!: string;
}

export class CrearConvalidacionExternaDto {
  @IsInt() @IsPositive() estudianteId!: number;
  @IsInt() @IsPositive() planDestinoId!: number;
  @IsInt() @IsPositive() planAsignaturaDestinoId!: number;
  @IsString() @IsNotEmpty() @MaxLength(180) institucionOrigen!: string;
  @IsString() @IsNotEmpty() @MaxLength(180) asignaturaOrigen!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) identificacionAsignatura!: string;
  @IsInt() @Min(1) creditosOrigen!: number;
  @IsString() @IsNotEmpty() @MaxLength(500) motivoSolicitud!: string;
  @IsUUID() idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => DocumentoConvalidacionDto)
  documentacion!: DocumentoConvalidacionDto[];
}
