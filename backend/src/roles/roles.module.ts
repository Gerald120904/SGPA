import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesService } from './roles.service';
import { Rol } from './entities/rol.entity';
import { RolesController } from './roles.controller';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rol,
    ]),
    SecurityModule,
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
