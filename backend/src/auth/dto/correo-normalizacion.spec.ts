import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CrearUsuarioDto } from '../../usuarios/dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from '../../usuarios/dto/actualizar-usuario.dto';
import { LoginDto } from './login.dto';
import { RestablecerPasswordDto } from './restablecer-password.dto';
import { SolicitarRecuperacionDto } from './solicitar-recuperacion.dto';

describe('normalización de correo en DTO', () => {
  const casos = [
    {
      dto: LoginDto,
      payload: {
        correo: ' USUARIO@SGPA.TEST ',
        password: 'password-segura',
      },
    },
    {
      dto: SolicitarRecuperacionDto,
      payload: { correo: ' USUARIO@SGPA.TEST ' },
    },
    {
      dto: RestablecerPasswordDto,
      payload: {
        correo: ' USUARIO@SGPA.TEST ',
        codigo: '123456',
        password: 'password-segura',
      },
    },
    {
      dto: CrearUsuarioDto,
      payload: {
        cedula: 'TEST-DOC',
        nombres: 'Usuario',
        apellido1: 'Prueba',
        correo: ' USUARIO@SGPA.TEST ',
        password: 'password-segura',
        roles: ['PROFESOR'],
      },
    },
    {
      dto: ActualizarUsuarioDto,
      payload: { correo: ' USUARIO@SGPA.TEST ' },
    },
  ];

  it.each(casos)('$dto.name acepta y normaliza espacios y mayúsculas', async ({
    dto,
    payload,
  }) => {
    const instancia = plainToInstance(dto, payload) as { correo: string };
    const errores = await validate(instancia as object);

    expect(errores).toHaveLength(0);
    expect(instancia.correo).toBe('usuario@sgpa.test');
  });
});
