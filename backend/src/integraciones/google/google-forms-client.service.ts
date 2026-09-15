import { Injectable } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';

@Injectable()
export class GoogleFormsClientService {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  // Estructura base para interactuar con Google Forms API
  // crear formulario, batchUpdate, obtener formulario, publicar, cerrar, listar respuestas
}
