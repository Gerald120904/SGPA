import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { LoginDto } from './dto/login.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';

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
