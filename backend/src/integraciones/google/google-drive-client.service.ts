import { Injectable } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';

@Injectable()
export class GoogleDriveClientService {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  // Estructura base para interactuar con Google Drive API
  // permisos para respondedores (type=anyone, role=reader, view=published)
}
