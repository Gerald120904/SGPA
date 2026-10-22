import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EnviarRespuestaPublicaDto } from './dto/enviar-respuesta-publica.dto';
import { FormulariosPublicosService } from './formularios-publicos.service';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';

/**
 * Controlador de acceso público para estudiantes externos.
 * Expone únicamente las rutas públicas sin requerir autenticación JWT administrativa.
 * Protegido contra abusos por RateLimitPublicoGuard y validación estricta de DTOs.
 */
@Controller('formularios-publicos')
@UseGuards(RateLimitPublicoGuard)
export class FormulariosPublicosController {
  constructor(
    private readonly formulariosPublicosService: FormulariosPublicosService,
  ) {}

  /**
   * Consulta pública de un formulario por su token criptográfico.
   * Retorna el formulario, la carrera, el plan y el catálogo ordenado por nivel y ciclo.
   */
  @Get(':token')
  async consultarFormulario(@Param('token') token: string) {
    return await this.formulariosPublicosService.consultarFormularioPublico(
      token,
    );
  }

  /**
   * Envío público de respuestas por parte del estudiante.
   * Valida estrictamente prerrequisitos mediante el motor académico antes de persistir.
   */
  @Post(':token/respuestas')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async enviarRespuesta(
    @Param('token') token: string,
    @Body() dto: EnviarRespuestaPublicaDto,
  ) {
    return await this.formulariosPublicosService.registrarRespuestaPublica(
      token,
      dto,
    );
  }
}
