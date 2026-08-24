import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolSistema } from '../auth/constants/roles.constants';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(AuthGuard, RolesGuard)
@Roles(RolSistema.ADMIN_GLOBAL)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  listar() {
    return this.rolesService.listar();
  }
}
