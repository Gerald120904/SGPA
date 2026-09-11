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
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { ActualizarCursoDto } from './dto/actualizar-curso.dto';
import { CambiarEstadoCursoDto } from './dto/cambiar-estado-curso.dto';
import { CrearCursoDto } from './dto/crear-curso.dto';
import { ListarAsignaturasDisponiblesDto } from './dto/listar-asignaturas-disponibles.dto';
import { CursosService } from './cursos.service';

@Controller('cursos')
@UseGuards(AuthGuard, PermisosGuard)
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Get()
  @Permisos(PermisoSistema.CURSOS_VER)
  listar() {
    return this.cursosService.listar();
  }

  @Get('asignaturas-disponibles')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  listarAsignaturasDisponibles(
    @Query() filtros: ListarAsignaturasDisponiblesDto,
  ) {
    return this.cursosService.listarAsignaturasDisponibles(filtros);
  }

  @Get(':id')
  @Permisos(PermisoSistema.CURSOS_VER)
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.cursosService.obtenerPorId(id);
  }

  @Post()
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  crear(@Body() dto: CrearCursoDto) {
    return this.cursosService.crear(dto);
  }

  @Patch(':id')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCursoDto,
  ) {
    return this.cursosService.actualizar(id, dto);
  }

  @Patch(':id/estado')
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoCursoDto,
  ) {
    return this.cursosService.cambiarEstado(id, dto.activo);
  }
}
