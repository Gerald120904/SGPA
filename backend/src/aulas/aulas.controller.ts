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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
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
@UseGuards(AuthGuard, RolesGuard)
export class AulasController {
  constructor(private readonly aulasService: AulasService) {}

  @Post('buscar-disponibles')
  @HttpCode(200)
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  buscarAulasDisponibles(@Body() dto: BuscarAulasDisponiblesDto) {
    return this.aulasService.buscarAulasDisponibles(dto);
  }

  @Post(':aulaId/evaluar-asignacion')
  @HttpCode(200)
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  evaluarAulaParaAsignacion(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Body()
    dto: BuscarAulasDisponiblesDto,
  ) {
    return this.aulasService.evaluarAulaParaAsignacion(aulaId, dto);
  }

  @Get('equipamientos')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listarEquipamientos() {
    return this.aulasService.listarEquipamientos();
  }

  @Get('equipamientos/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  obtenerEquipamientoPorId(@Param('id', ParseIntPipe) id: number) {
    return this.aulasService.obtenerEquipamientoPorId(id);
  }

  @Post('equipamientos')
  @Roles(RolSistema.ADMIN_GLOBAL)
  crearEquipamiento(
    @Body() dto: CrearEquipamientoDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearEquipamiento(dto, usuarioId);
  }

  @Patch('equipamientos/:id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  actualizarEquipamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEquipamientoDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarEquipamiento(id, dto, usuarioId);
  }

  @Patch('equipamientos/:id/estado')
  @Roles(RolSistema.ADMIN_GLOBAL)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listar(@Query() filtros: FiltrarAulasDto) {
    return this.aulasService.listar(filtros);
  }

  @Get(':aulaId/equipamientos')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listarEquipamientoAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarEquipamientoAula(aulaId);
  }

  @Post(':aulaId/equipamientos')
  @Roles(RolSistema.ADMIN_GLOBAL)
  asignarEquipamientoAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: AsignarEquipamientoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.asignarEquipamientoAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/equipamientos/:equipamientoId')
  @Roles(RolSistema.ADMIN_GLOBAL)
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
  @Roles(RolSistema.ADMIN_GLOBAL)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listarIndisponibilidadesAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarIndisponibilidadesAula(aulaId);
  }

  @Get(':aulaId/indisponibilidades/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  obtenerIndisponibilidadPorId(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aulasService.obtenerIndisponibilidadPorId(aulaId, id);
  }

  @Post(':aulaId/indisponibilidades')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  crearIndisponibilidadAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: CrearIndisponibilidadAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearIndisponibilidadAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/indisponibilidades/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listarReservasAula(@Param('aulaId', ParseIntPipe) aulaId: number) {
    return this.aulasService.listarReservasAula(aulaId);
  }

  @Get(':aulaId/reservas/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  obtenerReservaPorId(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.aulasService.obtenerReservaPorId(aulaId, id);
  }

  @Post(':aulaId/reservas')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  crearReservaAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Body() dto: CrearReservaAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.crearReservaAula(aulaId, dto, usuarioId);
  }

  @Patch(':aulaId/reservas/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  actualizarReservaAula(
    @Param('aulaId', ParseIntPipe) aulaId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarReservaAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizarReservaAula(aulaId, id, dto, usuarioId);
  }

  @Patch(':aulaId/reservas/:id/estado')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  consultarOcupacionAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Query()
    dto: ConsultarOcupacionAulaDto,
  ) {
    return this.aulasService.consultarOcupacionAula(aulaId, dto);
  }

  @Get(':aulaId/auditoria')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  listarDisponibilidadesAula(
    @Param('aulaId', ParseIntPipe)
    aulaId: number,

    @Query('periodoId', ParseIntPipe)
    periodoId: number,
  ) {
    return this.aulasService.listarDisponibilidadesAula(aulaId, periodoId);
  }

  @Post(':aulaId/disponibilidades')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
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
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR, RolSistema.PROFESOR)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.aulasService.obtenerPorId(id);
  }

  @Post()
  @Roles(RolSistema.ADMIN_GLOBAL)
  crear(@Body() dto: CrearAulaDto, @UsuarioActualId() usuarioId: number) {
    return this.aulasService.crear(dto, usuarioId);
  }

  @Patch(':id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.actualizar(id, dto, usuarioId);
  }

  @Patch(':id/estado')
  @Roles(RolSistema.ADMIN_GLOBAL)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoAulaDto,
    @UsuarioActualId() usuarioId: number,
  ) {
    return this.aulasService.cambiarEstado(id, dto.activo, usuarioId);
  }
}
