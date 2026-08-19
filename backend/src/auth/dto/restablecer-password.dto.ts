import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RestablecerPasswordDto {
  @IsEmail()
  correo!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'El código debe contener 6 dígitos',
  })
  codigo!: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña debe contener al menos 8 caracteres',
  })
  @MaxLength(128)
  password!: string;
}
