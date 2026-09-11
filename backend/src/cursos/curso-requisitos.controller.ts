import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { PermisoSistema } from '../permisos/constants/permisos.constant';
import { Permisos } from '../permisos/decorators/permisos.decorator';
import { PermisosGuard } from '../permisos/guards/permisos.guard';
import { CursoRequisitosService } from './curso-requisitos.service';
import { CrearCursoRequisitoDto } from './dto/crear-curso-requisito.dto';

@Controller('cursos/:cursoId/requisitos')
@UseGuards(AuthGuard, PermisosGuard)
export class CursoRequisitosController {
  constructor(private readonly service: CursoRequisitosService) {}

  @Get()
  @Permisos(PermisoSistema.CURSOS_VER)
  listar(
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
  ) {
    return this.service.listar(cursoId);
  }

  @Post()
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  crear(
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
    @Body()
    dto: CrearCursoRequisitoDto,
  ) {
    return this.service.crear(cursoId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  async eliminar(
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    await this.service.eliminar(cursoId, id);
  }
}
