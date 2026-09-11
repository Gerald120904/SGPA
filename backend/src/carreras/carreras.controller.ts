import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';
import { CambiarEstadoCarreraDto } from './dto/cambiar-estado-carrera.dto';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { CarrerasService } from './carreras.service';

@Controller('carreras')
@UseGuards(AuthGuard, PermisosGuard)
export class CarrerasController {
  constructor(private readonly carrerasService: CarrerasService) {}

  @Get()
  @Permisos(PermisoSistema.CARRERAS_VER)
  listar() {
    return this.carrerasService.listar();
  }

  @Get(':id')
  @Permisos(PermisoSistema.CARRERAS_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.carrerasService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.CARRERAS_GESTIONAR)
  crear(@Body() dto: CrearCarreraDto) {
    return this.carrerasService.crear(dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.CARRERAS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCarreraDto,
  ) {
    return this.carrerasService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.CARRERAS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCarreraDto,
  ) {
    return this.carrerasService.cambiarEstado(id, dto.activo);
  }
}
