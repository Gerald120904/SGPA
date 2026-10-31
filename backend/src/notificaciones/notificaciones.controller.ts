import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(AuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(
    @UsuarioActualId() usuarioId: number,
    @Query('noLeidas') noLeidas?: string,
  ) {
    return this.notificacionesService.listarPorUsuario(
      usuarioId,
      noLeidas === 'true',
    );
  }

  @Get('no-leidas/conteo')
  contarNoLeidas(@UsuarioActualId() usuarioId: number) {
    return this.notificacionesService.contarNoLeidas(usuarioId);
  }

  @Patch(':id/leida')
  marcarComoLeida(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.notificacionesService.marcarComoLeida(id, usuarioId);
  }

  @Patch('marcar-todas-leidas')
  marcarTodasComoLeidas(@UsuarioActualId() usuarioId: number) {
    return this.notificacionesService.marcarTodasComoLeidas(usuarioId);
  }
}
