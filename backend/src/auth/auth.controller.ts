import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { LoginDto } from './dto/login.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { AceptarInvitacionDto } from './dto/aceptar-invitacion.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('recuperar-password')
  @HttpCode(HttpStatus.OK)
  recuperarPassword(@Body() dto: SolicitarRecuperacionDto) {
    return this.authService.solicitarRecuperacion(dto);
  }

  @Post('restablecer-password')
  @HttpCode(HttpStatus.OK)
  restablecerPassword(@Body() dto: RestablecerPasswordDto) {
    return this.authService.restablecerPassword(dto);
  }

  @Get('invitacion')
  mostrarInvitacion(@Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy',
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'");
    return response.type('html').send(`<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invitación SGPA</title>
<main style="max-width:420px;margin:7vh auto;padding:32px;font-family:Arial,sans-serif;color:#344054;border:1px solid #e4e7ec;border-top:5px solid #cf2029;border-radius:12px">
<h1 style="color:#cf2029">Establecer contraseña</h1>
<p>Completa tu invitación al SGPA.</p>
<form id="form"><label>Contraseña nueva<br><input id="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required style="width:100%;padding:10px;margin:8px 0 20px"></label>
<button type="submit" style="background:#cf2029;color:white;border:0;border-radius:6px;padding:12px 20px">Activar cuenta</button></form>
<p id="mensaje" role="status"></p></main>
<script>
const params = new URLSearchParams(location.hash.slice(1));
const correo = params.get('correo');
const token = params.get('token');
history.replaceState(null, '', location.pathname);
const form = document.getElementById('form');
const mensaje = document.getElementById('mensaje');
if (!correo || !token) { form.hidden = true; mensaje.textContent = 'Enlace inválido.'; }
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const boton = form.querySelector('button');
  boton.disabled = true;
  try {
    const respuesta = await fetch('/auth/aceptar-invitacion', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({correo, token, password: document.getElementById('password').value})
    });
    if (!respuesta.ok) throw new Error('El enlace es inválido o expiró.');
    form.hidden = true;
    mensaje.textContent = 'Contraseña establecida. Ya puedes iniciar sesión en SGPA.';
  } catch (error) {
    mensaje.textContent = error.message;
    boton.disabled = false;
  }
});
</script></html>`);
  }

  @Post('aceptar-invitacion')
  @HttpCode(HttpStatus.OK)
  aceptarInvitacion(@Body() dto: AceptarInvitacionDto) {
    return this.authService.aceptarInvitacion(dto);
  }

  @UseGuards(AuthGuard)
  @Get('perfil')
  perfil(@Req() request: Request) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return this.authService.perfil(user.sub);
  }
}
