import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolSistema } from '../auth/constants/roles.constants';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar() {
    return this.usuariosService.listar();
  }
}
