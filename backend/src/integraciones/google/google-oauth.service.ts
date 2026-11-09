import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { google } from 'googleapis';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import * as crypto from 'crypto';
import { GoogleConexionUsuario } from './entities/google-conexion-usuario.entity';
import { GoogleOauthEstado } from './entities/google-oauth-estado.entity';
import { GoogleCuentaInstitucional, EstadoCuentaInstitucional } from './entities/google-cuenta-institucional.entity';
import { GoogleSyncLog } from './entities/google-sync-log.entity';
import { AlcanceJerarquicoService } from '../../permisos/alcance-jerarquico.service';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export type EstadoConexionGoogle =
  'CONECTADO' | 'REQUIERE_REAUTENTICACION' | 'DESCONECTADO';

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  constructor(
    @InjectRepository(GoogleConexionUsuario)
    private readonly googleConexionRepo: Repository<GoogleConexionUsuario>,
    @InjectRepository(GoogleOauthEstado)
    private readonly googleOauthEstadoRepo: Repository<GoogleOauthEstado>,
    private readonly configService: ConfigService,
    @Optional()
    @InjectRepository(GoogleCuentaInstitucional)
    private readonly institucionalRepo?: Repository<GoogleCuentaInstitucional>,
    @Optional()
    @InjectRepository(GoogleSyncLog)
    private readonly syncLogRepo?: Repository<GoogleSyncLog>,
    @Optional()
    private readonly alcanceJerarquico?: AlcanceJerarquicoService,
  ) {}

  private getOAuth2Client(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'GOOGLE_OAUTH_CLIENT_SECRET',
    );
    const redirectUri = this.configService.get<string>(
      'GOOGLE_OAUTH_REDIRECT_URI',
    );

    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Configuración de Google OAuth incompleta en las variables de entorno',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>(
      'GOOGLE_TOKEN_ENCRYPTION_KEY',
    );
    if (!rawKey) {
      throw new InternalServerErrorException(
        'GOOGLE_TOKEN_ENCRYPTION_KEY no configurada en las variables de entorno',
      );
    }

    if (rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    const base64Buf = Buffer.from(rawKey, 'base64');
    if (base64Buf.length === 32) {
      return base64Buf;
    }

    return crypto.createHash('sha256').update(rawKey).digest();
  }

  private cifrar(valor: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      iv,
    );
    let encrypted = cipher.update(valor, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}.${authTag}.${encrypted}`;
  }

  private descifrar(valorCifrado: string): string {
    const parts = valorCifrado.split('.');
    if (parts.length !== 3) {
      throw new InternalServerErrorException(
        'Formato de token cifrado inválido',
      );
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      iv,
    );
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async generarUrlAutorizacion(usuarioId: number): Promise<{ url: string }> {
    const oauthClient = this.getOAuth2Client();
    const { codeVerifier, codeChallenge } =
      await oauthClient.generateCodeVerifierAsync();

    const state = crypto.randomBytes(32).toString('hex');
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    const expiraAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const nuevoEstado = this.googleOauthEstadoRepo.create({
      usuarioId,
      stateHash,
      codeVerifierCifrado: this.cifrar(codeVerifier),
      expiraAt,
      usadoAt: null,
    });
    await this.googleOauthEstadoRepo.save(nuevoEstado);

    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: GOOGLE_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
    });

    return { url };
  }

  async procesarCallback(code: string, state: string): Promise<string> {
    if (!code || !state) {
      throw new BadRequestException('Parámetros code y state requeridos');
    }

    const stateHash = crypto.createHash('sha256').update(state).digest('hex');

    const oauthEstado = await this.googleOauthEstadoRepo.findOne({
      where: {
        stateHash,
        usadoAt: IsNull(),
        expiraAt: MoreThan(new Date()),
      },
    });

    if (!oauthEstado) {
      throw new BadRequestException(
        'El estado de autenticación es inválido, ha expirado o ya ha sido utilizado',
      );
    }

    oauthEstado.usadoAt = new Date();
    await this.googleOauthEstadoRepo.save(oauthEstado);

    const oauthClient = this.getOAuth2Client();
    const codeVerifier = this.descifrar(oauthEstado.codeVerifierCifrado);

    const { tokens } = await oauthClient.getToken({
      code,
      codeVerifier,
    });

    if (!tokens.id_token) {
      throw new BadRequestException(
        'Google no devolvió información de identidad.',
      );
    }

    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID'),
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new BadRequestException(
        'No fue posible identificar la cuenta de Google.',
      );
    }

    const googleEmail = payload.email;
    const googleSubject = payload.sub;

    if (state.startsWith('inst_')) {
      let refreshTokenCifrado: string | null = null;
      if (tokens.refresh_token) {
        refreshTokenCifrado = this.cifrar(tokens.refresh_token);
      }

      if (this.institucionalRepo) {
        let cuenta = await this.institucionalRepo.findOne({ where: {} });
        if (!cuenta) {
          cuenta = this.institucionalRepo.create({
            googleEmail,
            googleSubject,
            refreshTokenCifrado,
            scopes: GOOGLE_SCOPES,
            activo: true,
            conectadoAt: new Date(),
            revocadoAt: null,
            autorizadoPorUsuarioId: oauthEstado.usuarioId,
            ultimoError: null,
            ultimoSyncAt: null,
            syncExitosos: 0,
            syncFallidos: 0,
          });
        } else {
          cuenta.googleEmail = googleEmail;
          cuenta.googleSubject = googleSubject;
          if (refreshTokenCifrado) cuenta.refreshTokenCifrado = refreshTokenCifrado;
          cuenta.activo = true;
          cuenta.conectadoAt = new Date();
          cuenta.revocadoAt = null;
          cuenta.autorizadoPorUsuarioId = oauthEstado.usuarioId;
          cuenta.ultimoError = null;
        }
        await this.institucionalRepo.save(cuenta);
      }

      return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cuenta Institucional Google Conectada - SGPA</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; }
    .card { text-align: center; background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 420px; width: 90%; }
    h2 { color: #16a34a; margin-top: 0; margin-bottom: 0.75rem; }
    p { color: #475569; font-size: 0.95rem; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Cuenta Institucional de Google conectada</h2>
    <p>La cuenta principal autorizada (${googleEmail}) ha sido vinculada exitosamente. Ya puedes cerrar esta ventana y volver al SGPA.</p>
  </div>
</body>
</html>`;
    }

    let conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId: oauthEstado.usuarioId },
    });

    const refreshToken = tokens.refresh_token;

    const requiereReautenticacion = Boolean(
      conexion && !conexion.activo && conexion.refreshTokenCifrado,
    );

    if (
      !refreshToken &&
      (!conexion?.refreshTokenCifrado || requiereReautenticacion)
    ) {
      throw new BadRequestException(
        'Google no devolvió un token de actualización nuevo. Revoca el acceso de SGPA en tu cuenta de Google y vuelve a conectarla.',
      );
    }

    let refreshTokenCifrado: string | null = null;

    if (refreshToken) {
      refreshTokenCifrado = this.cifrar(refreshToken);
    } else if (conexion?.refreshTokenCifrado) {
      refreshTokenCifrado = conexion.refreshTokenCifrado;
    }

    if (!conexion) {
      conexion = this.googleConexionRepo.create({
        usuarioId: oauthEstado.usuarioId,
        googleEmail,
        googleSubject,
        refreshTokenCifrado,
        scopes: GOOGLE_SCOPES,
        activo: true,
        conectadoAt: new Date(),
        revocadoAt: null,
      });
    } else {
      conexion.googleEmail = googleEmail;
      conexion.googleSubject = googleSubject;
      conexion.refreshTokenCifrado = refreshTokenCifrado;
      conexion.scopes = GOOGLE_SCOPES;
      conexion.activo = true;
      conexion.conectadoAt = new Date();
      conexion.revocadoAt = null;
    }

    await this.googleConexionRepo.save(conexion);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Google Conectado - SGPA</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background-color: #f8fafc;
      color: #0f172a;
    }
    .card {
      text-align: center;
      background: white;
      padding: 2.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      max-width: 420px;
      width: 90%;
    }
    h2 {
      color: #16a34a;
      margin-top: 0;
      margin-bottom: 0.75rem;
    }
    p {
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>Google conectado correctamente</h2>
    <p>Ya puedes cerrar esta ventana y volver al SGPA.</p>
  </div>
</body>
</html>`;
  }

  async obtenerEstado(usuarioId: number): Promise<{
    conectado: boolean;
    requiereReautenticacion: boolean;
    estado: EstadoConexionGoogle;
    googleEmail: string | null;
    conectadoAt: Date | null;
  }> {
    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId },
    });

    const conectado = Boolean(conexion?.activo && conexion.refreshTokenCifrado);
    const requiereReautenticacion = Boolean(
      conexion && !conexion.activo && conexion.refreshTokenCifrado,
    );
    const estado: EstadoConexionGoogle = conectado
      ? 'CONECTADO'
      : requiereReautenticacion
        ? 'REQUIERE_REAUTENTICACION'
        : 'DESCONECTADO';

    return {
      conectado,
      requiereReautenticacion,
      estado,
      googleEmail: conexion?.googleEmail ?? null,
      conectadoAt: conexion?.conectadoAt ?? null,
    };
  }

  async puedeSincronizarInstitucional(): Promise<boolean> {
    if (!this.institucionalRepo) return false;
    const cuenta = await this.institucionalRepo.findOne({ where: { activo: true } });
    return Boolean(cuenta && cuenta.refreshTokenCifrado);
  }

  async puedeSincronizarAutomaticamente(usuarioId?: number): Promise<boolean> {
    const puedeInst = await this.puedeSincronizarInstitucional();
    if (puedeInst) return true;

    if (!usuarioId) return false;

    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId, activo: true },
    });

    return Boolean(conexion?.refreshTokenCifrado);
  }

  async obtenerClienteAutorizado(usuarioId?: number): Promise<OAuth2Client> {
    let conexion: GoogleConexionUsuario | null = null;
    if (usuarioId) {
      conexion = await this.googleConexionRepo.findOne({
        where: { usuarioId, activo: true },
      });
    }

    let cuentaInst: GoogleCuentaInstitucional | null = null;
    if ((!conexion || !conexion.refreshTokenCifrado) && this.institucionalRepo) {
      cuentaInst = await this.institucionalRepo.findOne({
        where: { activo: true },
      });
    }

    const tokenCifrado = conexion?.refreshTokenCifrado || cuentaInst?.refreshTokenCifrado;

    if (!tokenCifrado) {
      throw new BadRequestException(
        'El usuario no tiene una cuenta de Google conectada o la autorización ha sido revocada, y no existe una cuenta institucional activa configurada.',
      );
    }

    const refreshToken = this.descifrar(tokenCifrado);
    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });

    try {
      await client.getAccessToken();
    } catch (error) {
      if (!this.esInvalidGrant(error)) {
        throw error;
      }

      if (conexion) {
        conexion.activo = false;
        await this.googleConexionRepo.save(conexion);
      } else if (cuentaInst && this.institucionalRepo) {
        cuentaInst.activo = false;
        cuentaInst.ultimoError = 'La autorización de Google institucional expiró o fue revocada.';
        await this.institucionalRepo.save(cuentaInst);
      }

      throw new BadRequestException(
        'La autorización de Google expiró o fue revocada. Vuelve a conectar Google.',
      );
    }

    return client;
  }

  // --- MÉTODOS DE CUENTA INSTITUCIONAL PRINCIPAL ---

  async iniciarConexionInstitucional(usuarioId: number): Promise<{ url: string; state: string }> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException(
          'El asistente estudiantil no está autorizado para conectar la cuenta institucional.',
        );
      }
    }

    const rawState = `inst_${crypto.randomBytes(32).toString('hex')}`;
    const stateHash = crypto.createHash('sha256').update(rawState).digest('hex');

    const oauthClient = this.getOAuth2Client();
    const { codeVerifier, codeChallenge } =
      await oauthClient.generateCodeVerifierAsync();

    const codeVerifierCifrado = this.cifrar(codeVerifier);

    const expiraAt = new Date();
    expiraAt.setMinutes(expiraAt.getMinutes() + 10);

    const oauthEstado = this.googleOauthEstadoRepo.create({
      usuarioId,
      stateHash,
      codeVerifierCifrado,
      expiraAt,
      usadoAt: null,
    });

    await this.googleOauthEstadoRepo.save(oauthEstado);

    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      state: rawState,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'consent',
    });

    return { url, state: rawState };
  }

  async conectarCuentaInstitucionalManual(
    usuarioId: number,
    dto: { googleEmail: string; refreshToken?: string; notas?: string },
  ): Promise<GoogleCuentaInstitucional> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException(
          'El asistente estudiantil no está autorizado para configurar la cuenta institucional.',
        );
      }
    }

    if (!dto.googleEmail || !dto.googleEmail.includes('@')) {
      throw new BadRequestException('Debe proporcionar un correo electrónico institucional válido.');
    }

    let cuenta = this.institucionalRepo ? await this.institucionalRepo.findOne({ where: {} }) : null;

    let refreshTokenCifrado = cuenta?.refreshTokenCifrado ?? null;
    if (dto.refreshToken?.trim()) {
      refreshTokenCifrado = this.cifrar(dto.refreshToken.trim());
    }

    if (!cuenta) {
      if (!this.institucionalRepo) {
        throw new Error('Repositorio de cuenta institucional no disponible');
      }
      cuenta = this.institucionalRepo.create({
        googleEmail: dto.googleEmail.trim().toLowerCase(),
        googleSubject: null,
        refreshTokenCifrado,
        scopes: GOOGLE_SCOPES,
        activo: true,
        conectadoAt: new Date(),
        revocadoAt: null,
        autorizadoPorUsuarioId: usuarioId,
        ultimoError: null,
        ultimoSyncAt: null,
        syncExitosos: 0,
        syncFallidos: 0,
      });
    } else {
      cuenta.googleEmail = dto.googleEmail.trim().toLowerCase();
      if (refreshTokenCifrado) cuenta.refreshTokenCifrado = refreshTokenCifrado;
      cuenta.activo = true;
      cuenta.conectadoAt = new Date();
      cuenta.revocadoAt = null;
      cuenta.autorizadoPorUsuarioId = usuarioId;
      cuenta.ultimoError = null;
    }

    return this.institucionalRepo!.save(cuenta);
  }

  async reconectarCuentaInstitucional(usuarioId: number): Promise<GoogleCuentaInstitucional> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException('El asistente estudiantil no está autorizado para reconectar la cuenta institucional.');
      }
    }

    if (!this.institucionalRepo) throw new Error('Repositorio institucional no disponible');
    const cuenta = await this.institucionalRepo.findOne({ where: {} });
    if (!cuenta) {
      throw new NotFoundException('No existe una cuenta institucional configurada para reconectar.');
    }

    cuenta.activo = true;
    cuenta.ultimoError = null;
    cuenta.revocadoAt = null;
    cuenta.autorizadoPorUsuarioId = usuarioId;
    return this.institucionalRepo.save(cuenta);
  }

  async desconectarCuentaInstitucional(usuarioId: number): Promise<void> {
    if (this.alcanceJerarquico) {
      const tipo = await this.alcanceJerarquico.tipoCuentaJerarquica(usuarioId);
      if (tipo === 'ASISTENTE_ESTUDIANTIL') {
        throw new ForbiddenException('El asistente estudiantil no está autorizado para desconectar la cuenta institucional.');
      }
    }

    if (!this.institucionalRepo) return;
    const cuenta = await this.institucionalRepo.findOne({ where: {} });
    if (!cuenta) {
      throw new NotFoundException('No existe una cuenta institucional registrada.');
    }

    if (cuenta.refreshTokenCifrado) {
      try {
        const refreshToken = this.descifrar(cuenta.refreshTokenCifrado);
        const client = this.getOAuth2Client();
        await client.revokeToken(refreshToken);
      } catch (err) {
        this.logger.warn('No se pudo revocar el token institucional en Google directamente', err);
      }
    }

    cuenta.activo = false;
    cuenta.revocadoAt = new Date();
    await this.institucionalRepo.save(cuenta);
  }

  async obtenerEstadoInstitucional(): Promise<{
    configurada: boolean;
    conectada: boolean;
    estado: EstadoCuentaInstitucional;
    googleEmail: string | null;
    conectadoAt: Date | null;
    autorizadoPorUsuarioId: number | null;
    ultimoSyncAt: Date | null;
    syncExitosos: number;
    syncFallidos: number;
    ultimoError: string | null;
  }> {
    if (!this.institucionalRepo) {
      return {
        configurada: false,
        conectada: false,
        estado: 'DESCONECTADA',
        googleEmail: null,
        conectadoAt: null,
        autorizadoPorUsuarioId: null,
        ultimoSyncAt: null,
        syncExitosos: 0,
        syncFallidos: 0,
        ultimoError: null,
      };
    }

    const cuenta = await this.institucionalRepo.findOne({ where: {} });
    if (!cuenta) {
      return {
        configurada: false,
        conectada: false,
        estado: 'DESCONECTADA',
        googleEmail: null,
        conectadoAt: null,
        autorizadoPorUsuarioId: null,
        ultimoSyncAt: null,
        syncExitosos: 0,
        syncFallidos: 0,
        ultimoError: null,
      };
    }

    const conectada = Boolean(cuenta.activo && cuenta.refreshTokenCifrado);
    const requiereReconexion = Boolean(!cuenta.activo && cuenta.refreshTokenCifrado);
    const estado: EstadoCuentaInstitucional = conectada
      ? 'CONECTADA'
      : requiereReconexion
        ? 'REQUIERE_RECONEXION'
        : 'DESCONECTADA';

    return {
      configurada: true,
      conectada,
      estado,
      googleEmail: cuenta.googleEmail,
      conectadoAt: cuenta.conectadoAt,
      autorizadoPorUsuarioId: cuenta.autorizadoPorUsuarioId,
      ultimoSyncAt: cuenta.ultimoSyncAt,
      syncExitosos: cuenta.syncExitosos || 0,
      syncFallidos: cuenta.syncFallidos || 0,
      ultimoError: cuenta.ultimoError,
    };
  }

  async registrarResultadoSync(
    tipo: 'AUTOMATICO' | 'MANUAL',
    resultado: 'EXITOSO' | 'ERROR' | 'PARCIAL',
    datos: {
      formulariosProcesados: number;
      respuestasNuevas: number;
      detalleError?: string;
      ejecutadoPorUsuarioId?: number;
    },
  ): Promise<void> {
    if (this.institucionalRepo) {
      const cuenta = await this.institucionalRepo.findOne({ where: {} });
      if (cuenta) {
        cuenta.ultimoSyncAt = new Date();
        if (resultado === 'EXITOSO') {
          cuenta.syncExitosos = (cuenta.syncExitosos || 0) + 1;
          cuenta.ultimoError = null;
        } else if (resultado === 'ERROR') {
          cuenta.syncFallidos = (cuenta.syncFallidos || 0) + 1;
          cuenta.ultimoError = datos.detalleError?.slice(0, 500) || 'Error durante la sincronización';
        } else {
          cuenta.syncExitosos = (cuenta.syncExitosos || 0) + 1;
          cuenta.ultimoError = datos.detalleError?.slice(0, 500) || null;
        }
        await this.institucionalRepo.save(cuenta);
      }
    }

    if (this.syncLogRepo) {
      const log = this.syncLogRepo.create({
        tipo,
        resultado,
        formulariosProcesados: datos.formulariosProcesados,
        respuestasNuevas: datos.respuestasNuevas,
        detalleError: datos.detalleError || null,
        ejecutadoPorUsuarioId: datos.ejecutadoPorUsuarioId || null,
      });
      await this.syncLogRepo.save(log);
    }
  }

  async listarHistorialSync(limite = 20): Promise<GoogleSyncLog[]> {
    if (!this.syncLogRepo) return [];
    return this.syncLogRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limite, 100),
    });
  }

  private esInvalidGrant(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as {
      code?: unknown;
      response?: { data?: unknown };
    };
    const responseData = candidate.response?.data;

    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData
    ) {
      return (responseData as { error?: unknown }).error === 'invalid_grant';
    }

    return candidate.code === 'invalid_grant';
  }

  async desconectar(usuarioId: number): Promise<void> {
    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId },
    });

    if (!conexion) {
      throw new NotFoundException(
        'No se encontró una conexión de Google para este usuario',
      );
    }

    if (conexion.refreshTokenCifrado) {
      try {
        const refreshToken = this.descifrar(conexion.refreshTokenCifrado);
        const client = this.getOAuth2Client();
        await client.revokeToken(refreshToken);
      } catch (err) {
        this.logger.warn(
          'No se pudo revocar el token en Google directamente',
          err,
        );
      }
    }

    conexion.activo = false;
    conexion.refreshTokenCifrado = null;
    conexion.revocadoAt = new Date();
    await this.googleConexionRepo.save(conexion);
  }
}
