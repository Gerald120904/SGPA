import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { PermisosGuard } from '../../permisos/guards/permisos.guard';
import { Permisos } from '../../permisos/decorators/permisos.decorator';
import { PermisoSistema } from '../../permisos/constants/permisos.constant';
import { GoogleOauthService } from './google-oauth.service';

@Controller('integraciones/google/oauth')
export class GoogleOauthController {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  @Post('iniciar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_CREAR)
  async iniciar(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    return this.googleOauthService.generarUrlAutorizacion(usuarioId);
  }

  @Get('estado')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  async obtenerEstado(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    return this.googleOauthService.obtenerEstado(usuarioId);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const html = await this.googleOauthService.procesarCallback(code, state);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Delete('desconectar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async desconectar(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    await this.googleOauthService.desconectar(usuarioId);
    return { mensaje: 'Conexión con Google desvinculada exitosamente' };
  }

  // --- ENDPOINTS PARA CUENTA INSTITUCIONAL PRINCIPAL ---

  @Get('institucional/estado')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  async obtenerEstadoInstitucional() {
    return this.googleOauthService.obtenerEstadoInstitucional();
  }

  @Post('institucional/iniciar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async iniciarInstitucional(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    return this.googleOauthService.iniciarConexionInstitucional(usuarioId);
  }

  @Post('institucional/conectar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async conectarInstitucional(
    @Req() req: Request,
    @Body() dto: { googleEmail: string; refreshToken?: string; notas?: string },
  ) {
    const usuarioId = req.user!.sub;
    const cuenta = await this.googleOauthService.conectarCuentaInstitucionalManual(usuarioId, dto);
    return { mensaje: 'Cuenta institucional vinculada exitosamente', email: cuenta.googleEmail };
  }

  @Post('institucional/reconectar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async reconectarInstitucional(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    const cuenta = await this.googleOauthService.reconectarCuentaInstitucional(usuarioId);
    return { mensaje: 'Cuenta institucional reconectada exitosamente', email: cuenta.googleEmail };
  }

  @Delete('institucional/desconectar')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_GESTIONAR)
  async desconectarInstitucional(@Req() req: Request) {
    const usuarioId = req.user!.sub;
    await this.googleOauthService.desconectarCuentaInstitucional(usuarioId);
    return { mensaje: 'Cuenta institucional desvinculada exitosamente' };
  }

  @Get('institucional/historial-sync')
  @UseGuards(AuthGuard, PermisosGuard)
  @Permisos(PermisoSistema.FORMULARIOS_ESTUDIANTES_VER)
  async historialSync() {
    return this.googleOauthService.listarHistorialSync();
  }
}
