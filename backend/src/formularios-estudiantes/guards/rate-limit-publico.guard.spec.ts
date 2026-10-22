import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitPublicoGuard } from './rate-limit-publico.guard';

describe('RateLimitPublicoGuard (Subfase 3B - Seguridad)', () => {
  let guard: RateLimitPublicoGuard;

  beforeEach(() => {
    guard = new RateLimitPublicoGuard();
    guard.reset();
  });

  const mockContext = (
    method = 'GET',
    headers: Record<string, string | string[]> = {},
    ip = '192.168.1.100',
  ) => {
    const req: any = {
      method,
      headers,
      ip,
      socket: { remoteAddress: ip },
    };
    const res: any = {
      setHeader: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  describe('Extracción e identificación segura de IP cliente', () => {
    it('ignora x-forwarded-for en una conexión directa', () => {
      const ctx = mockContext('GET', {
        'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
      });
      const req = ctx.switchToHttp().getRequest();
      expect(guard.extraerIpCliente(req)).toBe('192.168.1.100');
    });

    it('ignora x-forwarded-for aunque sea un arreglo', () => {
      const ctx = mockContext('GET', {
        'x-forwarded-for': ['198.51.100.44', '10.0.0.1'],
      });
      const req = ctx.switchToHttp().getRequest();
      expect(guard.extraerIpCliente(req)).toBe('192.168.1.100');
    });

    it('usa remoteAddress aunque la cabecera esté manipulada', () => {
      const ctx = mockContext(
        'GET',
        { 'x-forwarded-for': '<script>alert(1)</script>' },
        '10.20.30.40',
      );
      const req = ctx.switchToHttp().getRequest();
      expect(guard.extraerIpCliente(req)).toBe('10.20.30.40');
    });

    it('impide eludir el límite POST cambiando x-forwarded-for', () => {
      for (let i = 0; i < 10; i++) {
        expect(
          guard.canActivate(
            mockContext('POST', { 'x-forwarded-for': `203.0.113.${i + 1}` }, '10.20.30.40'),
          ),
        ).toBe(true);
      }
      expect(() =>
        guard.canActivate(
          mockContext('POST', { 'x-forwarded-for': '198.51.100.200' }, '10.20.30.40'),
        ),
      ).toThrow(HttpException);
    });
  });

  describe('Control de límites (Rate Limiting)', () => {
    it('permite peticiones GET hasta el límite configurado (60/min)', () => {
      const ctx = mockContext('GET', {}, '1.2.3.4');

      for (let i = 0; i < 60; i++) {
        expect(guard.canActivate(ctx)).toBe(true);
      }
    });

    it('bloquea con HTTP 429 Too Many Requests cuando GET supera el límite', () => {
      const ctx = mockContext('GET', {}, '1.2.3.4');

      for (let i = 0; i < 60; i++) {
        guard.canActivate(ctx);
      }

      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
      try {
        guard.canActivate(ctx);
      } catch (err: any) {
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.message).toContain('Demasiadas solicitudes');
      }
    });

    it('aplica un límite más estricto para POST (10/min) y establece Retry-After', () => {
      const ctx = mockContext('POST', {}, '5.6.7.8');
      const res = ctx.switchToHttp().getResponse();

      for (let i = 0; i < 10; i++) {
        expect(guard.canActivate(ctx)).toBe(true);
      }

      expect(() => guard.canActivate(ctx)).toThrow(HttpException);
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    });
  });
});
