import { forms_v1, google } from 'googleapis';
import { GoogleFormsClientService } from './google-forms-client.service';
import { GoogleOauthService } from './google-oauth.service';

jest.mock('googleapis', () => ({
  google: {
    forms: jest.fn(),
  },
}));

describe('GoogleFormsClientService', () => {
  let service: GoogleFormsClientService;
  let googleOauthService: {
    obtenerClienteAutorizado: jest.Mock;
  };
  let formsClient: {
    forms: {
      create: jest.Mock;
      get: jest.Mock;
      batchUpdate: jest.Mock;
      setPublishSettings: jest.Mock;
      responses: {
        list: jest.Mock;
      };
    };
  };

  beforeEach(() => {
    googleOauthService = {
      obtenerClienteAutorizado: jest.fn().mockResolvedValue('oauth-client'),
    };
    formsClient = {
      forms: {
        create: jest.fn(),
        get: jest.fn(),
        batchUpdate: jest.fn(),
        setPublishSettings: jest.fn(),
        responses: {
          list: jest.fn(),
        },
      },
    };

    jest.mocked(google.forms).mockReturnValue(formsClient as never);
    service = new GoogleFormsClientService(
      googleOauthService as unknown as GoogleOauthService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('crearFormulario manda el título del formulario', async () => {
    formsClient.forms.create.mockResolvedValue({
      data: {
        formId: 'form-1',
        info: {
          title: 'Admisión',
        },
      },
    });

    const resultado = await service.crearFormulario(7, 'Admisión');

    expect(googleOauthService.obtenerClienteAutorizado).toHaveBeenCalledWith(7);
    expect(google.forms).toHaveBeenCalledWith({
      version: 'v1',
      auth: 'oauth-client',
    });
    expect(formsClient.forms.create).toHaveBeenCalledWith({
      requestBody: {
        info: {
          title: 'Admisión',
        },
      },
    });
    expect(resultado.formId).toBe('form-1');
  });

  it('crearFormulario falla si Google no devuelve formId', async () => {
    formsClient.forms.create.mockResolvedValue({ data: {} });

    await expect(service.crearFormulario(7, 'Admisión')).rejects.toThrow(
      'Google no devolvió el identificador del formulario',
    );
  });

  it('obtenerFormulario usa forms.get', async () => {
    formsClient.forms.get.mockResolvedValue({
      data: { formId: 'form-1' },
    });

    await expect(service.obtenerFormulario(7, 'form-1')).resolves.toEqual({
      formId: 'form-1',
    });
    expect(formsClient.forms.get).toHaveBeenCalledWith({ formId: 'form-1' });
  });

  it('actualizarFormulario usa batchUpdate', async () => {
    const requests: forms_v1.Schema$Request[] = [
      {
        createItem: {
          item: { title: 'Nombre completo' },
          location: { index: 0 },
        },
      },
    ];
    formsClient.forms.batchUpdate.mockResolvedValue({
      data: { replies: [] },
    });

    await service.actualizarFormulario(7, 'form-1', requests);

    expect(formsClient.forms.batchUpdate).toHaveBeenCalledWith({
      formId: 'form-1',
      requestBody: {
        includeFormInResponse: true,
        requests,
      },
    });
  });

  it('publicarFormulario publica y acepta respuestas', async () => {
    formsClient.forms.setPublishSettings.mockResolvedValue({ data: {} });

    await service.publicarFormulario(7, 'form-1');

    expect(formsClient.forms.setPublishSettings).toHaveBeenCalledWith({
      formId: 'form-1',
      requestBody: {
        publishSettings: {
          publishState: {
            isPublished: true,
            isAcceptingResponses: true,
          },
        },
      },
    });
  });

  it('cerrarFormulario conserva la publicación y deja de aceptar respuestas', async () => {
    formsClient.forms.setPublishSettings.mockResolvedValue({ data: {} });

    await service.cerrarFormulario(7, 'form-1');

    expect(formsClient.forms.setPublishSettings).toHaveBeenCalledWith({
      formId: 'form-1',
      requestBody: {
        publishSettings: {
          publishState: {
            isPublished: true,
            isAcceptingResponses: false,
          },
        },
      },
    });
  });

  it('listarRespuestas acumula varias páginas', async () => {
    formsClient.forms.responses.list
      .mockResolvedValueOnce({
        data: {
          responses: [{ responseId: 'respuesta-1' }],
          nextPageToken: 'pagina-2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          responses: [{ responseId: 'respuesta-2' }],
        },
      });

    await expect(service.listarRespuestas(7, 'form-1')).resolves.toEqual([
      { responseId: 'respuesta-1' },
      { responseId: 'respuesta-2' },
    ]);
    expect(formsClient.forms.responses.list).toHaveBeenNthCalledWith(1, {
      formId: 'form-1',
      pageToken: undefined,
    });
    expect(formsClient.forms.responses.list).toHaveBeenNthCalledWith(2, {
      formId: 'form-1',
      pageToken: 'pagina-2',
    });
  });
});
