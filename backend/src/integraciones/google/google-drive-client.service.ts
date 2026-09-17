import { Injectable } from '@nestjs/common';
import { drive_v3, google } from 'googleapis';
import { GoogleOauthService } from './google-oauth.service';

@Injectable()
export class GoogleDriveClientService {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  private async getClient(usuarioId: number): Promise<drive_v3.Drive> {
    const auth =
      await this.googleOauthService.obtenerClienteAutorizado(usuarioId);

    return google.drive({
      version: 'v3',
      auth,
    });
  }

  async permitirCualquieraConEnlaceResponder(
    usuarioId: number,
    formId: string,
  ) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.permissions.create({
      fileId: formId,
      requestBody: {
        type: 'anyone',
        role: 'reader',
        view: 'published',
      },
      fields: 'id,type,role,view',
    });

    return data;
  }

  async permiteCualquieraConEnlace(
    usuarioId: number,
    formId: string,
  ): Promise<boolean> {
    const client = await this.getClient(usuarioId);

    const { data } = await client.permissions.list({
      fileId: formId,
      includePermissionsForView: 'published',
      fields: 'permissions(id,type,role,view)',
    });

    return (data.permissions ?? []).some(
      (permiso) =>
        permiso.type === 'anyone' &&
        permiso.role === 'reader' &&
        permiso.view === 'published',
    );
  }

  async renombrarArchivo(
    usuarioId: number,
    fileId: string,
    nombre: string,
  ) {
    const client =
      await this.getClient(usuarioId);

    const { data } =
      await client.files.update({
        fileId,
        requestBody: {
          name: nombre,
        },
        fields: 'id,name',
      });

    return data;
  }
}
