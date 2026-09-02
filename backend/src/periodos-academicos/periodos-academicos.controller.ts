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
import { ActualizarPeriodoAcademicoDto } from './dto/actualizar-periodo-academico.dto';
import { CambiarEstadoPeriodoAcademicoDto } from './dto/cambiar-estado-periodo-academico.dto';
import { CrearPeriodoAcademicoDto } from './dto/crear-periodo-academico.dto';
import { PeriodosAcademicosService } from './periodos-academicos.service';

@Controller('periodos-academicos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class PeriodosAcademicosController {
  constructor(
    private readonly periodosAcademicosService: PeriodosAcademicosService,
  ) {}

  @Get()
  listar() {
    return this.periodosAcademicosService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.periodosAcademicosService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearPeriodoAcademicoDto) {
    return this.periodosAcademicosService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPeriodoAcademicoDto,
  ) {
    return this.periodosAcademicosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoPeriodoAcademicoDto,
  ) {
    return this.periodosAcademicosService.cambiarEstado(id, dto.estado);
  }
}
