import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Interval } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { EstadoFormularioEstudiante } from './constants/estado-formulario-estudiante.constant';
import { ProveedorFormulario } from './constants/proveedor-formulario.constant';
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

    let procesados = 0;
    let respuestasNuevas = 0;
    let erroresCount = 0;
    let ultimoError: string | undefined;

    try {
      const formularios = await this.formularioRepository.find({
        where: {
          estado: EstadoFormularioEstudiante.PUBLICADO,
          proveedor: ProveedorFormulario.GOOGLE_FORMS,
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

          procesados++;
          await this.sincronizarFormulario(formulario);
        } catch (error) {
          erroresCount++;
          ultimoError = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `No se pudo sincronizar automáticamente el formulario ${formulario.id}: ${ultimoError}`,
          );
        }
      }

      if (typeof this.googleOauthService.registrarResultadoSync === 'function' && (procesados > 0 || erroresCount > 0)) {
        const resultadoFinal = erroresCount === 0 ? 'EXITOSO' : (procesados > erroresCount ? 'PARCIAL' : 'ERROR');
        await this.googleOauthService.registrarResultadoSync('AUTOMATICO', resultadoFinal, {
          formulariosProcesados: procesados,
          respuestasNuevas,
          detalleError: ultimoError,
        }).catch(() => null);
      }
    } catch (error) {
      this.logger.warn(
        `Error en sincronización automática de formularios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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
