import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class SolicitarRecuperacionDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  correo!: string;
}
