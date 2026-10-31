import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarSolicitudDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
