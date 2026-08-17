import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { Rol } from './entities/rol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rol,
    ]),
  ],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
