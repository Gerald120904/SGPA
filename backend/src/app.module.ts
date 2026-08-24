import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { EstudiantesModule } from './estudiantes/estudiantes.module';
import { CarrerasModule } from './carreras/carreras.module';
import { CursosModule } from './cursos/cursos.module';
import { ProfesoresModule } from './profesores/profesores.module';
import { AulasModule } from './aulas/aulas.module';
import { PeriodosAcademicosModule } from './periodos-academicos/periodos-academicos.module';
import { ProyeccionModule } from './proyeccion/proyeccion.module';
import { OfertaAcademicaModule } from './oferta-academica/oferta-academica.module';
import { PlanesEstudioModule } from './planes-estudio/planes-estudio.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    UsuariosModule,
    RolesModule,
    AuthModule,
    EstudiantesModule,
    CarrerasModule,
    CursosModule,
    PlanesEstudioModule,
    ProfesoresModule,
    AulasModule,
    PeriodosAcademicosModule,
    ProyeccionModule,
    OfertaAcademicaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
