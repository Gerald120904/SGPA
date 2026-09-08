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
import { ActualizarOptativaDto } from './dto/actualizar-optativa.dto';
import { CambiarEstadoOptativaDto } from './dto/cambiar-estado-optativa.dto';
import { CrearOptativaDto } from './dto/crear-optativa.dto';
import { OptativasService } from './optativas.service';

@Controller('optativas')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class OptativasController {
  constructor(private readonly service: OptativasService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearOptativaDto) {
    return this.service.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarOptativaDto,
  ) {
    return this.service.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoOptativaDto,
  ) {
    return this.service.cambiarEstado(id, dto.activo);
  }
}
