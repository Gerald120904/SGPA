import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InactivarPerfilProfesorDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
