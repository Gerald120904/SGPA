import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { FormularioEstudiante } from './entities/formulario-estudiante.entity';
import { FormulariosEstudiantesSyncService } from './formularios-estudiantes-sync.service';
import { GoogleOauthService } from '../integraciones/google/google-oauth.service';

@Injectable()
export class FormulariosEstudiantesAutoSyncService {
  private readonly logger = new Logger(
    FormulariosEstudiantesAutoSyncService.name,
  );

  private ejecutando = false;

  constructor(
    @InjectRepository(FormularioEstudiante)
    private readonly formularioRepository: Repository<FormularioEstudiante>,

    private readonly syncService: FormulariosEstudiantesSyncService,

    private readonly googleOauthService: GoogleOauthService,
  ) {}

  @Interval(60_000)
  async sincronizarAutomaticamente(): Promise<void> {
    if (this.ejecutando) {
      return;
    }

    this.ejecutando = true;

    try {
      const formularios = await this.formularioRepository.find({
        where: {
          estado: EstadoFormularioEstudiante.PUBLICADO,
        },
      });

      for (const formulario of formularios) {
        try {
          const puedeSincronizar =
            await this.googleOauthService.puedeSincronizarAutomaticamente(
              formulario.creadoPorUsuarioId,
            );

          if (!puedeSincronizar) {
            continue;
          }

          await this.sincronizarFormulario(formulario);
        } catch (error) {
          this.logger.warn(
            `No se pudo sincronizar automáticamente el formulario ${formulario.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.ejecutando = false;
    }
  }

  private async sincronizarFormulario(
    formulario: FormularioEstudiante,
  ): Promise<void> {
    const resultado = await this.syncService.sincronizarFormulario(formulario);

    if (resultado.nuevas > 0) {
      this.logger.log(
        `Formulario ${formulario.id}: ${resultado.nuevas} respuesta(s) nueva(s).`,
      );
    }
  }
}
