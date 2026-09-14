import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { AulasService } from './aulas.service';
import { ActualizarAulaDto } from './dto/actualizar-aula.dto';
import { ActualizarEquipamientoAulaDto } from './dto/actualizar-equipamiento-aula.dto';
import { ActualizarEquipamientoDto } from './dto/actualizar-equipamiento.dto';
import { ActualizarIndisponibilidadAulaDto } from './dto/actualizar-indisponibilidad-aula.dto';
import { ActualizarReservaAulaDto } from './dto/actualizar-reserva-aula.dto';
import { AsignarEquipamientoAulaDto } from './dto/asignar-equipamiento-aula.dto';
import { CambiarEstadoAulaDto } from './dto/cambiar-estado-aula.dto';
import { CambiarEstadoEquipamientoAulaDto } from './dto/cambiar-estado-equipamiento-aula.dto';
import { CambiarEstadoEquipamientoDto } from './dto/cambiar-estado-equipamiento.dto';
import { CambiarEstadoIndisponibilidadAulaDto } from './dto/cambiar-estado-indisponibilidad-aula.dto';
import { CambiarEstadoReservaAulaDto } from './dto/cambiar-estado-reserva-aula.dto';
import { CrearAulaDto } from './dto/crear-aula.dto';
import { CrearEquipamientoDto } from './dto/crear-equipamiento.dto';
import { CrearIndisponibilidadAulaDto } from './dto/crear-indisponibilidad-aula.dto';
import { CrearReservaAulaDto } from './dto/crear-reserva-aula.dto';
import { ActualizarDisponibilidadAulaDto } from './dto/actualizar-disponibilidad-aula.dto';
import { CrearDisponibilidadAulaDto } from './dto/crear-disponibilidad-aula.dto';
import { BuscarAulasDisponiblesDto } from './dto/buscar-aulas-disponibles.dto';
import { ConsultarOcupacionAulaDto } from './dto/consultar-ocupacion-aula.dto';
import { FiltrarAulasDto } from './dto/filtrar-aulas.dto';

@Controller('aulas')
@UseGuards(AuthGuard, PermisosGuard)
export class AulasController {
  constructor(private readonly aulasService: AulasService) {}

  @Post('buscar-disponibles')
  @HttpCode(200)
  @Permisos(PermisoSistema.AULAS_VER)
  buscarAulasDisponibles(@Body() dto: BuscarAulasDisponiblesDto) {
    return this.aulasService.buscarAulasDisponibles(dto);
  }

  @Post(':aulaId/evaluar-asignacion')
  @HttpCode(200)
  @Permisos(PermisoSistema.AULAS_ASIGNAR)
  evaluarAulaParaAsignacion(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Body()
    dto: BuscarAulasDisponiblesDto,
  ) {
    return this.aulasService.evaluarAulaParaAsignacion(aulaId, dto);
  }

  @Get('equipamientos')
  @Permisos(PermisoSistema.AULAS_VER)
  listarEquipamientos() {
    return this.aulasService.listarEquipamientos();
  }

  @Get('equipamientos/:id')
  @Permisos(PermisoSistema.AULAS_VER)
  obtenerEquipamientoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.aulasService.obtenerEquipamientoPorId(id);
  }

  @Post('equipamientos')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  crearEquipamiento(
    @Body() dto: CrearEquipamientoDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearEquipamiento(dto, usuarioId);
  }

  @Patch('equipamientos/:id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizarEquipamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEquipamientoDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarEquipamiento(id, dto, usuarioId);
  }

  @Patch('equipamientos/:id/estado')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  cambiarEstadoEquipamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoEquipamientoDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstadoEquipamiento(
      id,
      dto.activo,
      usuarioId,
    );
  }

  @Get()
  @Permisos(PermisoSistema.AULAS_VER)
  listar(@Query() filtros: FiltrarAulasDto) {
    return this.aulasService.listar(filtros);
  }

  @Get(':aulaId/equipamientos')
  @Permisos(PermisoSistema.AULAS_VER)
  listarEquipamientoAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarEquipamientoAula(aulaId);
  }

  @Post(':aulaId/equipamientos')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  asignarEquipamientoAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: AsignarEquipamientoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.asignarEquipamientoAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/equipamientos/:equipamientoId')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizarEquipamientoAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('equipamientoId', ParseIntPipe) equipamientoId: number,
    @Body() dto: ActualizarEquipamientoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarEquipamientoAula(
      aulaId,
      equipamientoId,
      dto,
      usuarioId,
    );
  }

  @Patch(':aulaId/equipamientos/:equipamientoId/estado')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  cambiarEstadoEquipamientoAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('equipamientoId', ParseIntPipe) equipamientoId: number,
    @Body() dto: CambiarEstadoEquipamientoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstadoEquipamientoAula(
      aulaId,
      equipamientoId,
      dto.activo,
      usuarioId,
    );
  }

  @Get(':aulaId/indisponibilidades')
  @Permisos(PermisoSistema.AULAS_VER)
  listarIndisponibilidadesAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarIndisponibilidadesAula(aulaId);
  }

  @Get(':aulaId/indisponibilidades/:id')
  @Permisos(PermisoSistema.AULAS_VER)
  obtenerIndisponibilidadPorId(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aulasService.obtenerIndisponibilidadPorId(aulaId, id);
  }

  @Post(':aulaId/indisponibilidades')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  crearIndisponibilidadAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: CrearIndisponibilidadAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearIndisponibilidadAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/indisponibilidades/:id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizarIndisponibilidadAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarIndisponibilidadAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarIndisponibilidadAula(
      aulaId,
      id,
      dto,
      usuarioId,
    );
  }

  @Patch(':aulaId/indisponibilidades/:id/estado')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  cambiarEstadoIndisponibilidadAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoIndisponibilidadAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstadoIndisponibilidadAula(
      aulaId,
      id,
      dto.activo,
      usuarioId,
    );
  }

  @Get(':aulaId/reservas')
  @Permisos(PermisoSistema.AULAS_VER)
  listarReservasAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarReservasAula(aulaId);
  }

  @Get(':aulaId/reservas/:id')
  @Permisos(PermisoSistema.AULAS_VER)
  obtenerReservaPorId(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aulasService.obtenerReservaPorId(aulaId, id);
  }

  @Post(':aulaId/reservas')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  crearReservaAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: CrearReservaAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearReservaAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/reservas/:id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizarReservaAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarReservaAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarReservaAula(aulaId, id, dto, usuarioId);
  }

  @Patch(':aulaId/reservas/:id/estado')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  cambiarEstadoReservaAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoReservaAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstadoReservaAula(
      aulaId,
      id,
      dto.activo,
      usuarioId,
    );
  }

  @Get(':aulaId/ocupacion')
  @Permisos(PermisoSistema.AULAS_VER)
  consultarOcupacionAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Query()
    dto: ConsultarOcupacionAulaDto,
  ) {
    return this.aulasService.consultarOcupacionAula(aulaId, dto);
  }

  @Get(':aulaId/auditoria')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  listarAuditoriaAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,
  ) {
    return this.aulasService.listarAuditoriaAula(aulaId);
  }

  // =========================================================
  // DISPONIBILIDAD BASE POR PERIODO
  // =========================================================

  @Get(':aulaId/disponibilidades')
  @Permisos(PermisoSistema.AULAS_VER)
  listarDisponibilidadesAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Query('periodoId', ParseIntPipe)
    periodoId: number,
  ) {
    return this.aulasService.listarDisponibilidadesAula(aulaId, periodoId);
  }

  @Post(':aulaId/disponibilidades')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  crearDisponibilidadAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Body()
    dto: CrearDisponibilidadAulaDto,

    @UsuarioActualId()
    usuarioId: number,
  ) {
    return this.aulasService.crearDisponibilidadAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/disponibilidades/:id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizarDisponibilidadAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Param('id', ParseIntPipe)
    id: number,

    @Body()
    dto: ActualizarDisponibilidadAulaDto,

    @UsuarioActualId()
    usuarioId: number,
  ) {
    return this.aulasService.actualizarDisponibilidadAula(
      aulaId,
      id,
      dto,
      usuarioId,
    );
  }

  @Delete(':aulaId/disponibilidades/:id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  eliminarDisponibilidadAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Param('id', ParseIntPipe)
    id: number,

    @UsuarioActualId()
    usuarioId: number,
  ) {
    return this.aulasService.eliminarDisponibilidadAula(aulaId, id, usuarioId);
  }

  @Get(':id')
  @Permisos(PermisoSistema.AULAS_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.aulasService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  crear(@Body() dto: CrearAulaDto, @UsuarioActualId() usuarioId: number) {
    return this.aulasService.crear(dto, usuarioId);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizar(id, dto, usuarioId);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.AULAS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstado(id, dto.activo, usuarioId);
  }
}
