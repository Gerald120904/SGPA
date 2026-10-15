import { ConfigService } from '@nestjs/config';
import { crearConfiguracionBaseDatos } from './database.config';

function configuracion(valores: Record<string, string>) {
  return crearConfiguracionBaseDatos(new ConfigService(valores));
}

describe('crearConfiguracionBaseDatos', () => {
  it('bloquea modo de pruebas contra la base original', () => {
    expect(() =>
      configuracion({
        DB_DATABASE: 'sgpa',
        SGPA_TEST_MODE: 'true',
        DB_SYNCHRONIZE: 'false',
      }),
    ).toThrow('DB_DATABASE debe ser sgpa_test');
  });

  it('bloquea synchronize fuera de la base aislada', () => {
    expect(() =>
      configuracion({
        DB_DATABASE: 'sgpa',
        SGPA_TEST_MODE: 'false',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow('solo está permitido para sgpa_test');
  });

  it('permite preparar el esquema aislado de pruebas', () => {
    const resultado = configuracion({
      DB_DATABASE: 'sgpa_test',
      SGPA_TEST_MODE: 'true',
      DB_SYNCHRONIZE: 'true',
      DB_PORT: '3306',
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        database: 'sgpa_test',
        synchronize: true,
      }),
    );
  });

  it('desactiva synchronize por defecto', () => {
    const resultado = configuracion({
      DB_DATABASE: 'sgpa',
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        database: 'sgpa',
        synchronize: false,
      }),
    );
  });
});

