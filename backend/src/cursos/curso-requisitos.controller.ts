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
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CursoRequisitosService } from './curso-requisitos.service';
import { CrearCursoRequisitoDto } from './dto/crear-curso-requisito.dto';

@Controller('cursos/:cursoId/requisitos')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL, RolSistema.COORDINADOR)
export class CursoRequisitosController {
  constructor(private readonly service: CursoRequisitosService) {}

  @Get()
  listar(
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
  ) {
    return this.service.listar(cursoId);
  }

  @Post()
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
  async eliminar(
    @Param('cursoId', ParseIntPipe)
    cursoId: number,
    @Param('id', ParseIntPipe)
    id: number,
  ) {
    await this.service.eliminar(cursoId, id);
  }
}
