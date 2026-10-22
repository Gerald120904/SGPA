import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { createHash } from 'node:crypto';
import { FormulariosPublicosWebController } from './formularios-publicos-web.controller';
import { RateLimitPublicoGuard } from './guards/rate-limit-publico.guard';

describe('FormulariosPublicosWebController', () => {
  let controller: FormulariosPublicosWebController;

  const validToken =
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulariosPublicosWebController],
      providers: [
        {
          provide: RateLimitPublicoGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get<FormulariosPublicosWebController>(
      FormulariosPublicosWebController,
    );
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe servir HTML con estado 200 y encabezados de seguridad para un token válido', () => {
    const headers: Record<string, string> = {};
    let statusSet: number | undefined;
    let typeSet: string | undefined;
    let bodySent: string | undefined;

    const mockResponse = {
      setHeader: jest.fn((name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      }),
      status: jest.fn((code: number) => {
        statusSet = code;
        return mockResponse;
      }),
      type: jest.fn((t: string) => {
        typeSet = t;
        return mockResponse;
      }),
      send: jest.fn((body: string) => {
        bodySent = body;
        return mockResponse;
      }),
    } as unknown as Response;

    controller.mostrarFormularioPublico(validToken, mockResponse);

    expect(statusSet).toBe(HttpStatus.OK);
    expect(typeSet).toBe('html');
    expect(headers['content-security-policy']).toBeDefined();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['content-security-policy']).toMatch(/script-src 'sha256-[^']+'/);
    expect(headers['content-security-policy']).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(bodySent).toContain('<!DOCTYPE html>');
    expect(bodySent).toContain('SGPA');
  });

  it('debe retornar 400 Bad Request cuando el token es inválido o no tiene 64 caracteres hex', () => {
    const headers: Record<string, string> = {};
    let statusSet: number | undefined;

    const mockResponse = {
      setHeader: jest.fn((name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      }),
      status: jest.fn((code: number) => {
        statusSet = code;
        return mockResponse;
      }),
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as Response;

    controller.mostrarFormularioPublico('token-invalido', mockResponse);

    expect(statusSet).toBe(HttpStatus.BAD_REQUEST);
    expect(headers['x-frame-options']).toBe('DENY');
  });

  it('autoriza exactamente el script servido y no incluye manejadores de eventos en línea', () => {
    const headers: Record<string, string> = {};
    let html = '';
    const response = {
      setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
      status: () => response,
      type: () => response,
      send: (body: string) => { html = body; return response; },
    } as unknown as Response;

    controller.mostrarFormularioPublico(validToken, response);

    const script = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
    expect(script).toBeDefined();
    const hash = createHash('sha256').update(script!).digest('base64');
    expect(headers['content-security-policy']).toContain(`script-src 'sha256-${hash}'`);
    const scriptDirective = headers['content-security-policy'].match(/script-src [^;]+/)?.[0];
    expect(scriptDirective).not.toMatch(/unsafe-inline|unsafe-hashes/);
    expect(html).not.toMatch(/\s(?:onclick|onchange|oninput|onsubmit|on[a-z]+)\s*=/i);
    for (const type of ['click', 'change', 'input', 'submit']) {
      expect(script).toContain(`root.addEventListener('${type}'`);
    }
  });
});
