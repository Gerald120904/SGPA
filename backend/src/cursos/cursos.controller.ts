import {
  Body,
  Controller,
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
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CambiarEstadoCursoDto } from './dto/cambiar-estado-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { ListarAsignaturasDisponiblesDto } from './dto/listar-asignaturas-disponibles.dto';
import { CursosService } from './cursos.service';

@Controller('cursos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  listar() {
    return this.cursosService.listar();
  }

  @Get('asignaturas-disponibles')
  listarAsignaturasDisponibles(
    @Query() filtros: ListarAsignaturasDisponiblesDto,
  ) {
    return this.cursosService.listarAsignaturasDisponibles(filtros);
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.cursosService.obtenerPorId(id);
  }

  @Post()
  crear(@Body() dto: CrearCursoDto) {
    return this.cursosService.crear(dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCursoDto,
  ) {
    return this.cursosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCursoDto,
  ) {
    return this.cursosService.cambiarEstado(id, dto.activo);
  }
}
