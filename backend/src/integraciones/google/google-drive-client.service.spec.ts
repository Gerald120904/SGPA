import { google } from 'googleapis';
import { GoogleDriveClientService } from './google-drive-client.service';
import { GoogleOauthService } from './google-oauth.service';

jest.mock('googleapis', () => ({
  google: {
    drive: jest.fn(),
  },
}));

describe('GoogleDriveClientService', () => {
  let service: GoogleDriveClientService;
  let googleOauthService: {
    obtenerClienteAutorizado: jest.Mock;
  };
  let driveClient: {
    permissions: {
      create: jest.Mock;
      list: jest.Mock;
    };
  };

  beforeEach(() => {
    googleOauthService = {
      obtenerClienteAutorizado: jest.fn().mockResolvedValue('oauth-client'),
    };
    driveClient = {
      permissions: {
        create: jest.fn(),
        list: jest.fn(),
      },
    };

    jest.mocked(google.drive).mockReturnValue(driveClient as never);
    service = new GoogleDriveClientService(
      googleOauthService as unknown as GoogleOauthService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('crea un permiso de respuesta pública con type=anyone, role=reader y view=published', async () => {
    driveClient.permissions.create.mockResolvedValue({
      data: {
        id: 'permission-1',
        type: 'anyone',
        role: 'reader',
        view: 'published',
      },
    });

    await service.permitirCualquieraConEnlaceResponder(7, 'form-1');

    expect(googleOauthService.obtenerClienteAutorizado).toHaveBeenCalledWith(7);
    expect(google.drive).toHaveBeenCalledWith({
      version: 'v3',
      auth: 'oauth-client',
    });
    expect(driveClient.permissions.create).toHaveBeenCalledWith({
      fileId: 'form-1',
      requestBody: {
        type: 'anyone',
        role: 'reader',
        view: 'published',
      },
      fields: 'id,type,role,view',
    });
  });

  it('permiteCualquieraConEnlace devuelve true si el permiso existe', async () => {
    driveClient.permissions.list.mockResolvedValue({
      data: {
        permissions: [
          { type: 'user', role: 'writer' },
          { type: 'anyone', role: 'reader', view: 'published' },
        ],
      },
    });

    await expect(service.permiteCualquieraConEnlace(7, 'form-1')).resolves.toBe(
      true,
    );
    expect(driveClient.permissions.list).toHaveBeenCalledWith({
      fileId: 'form-1',
      includePermissionsForView: 'published',
      fields: 'permissions(id,type,role,view)',
    });
  });

  it('permiteCualquieraConEnlace devuelve false si el permiso no existe', async () => {
    driveClient.permissions.list.mockResolvedValue({
      data: {
        permissions: [
          { type: 'anyone', role: 'writer', view: 'published' },
          { type: 'anyone', role: 'reader' },
        ],
      },
    });

    await expect(service.permiteCualquieraConEnlace(7, 'form-1')).resolves.toBe(
      false,
    );
  });
});
