import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { google } from 'googleapis';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import * as crypto from 'crypto';
import { GoogleConexionUsuario } from './entities/google-conexion-usuario.entity';
import { GoogleOauthEstado } from './entities/google-oauth-estado.entity';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  constructor(
    @InjectRepository(GoogleConexionUsuario)
    private readonly googleConexionRepo: Repository<GoogleConexionUsuario>,
    @InjectRepository(GoogleOauthEstado)
    private readonly googleOauthEstadoRepo: Repository<GoogleOauthEstado>,
    private readonly configService: ConfigService,
  ) {}

  private getOAuth2Client(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_OAUTH_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalServerErrorException(
        'Configuración de Google OAuth incompleta en las variables de entorno',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  private getEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY');
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
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    let encrypted = cipher.update(valor, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}.${authTag}.${encrypted}`;
  }

  private descifrar(valorCifrado: string): string {
    const parts = valorCifrado.split('.');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Formato de token cifrado inválido');
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
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

    let conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId: oauthEstado.usuarioId },
    });

    const refreshToken = tokens.refresh_token;

    if (!refreshToken && !conexion?.refreshTokenCifrado) {
      throw new BadRequestException(
        'Google no devolvió un token de actualización. Vuelva a iniciar la autorización.',
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
    googleEmail: string | null;
    conectadoAt: Date | null;
  }> {
    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId, activo: true },
    });

    return {
      conectado: Boolean(conexion && conexion.refreshTokenCifrado),
      googleEmail: conexion?.googleEmail ?? null,
      conectadoAt: conexion?.conectadoAt ?? null,
    };
  }

  async obtenerClienteAutorizado(usuarioId: number): Promise<OAuth2Client> {
    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId, activo: true },
    });

    if (!conexion || !conexion.refreshTokenCifrado) {
      throw new BadRequestException(
        'El usuario no tiene una cuenta de Google conectada o la autorización ha sido revocada',
      );
    }

    const refreshToken = this.descifrar(conexion.refreshTokenCifrado);
    const client = this.getOAuth2Client();
    client.setCredentials({ refresh_token: refreshToken });

    return client;
  }

  async desconectar(usuarioId: number): Promise<void> {
    const conexion = await this.googleConexionRepo.findOne({
      where: { usuarioId },
    });

    if (!conexion) {
      throw new NotFoundException('No se encontró una conexión de Google para este usuario');
    }

    if (conexion.refreshTokenCifrado) {
      try {
        const refreshToken = this.descifrar(conexion.refreshTokenCifrado);
        const client = this.getOAuth2Client();
        await client.revokeToken(refreshToken);
      } catch (err) {
        this.logger.warn('No se pudo revocar el token en Google directamente', err);
      }
    }

    conexion.activo = false;
    conexion.refreshTokenCifrado = null;
    conexion.revocadoAt = new Date();
    await this.googleConexionRepo.save(conexion);
  }
}
