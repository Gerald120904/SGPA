import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarAreaAcademicaDto } from './dto/actualizar-area-academica.dto';
import { ActualizarAsignacionAcademicaDto } from './dto/actualizar-asignacion-academica.dto';
import { AsociarCarreraAreaDto } from './dto/asociar-carrera-area.dto';
import { CrearAreaAcademicaDto } from './dto/crear-area-academica.dto';
import { CrearAsignacionAcademicaDto } from './dto/crear-asignacion-academica.dto';
import { InactivarAsignacionAcademicaDto } from './dto/inactivar-asignacion-academica.dto';
import { EstructuraAcademicaService } from './estructura-academica.service';

@Controller('estructura-academica')
@UseGuards(AuthGuard, RolesGuard)
export class EstructuraAcademicaController {
  constructor(private readonly estructuraService: EstructuraAcademicaService) {}

  // --- Áreas Académicas ---

  @Post('areas')
  @Roles(RolSistema.ADMIN_GLOBAL)
  crearArea(@Body() dto: CrearAreaAcademicaDto) {
    return this.estructuraService.crearArea(dto);
  }

  @Get('areas')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  listarAreas() {
    return this.estructuraService.listarAreas();
  }

  @Get('areas/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  obtenerArea(@Param('id', ParseIntPipe) id: number) {
    return this.estructuraService.obtenerAreaPorId(id);
  }

  @Patch('areas/:id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  actualizarArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAreaAcademicaDto,
  ) {
    return this.estructuraService.actualizarArea(id, dto);
  }

  // --- Relación Área ↔ Carrera ---

  @Post('areas/:id/carreras')
  @Roles(RolSistema.ADMIN_GLOBAL)
  asociarCarreraArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsociarCarreraAreaDto,
  ) {
    return this.estructuraService.asociarCarreraArea(id, dto.carreraId);
  }

  @Delete('areas/:id/carreras/:carreraId')
  @Roles(RolSistema.ADMIN_GLOBAL)
  desasociarCarreraArea(
    @Param('id', ParseIntPipe) id: number,
    @Param('carreraId', ParseIntPipe) carreraId: number,
  ) {
    return this.estructuraService.desasociarCarreraArea(id, carreraId);
  }

  @Get('areas/:id/carreras')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  listarCarrerasDeArea(@Param('id', ParseIntPipe) id: number) {
    return this.estructuraService.listarCarrerasDeArea(id);
  }

  // --- Asignaciones Académicas ---

  @Post('asignaciones')
  @Roles(RolSistema.ADMIN_GLOBAL)
  crearAsignacion(@Body() dto: CrearAsignacionAcademicaDto) {
    return this.estructuraService.crearAsignacion(dto);
  }

  @Get('asignaciones')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  listarAsignaciones(@Query('usuarioId') usuarioId?: number) {
    return this.estructuraService.listarAsignaciones(
      usuarioId ? Number(usuarioId) : undefined,
    );
  }

  @Get('asignaciones/:id')
  @Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
  obtenerAsignacion(@Param('id', ParseIntPipe) id: number) {
    return this.estructuraService.obtenerAsignacionPorId(id);
  }

  @Patch('asignaciones/:id')
  @Roles(RolSistema.ADMIN_GLOBAL)
  actualizarAsignacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAsignacionAcademicaDto,
  ) {
    return this.estructuraService.actualizarAsignacion(id, dto);
  }

  @Patch('asignaciones/:id/inactivar')
  @Roles(RolSistema.ADMIN_GLOBAL)
  inactivarAsignacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InactivarAsignacionAcademicaDto,
  ) {
    return this.estructuraService.inactivarAsignacion(id, dto);
  }
}
