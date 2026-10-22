import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlcanceJerarquicoService } from '../permisos/alcance-jerarquico.service';
import { ConfigurarJerarquiaDto, CrearAsistenteJerarquicoDto } from './dto/configurar-jerarquia.dto';
import { JerarquiaUsuariosService } from './jerarquia-usuarios.service';

@Controller('jerarquia-usuarios')
@UseGuards(AuthGuard, RolesGuard)
export class JerarquiaUsuariosController {
  constructor(
    private readonly jerarquia: JerarquiaUsuariosService,
    private readonly alcance: AlcanceJerarquicoService,
  ) {}

  @Get('mis-carreras')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.ASISTENTE_ESTUDIANTIL)
  async misCarreras(@Req() request: Request) {
    return this.alcance.obtenerCarrerasAutorizadas(request.user!.sub);
  }

  @Get('mis-alcances')
  @Roles(RolSistema.COORDINADOR)
  misAlcances(@Req() request: Request) {
    return this.jerarquia.misAlcances(request.user!.sub);
  }

  @Get('catalogo-estudiantes')
  @Roles(RolSistema.COORDINADOR, RolSistema.ASISTENTE_ESTUDIANTIL)
  catalogoEstudiantes(@Req() request: Request) {
    return this.jerarquia.catalogoEstudiantes(request.user!.sub);
  }

  @Get('catalogo-cursos')
  @Roles(RolSistema.COORDINADOR, RolSistema.ASISTENTE_ESTUDIANTIL)
  catalogoCursos(@Req() request: Request) {
    return this.jerarquia.catalogoCursos(request.user!.sub);
  }

  @Get('catalogo-planes')
  @Roles(RolSistema.COORDINADOR, RolSistema.ASISTENTE_ESTUDIANTIL)
  catalogoPlanes(@Req() request: Request) {
    return this.jerarquia.catalogoPlanes(request.user!.sub);
  }

  @Put('coordinadores/:id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  configurarCoordinador(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfigurarJerarquiaDto,
  ) {
    return this.jerarquia.configurarCoordinador(request.user!.sub, id, dto.carreras);
  }

  @Get('coordinadores/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  obtenerCoordinador(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.jerarquia.obtenerCoordinador(request.user!.sub, id);
  }

  @Get('asistentes')
  @Roles(RolSistema.COORDINADOR)
  listarMisAsistentes(@Req() request: Request) {
    return this.jerarquia.listarMisAsistentes(request.user!.sub);
  }

  @Get('asistentes-configuracion')
  @Roles(RolSistema.COORDINADOR)
  configuracionCreacionAsistente() {
    return this.jerarquia.configuracionCreacionAsistente();
  }

  @Get('asistentes/:id')
  @Roles(RolSistema.COORDINADOR)
  obtenerAsistente(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.jerarquia.obtenerAsistente(request.user!.sub, id);
  }

  @Get('auditoria/:id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  listarAuditoria(@Req() request: Request, @Param('id', ParseIntPipe) id: number) {
    return this.jerarquia.listarAuditoria(request.user!.sub, id);
  }

  @Put('asistentes/:id')
  @Roles(RolSistema.COORDINADOR)
  vincularAsistente(
    @Req() request: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfigurarJerarquiaDto,
  ) {
    return this.jerarquia.vincularAsistente(request.user!.sub, id, dto.carreras);
  }

  @Post('asistentes')
  @Roles(RolSistema.COORDINADOR)
  crearAsistente(@Req() request: Request, @Body() dto: CrearAsistenteJerarquicoDto) {
    return this.jerarquia.crearAsistente(request.user!.sub, dto);
  }
}
