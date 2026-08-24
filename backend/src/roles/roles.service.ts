import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ROLES_SISTEMA } from '../auth/constants/roles.constants';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
  ) {}

  async listar(): Promise<Rol[]> {
    return this.rolRepository.find({
      where: {
        activo: true,
        nombre: In(ROLES_SISTEMA),
      },
      order: {
        id: 'ASC',
      },
    });
  }
}
