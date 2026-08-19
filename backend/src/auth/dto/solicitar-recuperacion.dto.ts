import { IsEmail } from 'class-validator';

export class SolicitarRecuperacionDto {
  @IsEmail()
  correo!: string;
}
