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
import { UsuarioActualId } from '../auth/decorators/usuario-actual-id.decorator';
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
    @UsuarioActualId() usuarioId: number,
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
  ) {
    return this.service.listar(cursoId, usuarioId);
  }

  @Post()
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  crear(
    @UsuarioActualId() usuarioId: number,
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
    @Body()
    dto: CrearCursoRequisitoDto,
  ) {
    return this.service.crear(cursoId, dto, usuarioId);
  }

  @Delete(':id')
  @HttpCode(204)
  @Permisos(PermisoSistema.CURSOS_GESTIONAR)
  async eliminar(
    @UsuarioActualId() usuarioId: number,
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    await this.service.eliminar(cursoId, id, usuarioId);
  }
}
