import { Injectable } from '@nestjs/common';
import { forms_v1, google } from 'googleapis';
import { GoogleOauthService } from './google-oauth.service';

@Injectable()
export class GoogleFormsClientService {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  private async getClient(usuarioId: number): Promise<forms_v1.Forms> {
    const auth =
      await this.googleOauthService.obtenerClienteAutorizado(usuarioId);

    return google.forms({
      version: 'v1',
      auth,
    });
  }

  async crearFormulario(usuarioId: number, titulo: string) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.forms.create({
      requestBody: {
        info: {
          title: titulo,
        },
      },
    });

    if (!data.formId) {
      throw new Error('Google no devolvió el identificador del formulario');
    }

    return data;
  }

  async obtenerFormulario(usuarioId: number, formId: string) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.forms.get({
      formId,
    });

    return data;
  }

  async actualizarFormulario(
    usuarioId: number,
    formId: string,
    requests: forms_v1.Schema$Request[],
  ) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.forms.batchUpdate({
      formId,
      requestBody: {
        includeFormInResponse: true,
        requests,
      },
    });

    return data;
  }

  async publicarFormulario(usuarioId: number, formId: string) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.forms.setPublishSettings({
      formId,
      requestBody: {
        publishSettings: {
          publishState: {
            isPublished: true,
            isAcceptingResponses: true,
          },
        },
      },
    });

    return data;
  }

  async cerrarFormulario(usuarioId: number, formId: string) {
    const client = await this.getClient(usuarioId);

    const { data } = await client.forms.setPublishSettings({
      formId,
      requestBody: {
        publishSettings: {
          publishState: {
            isPublished: true,
            isAcceptingResponses: false,
          },
        },
      },
    });

    return data;
  }

  async listarRespuestas(usuarioId: number, formId: string) {
    const client = await this.getClient(usuarioId);
    const respuestas: forms_v1.Schema$FormResponse[] = [];
    let pageToken: string | undefined;

    do {
      const { data } = await client.forms.responses.list({
        formId,
        pageToken,
      });

      respuestas.push(...(data.responses ?? []));
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);

    return respuestas;
  }
}
