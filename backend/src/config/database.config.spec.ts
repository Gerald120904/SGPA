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

  it('mantiene synchronize desactivado en sgpa aunque la configuración local lo solicite', () => {
    expect(configuracion({ DB_DATABASE: 'sgpa', DB_SYNCHRONIZE: 'true' }).synchronize).toBe(false);
  });

  it('bloquea synchronize en cualquier otra base no aislada', () => {
    expect(() => configuracion({ DB_DATABASE: 'otra', DB_SYNCHRONIZE: 'true' }))
      .toThrow('DB_SYNCHRONIZE=true está prohibido');
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

  it('respeta DB_SYNCHRONIZE=false en sgpa', () => {
    const resultado = configuracion({
      DB_DATABASE: 'sgpa',
      DB_SYNCHRONIZE: 'false',
    });

    expect(resultado.synchronize).toBe(false);
  });

  it('acepta synchronize únicamente en sgpa_test con modo de pruebas', () => {
    const resultado = configuracion({
      DB_DATABASE: 'sgpa_test',
      SGPA_TEST_MODE: 'true',
      DB_SYNCHRONIZE: 'true',
    });

    expect(resultado.synchronize).toBe(true);
  });
});
