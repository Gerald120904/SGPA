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
import { ActualizarPeriodoAcademicoDto } from './dto/actualizar-periodo-academico.dto';
import { CambiarEstadoPeriodoAcademicoDto } from './dto/cambiar-estado-periodo-academico.dto';
import { CrearPeriodoAcademicoDto } from './dto/crear-periodo-academico.dto';
import { PeriodosAcademicosService } from './periodos-academicos.service';

@Controller('periodos-academicos')
@UseGuards(AuthGuard, PermisosGuard)
export class PeriodosAcademicosController {
  constructor(
    private readonly periodosAcademicosService: PeriodosAcademicosService,
  ) {}

  @Get()
  @Permisos(PermisoSistema.PERIODOS_VER)
  listar() {
    return this.periodosAcademicosService.listar();
  }

  @Get(':id')
  @Permisos(PermisoSistema.PERIODOS_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.periodosAcademicosService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.PERIODOS_GESTIONAR)
  crear(@Body() dto: CrearPeriodoAcademicoDto) {
    return this.periodosAcademicosService.crear(dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.PERIODOS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPeriodoAcademicoDto,
  ) {
    return this.periodosAcademicosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.PERIODOS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPeriodoAcademicoDto,
  ) {
    return this.periodosAcademicosService.cambiarEstado(id, dto.estado);
  }
}
