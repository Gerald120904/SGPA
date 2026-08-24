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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActualizarCarreraDto } from './dto/actualizar-carrera.dto';
import { CambiarEstadoCarreraDto } from './dto/cambiar-estado-carrera.dto';
import { CrearCarreraDto } from './dto/crear-carrera.dto';
import { CarrerasService } from './carreras.service';

@Controller('carreras')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class CarrerasController {
  constructor(private readonly carrerasService: CarrerasService) {}

  @Get()
  listar() {
    return this.carrerasService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.carrerasService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearCarreraDto) {
    return this.carrerasService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCarreraDto,
  ) {
    return this.carrerasService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCarreraDto,
  ) {
    return this.carrerasService.cambiarEstado(id, dto.activo);
  }
}
