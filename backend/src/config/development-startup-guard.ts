import { createServer, Server } from 'net';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';

type Settings = NodeJS.ProcessEnv;

export type DevelopmentStartupGuard = {
  releasePort(): Promise<void>;
  close(): Promise<void>;
};

function isEnabled(settings: Settings): boolean {
  return settings.SGPA_START_PROFILE === 'development' &&
    settings.SGPA_AUTO_SCHEMA_SYNC_DEV?.toLowerCase() === 'true';
}

function portNumber(settings: Settings): number {
  const port = Number(settings.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un puerto TCP válido antes de sincronizar el esquema.');
  }
  return port;
}

async function reservePort(port: number): Promise<Server> {
  const server = createServer((socket) => socket.destroy());
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    return server;
  } catch {
    throw new Error(`El puerto ${port} ya está ocupado; se canceló el arranque antes de modificar el esquema.`);
  }
}

async function releasePort(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function hasGlobalProcessGrant(rows: RowDataPacket[]): boolean {
  return rows.some((row) => {
    const grant = String(Object.values(row)[0] ?? '').toUpperCase();
    return grant.includes(' ON *.* ') && /\b(?:PROCESS|ALL PRIVILEGES)\b/.test(grant);
  });
}

export async function acquireDevelopmentStartupGuard(settings: Settings): Promise<DevelopmentStartupGuard | undefined> {
  if (!isEnabled(settings)) return undefined;
  if (settings.DB_SYNCHRONIZE !== 'false' || settings.NODE_ENV !== 'development' ||
    settings.SGPA_RUNTIME_ENV !== 'development' || !settings.DB_DATABASE) {
    throw new Error('La sincronización exige desarrollo local y DB_SYNCHRONIZE=false.');
  }

  const port = await reservePort(portNumber(settings));
  let connection: Connection | undefined;
  try {
    connection = await createConnection({
      host: settings.DB_HOST, port: Number(settings.DB_PORT || 3306),
      user: settings.DB_USERNAME, password: settings.DB_PASSWORD,
      database: settings.DB_DATABASE,
    });
    const [grants] = await connection.query<RowDataPacket[]>('SHOW GRANTS FOR CURRENT_USER()');
    if (!hasGlobalProcessGrant(grants)) {
      throw new Error('Se necesita el permiso global PROCESS para descartar otras conexiones antes de cambiar el esquema.');
    }
    const [others] = await connection.query<RowDataPacket[]>(
      'SELECT ID FROM information_schema.PROCESSLIST WHERE DB = ? AND ID <> CONNECTION_ID() LIMIT 1',
      [settings.DB_DATABASE],
    );
    if (others.length) {
      throw new Error(`Hay otra conexión a ${settings.DB_DATABASE}; cierre los otros servidores o clientes antes de cambiar el esquema.`);
    }
    let portReleased = false;
    return {
      async releasePort() {
        if (!portReleased) {
          await releasePort(port);
          portReleased = true;
        }
      },
      async close() {
        try { await releasePort(port); }
        finally { await connection?.end(); }
      },
    };
  } catch (error) {
    try { await connection?.end(); }
    finally { await releasePort(port); }
    throw error;
  }
}
