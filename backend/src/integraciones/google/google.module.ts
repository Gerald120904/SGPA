import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityModule } from '../../auth/security.module';
import { PermisosModule } from '../../permisos/permisos.module';
import { GoogleConexionUsuario } from './entities/google-conexion-usuario.entity';
import { GoogleOauthEstado } from './entities/google-oauth-estado.entity';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthService } from './google-oauth.service';
import { GoogleFormsClientService } from './google-forms-client.service';
import { GoogleDriveClientService } from './google-drive-client.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GoogleConexionUsuario,
      GoogleOauthEstado,
    ]),
    SecurityModule,
    PermisosModule,
  ],
  controllers: [GoogleOauthController],
  providers: [
    GoogleOauthService,
    GoogleFormsClientService,
    GoogleDriveClientService,
  ],
  exports: [
    GoogleOauthService,
    GoogleFormsClientService,
    GoogleDriveClientService,
  ],
})
export class GoogleModule {}
