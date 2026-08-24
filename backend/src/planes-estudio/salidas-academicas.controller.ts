import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarAsignaturasSalidaDto } from './dto/actualizar-asignaturas-salida.dto';
import { ActualizarSalidaAcademicaDto } from './dto/actualizar-salida-academica.dto';
import { CambiarEstadoSalidaAcademicaDto } from './dto/cambiar-estado-salida-academica.dto';
import { CrearSalidaAcademicaDto } from './dto/crear-salida-academica.dto';
import { SalidasAcademicasService } from './salidas-academicas.service';

@Controller('planes-estudio/:planId/salidas-academicas')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class SalidasAcademicasController {
  constructor(private readonly service: SalidasAcademicasService) {}

  @Get()
  listar(@Param('planId', ParseIntPipe) planId: number) {
    return this.service.listar(planId);
  }

  @Get(':id')
  obtener(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.obtenerPorId(planId, id);
  }

  @Post()
  crear(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() dto: CrearSalidaAcademicaDto,
  ) {
    return this.service.crear(planId, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarSalidaAcademicaDto,
  ) {
    return this.service.actualizar(planId, id, dto);
  }

  @Put(':id/asignaturas')
  reemplazarAsignaturas(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarAsignaturasSalidaDto,
  ) {
    return this.service.reemplazarAsignaturas(planId, id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoSalidaAcademicaDto,
  ) {
    return this.service.cambiarEstado(planId, id, dto.activo);
  }
}
