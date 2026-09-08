import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CopiarDisponibilidadDto } from './dto/copiar-disponibilidad.dto';
import { GuardarDisponibilidadDto } from './dto/guardar-disponibilidad.dto';
import { DisponibilidadProfesoresService } from './disponibilidad-profesores.service';

@Controller('profesores')
@UseGuards(AuthGuard, RolesGuard)
export class DisponibilidadProfesoresController {
  constructor(
    private readonly disponibilidadService: DisponibilidadProfesoresService,
  ) {}

  private obtenerUsuarioId(request: Request): number {
    if (!request.user) {
      throw new UnauthorizedException('Usuario no autenticado.');
    }

    return request.user.sub;
  }

  @Get('mi-disponibilidad/:periodoId/historial')
  @Roles(RolSistema.PROFESOR)
  obtenerHistorial(
    @Req() request: Request,
    @Param('periodoId', ParseIntPipe)
    periodoId: number,
  ) {
    return this.disponibilidadService.obtenerHistorialMiDisponibilidad(
      this.obtenerUsuarioId(request),
      periodoId,
    );
  }

  @Get('mi-disponibilidad/:periodoId')
  @Roles(RolSistema.PROFESOR)
  consultarMiDisponibilidad(
    @Req() request: Request,
    @Param('periodoId', ParseIntPipe)
    periodoId: number,
  ) {
    return this.disponibilidadService.consultarMiDisponibilidad(
      this.obtenerUsuarioId(request),
      periodoId,
    );
  }

  @Put('mi-disponibilidad')
  @Roles(RolSistema.PROFESOR)
  guardarMiDisponibilidad(
    @Req() request: Request,
    @Body()
    dto: GuardarDisponibilidadDto,
  ) {
    return this.disponibilidadService.guardarMiDisponibilidad(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Post('mi-disponibilidad/copiar')
  @Roles(RolSistema.PROFESOR)
  copiarDisponibilidad(
    @Req() request: Request,
    @Body()
    dto: CopiarDisponibilidadDto,
  ) {
    return this.disponibilidadService.copiarDisponibilidadAnterior(
      this.obtenerUsuarioId(request),
      dto,
    );
  }

  @Get(':profesorId/disponibilidad/:periodoId')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  consultarDisponibilidadProfesor(
    @Param('profesorId', ParseIntPipe)
    profesorId: number,

    @Param('periodoId', ParseIntPipe)
    periodoId: number,
  ) {
    return this.disponibilidadService.obtenerDisponibilidadProfesor(
      profesorId,
      periodoId,
    );
  }
}
