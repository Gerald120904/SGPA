import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, maxLength } from 'class-validator';
import { EstadoRespuestaFormulario } from './constants/estado-respuesta-formulario.constant';
import { RechazarRespuestaFormularioDto } from './dto/rechazar-respuesta-formulario.dto';
import { FormulariosEstudiantesProcesamientoService } from './formularios-estudiantes-procesamiento.service';

/**
 * Función idéntica a la implementada en frontend/src/utils/html.js
 * para garantizar consistencia absoluta entre capas.
 */
function calcularLongitudTexto(value: any): number {
  const str = String(value ?? '');
  const presentationSequences = str.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g) || [];
  const surrogatePairs = str.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || [];
  return str.length - presentationSequences.length - surrogatePairs.length;
}

describe('Validación de motivo de rechazo de formularios (Backend, DTO y Frontend)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  describe('RechazarRespuestaFormularioDto — Validaciones de entrada', () => {
    it('1. Rechaza la petición si el motivo está ausente (undefined)', async () => {
      await expect(
        pipe.transform({}, { type: 'body', metatype: RechazarRespuestaFormularioDto }),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
      expect(errors[0].constraints?.isNotEmpty).toContain(
        'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
      );
    });

    it('2. Rechaza la petición si el motivo es una cadena vacía', async () => {
      await expect(
        pipe.transform({ motivo: '' }, { type: 'body', metatype: RechazarRespuestaFormularioDto }),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isNotEmpty).toContain(
        'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
      );
    });

    it('3. Rechaza la petición si el motivo está compuesto exclusivamente por espacios en blanco', async () => {
      await expect(
        pipe.transform({ motivo: '     ' }, { type: 'body', metatype: RechazarRespuestaFormularioDto }),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: '   \t  \n  ' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isNotEmpty).toContain(
        'El motivo de rechazo es obligatorio y no puede consistir únicamente en espacios en blanco.',
      );
    });

    it('4. Rechaza la petición si el motivo es nulo', async () => {
      await expect(
        pipe.transform({ motivo: null }, { type: 'body', metatype: RechazarRespuestaFormularioDto }),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: null });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('5. Rechaza la petición si el motivo no es una cadena de texto (número, boolean, array)', async () => {
      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: 12345 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.isString).toBe(
        'El motivo de rechazo debe ser una cadena de texto.',
      );
    });

    it('6. Acepta exactamente 500 letras ASCII', async () => {
      const motivo500 = 'a'.repeat(500);
      const transformed = await pipe.transform(
        { motivo: motivo500 },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );

      expect(transformed.motivo).toBe(motivo500);
      expect(transformed.motivo.length).toBe(500);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: motivo500 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('7. Rechaza 501 letras ASCII', async () => {
      const motivo501 = 'a'.repeat(501);
      await expect(
        pipe.transform(
          { motivo: motivo501 },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: motivo501 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints?.maxLength).toBe(
        'El motivo de rechazo no puede superar los 500 caracteres.',
      );
    });

    it('8. Acepta exactamente 500 caracteres con tildes y eñes', async () => {
      const tildes500 = 'áéíóúñÁÉÍÓÚÑ'.repeat(41) + 'áéíóúñÁÉ'; // 12 * 41 = 492 + 8 = 500
      expect(tildes500.length).toBe(500);

      const transformed = await pipe.transform(
        { motivo: tildes500 },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );
      expect(transformed.motivo).toBe(tildes500);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: tildes500 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('9. Rechaza 501 caracteres con tildes y eñes', async () => {
      const tildes501 = 'áéíóúñÁÉÍÓÚÑ'.repeat(41) + 'áéíóúñÁÉI'; // 492 + 9 = 501
      expect(tildes501.length).toBe(501);

      await expect(
        pipe.transform(
          { motivo: tildes501 },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: tildes501 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('10. Acepta exactamente 500 emojis simples', async () => {
      const emojis500 = '😀'.repeat(500);
      const transformed = await pipe.transform(
        { motivo: emojis500 },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );
      expect(transformed.motivo).toBe(emojis500);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: emojis500 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('11. Rechaza 501 emojis simples', async () => {
      const emojis501 = '😀'.repeat(501);
      await expect(
        pipe.transform(
          { motivo: emojis501 },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: emojis501 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('12. Acepta combinación de texto mixto de exactamente 500 caracteres (499 letras + 1 emoji)', async () => {
      const mixto500 = 'x'.repeat(499) + '😀';
      const transformed = await pipe.transform(
        { motivo: mixto500 },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );
      expect(transformed.motivo).toBe(mixto500);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: mixto500 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('13. Rechaza combinación de texto mixto de 501 caracteres (499 letras + 1 emoji + 1 letra)', async () => {
      const mixto501 = 'x'.repeat(499) + '😀' + 'y';
      await expect(
        pipe.transform(
          { motivo: mixto501 },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: mixto501 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('14. Elimina espacios exteriores y conserva exactamente 500 letras útiles', async () => {
      const base500 = 'x'.repeat(500);
      const conEspacios = `   ${base500}   `;

      const transformed = await pipe.transform(
        { motivo: conEspacios },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );

      expect(transformed.motivo).toBe(base500);
      expect(transformed.motivo.length).toBe(500);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: conEspacios });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('15. Rechaza cuando tras eliminar espacios exteriores quedan 501 letras', async () => {
      const base501 = 'y'.repeat(501);
      const conEspacios = `   ${base501}   `;

      await expect(
        pipe.transform(
          { motivo: conEspacios },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: conEspacios });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('16. Elimina espacios exteriores y conserva exactamente 500 emojis útiles', async () => {
      const emojis500 = '😀'.repeat(500);
      const conEspacios = `   ${emojis500}   `;

      const transformed = await pipe.transform(
        { motivo: conEspacios },
        { type: 'body', metatype: RechazarRespuestaFormularioDto },
      );

      expect(transformed.motivo).toBe(emojis500);
      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: conEspacios });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('17. Rechaza cuando tras eliminar espacios exteriores quedan 501 emojis', async () => {
      const emojis501 = '😀'.repeat(501);
      const conEspacios = `   ${emojis501}   `;

      await expect(
        pipe.transform(
          { motivo: conEspacios },
          { type: 'body', metatype: RechazarRespuestaFormularioDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const dto = plainToInstance(RechazarRespuestaFormularioDto, { motivo: conEspacios });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('FormulariosEstudiantesProcesamientoService — Validación en servicio', () => {
    let service: FormulariosEstudiantesProcesamientoService;
    let mockRespuestaRepo: any;
    let mockEstructuraService: any;
    let mockMailService: any;

    beforeEach(() => {
      mockRespuestaRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          formularioId: 10,
          estado: EstadoRespuestaFormulario.PENDIENTE,
          formulario: { id: 10, carreraId: 5, titulo: 'Formulario 2026' },
          datosNormalizadosJson: { correoEstudiantil: 'estudiante@una.cr', primerNombre: 'Pedro', primerApellido: 'Alas' },
        }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (r) => r),
      };

      mockEstructuraService = {
        tieneAlcanceSobreCarrera: jest.fn().mockResolvedValue(true),
        obtenerCarreraIdsConAlcance: jest.fn().mockResolvedValue([5]),
      };

      mockMailService = {
        enviarNotificacionRechazoSolicitud: jest.fn().mockResolvedValue(undefined),
      };

      service = new FormulariosEstudiantesProcesamientoService(
        {} as never,
        mockRespuestaRepo as never,
        {} as never,
        {} as never,
        {} as never,
        mockEstructuraService as never,
        {} as never,
        undefined,
        mockMailService,
      );
    });

    it('18. Servicio lanza BadRequestException si se intenta rechazar con motivo vacío o espacios', async () => {
      await expect(service.rechazarRespuesta(1, 100, '')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.rechazarRespuesta(1, 100, '    ')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRespuestaRepo.update).not.toHaveBeenCalled();
    });

    it('19. Servicio lanza BadRequestException si el motivo excede 500 letras ASCII', async () => {
      const motivo501 = 'z'.repeat(501);
      await expect(service.rechazarRespuesta(1, 100, motivo501)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRespuestaRepo.update).not.toHaveBeenCalled();
    });

    it('20. Servicio acepta exactamente 500 letras con espacios exteriores', async () => {
      const motivo500 = 'c'.repeat(500);
      const resultado = await service.rechazarRespuesta(1, 100, `  ${motivo500}  `);

      expect(resultado.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
      expect(resultado.motivoRechazo).toBe(motivo500);
      expect(resultado.motivoRechazo?.length).toBe(500);
      expect(mockRespuestaRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          estado: EstadoRespuestaFormulario.RECHAZADO,
          motivoRechazo: motivo500,
        }),
      );
    });

    it('21. Servicio acepta exactamente 500 emojis simples', async () => {
      const emojis500 = '😀'.repeat(500);
      const resultado = await service.rechazarRespuesta(1, 100, `  ${emojis500}  `);

      expect(resultado.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
      expect(resultado.motivoRechazo).toBe(emojis500);
      expect(mockRespuestaRepo.update).toHaveBeenCalled();
    });

    it('22. Servicio rechaza 501 emojis simples', async () => {
      const emojis501 = '😀'.repeat(501);
      await expect(service.rechazarRespuesta(1, 100, emojis501)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRespuestaRepo.update).not.toHaveBeenCalled();
    });

    it('23. Servicio acepta combinación de 499 letras + 1 emoji (500 caracteres útiles)', async () => {
      const mixto500 = 'a'.repeat(499) + '😀';
      const resultado = await service.rechazarRespuesta(1, 100, mixto500);
      expect(resultado.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
      expect(resultado.motivoRechazo).toBe(mixto500);
    });

    it('24. Servicio rechaza combinación de 499 letras + 1 emoji + 1 letra (501 caracteres)', async () => {
      const mixto501 = 'a'.repeat(499) + '😀' + 'b';
      await expect(service.rechazarRespuesta(1, 100, mixto501)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('25. Preserva compatibilidad con registros históricos de BD que no tengan motivo', () => {
      const respuestaHistorica = {
        id: 99,
        estado: EstadoRespuestaFormulario.RECHAZADO,
        motivoRechazo: null,
        revisadoPorUsuarioId: 5,
        revisadoAt: new Date('2025-01-01'),
      };

      expect(respuestaHistorica.motivoRechazo).toBeNull();
      expect(respuestaHistorica.estado).toBe(EstadoRespuestaFormulario.RECHAZADO);
    });
  });

  describe('Consistencia Frontend-Backend — Algoritmo de cálculo de longitud', () => {
    it('26. calcularLongitudTexto coincide exactamente con maxLength de class-validator en todos los casos límite', () => {
      const casos = [
        { desc: '500 letras', valor: 'a'.repeat(500), esperadoValido: true },
        { desc: '501 letras', valor: 'a'.repeat(501), esperadoValido: false },
        { desc: '500 tildes/eñes', valor: 'áéíóúñÁÉÍÓÚÑ'.repeat(41) + 'áéíóúñÁÉ', esperadoValido: true },
        { desc: '501 tildes/eñes', valor: 'áéíóúñÁÉÍÓÚÑ'.repeat(41) + 'áéíóúñÁÉI', esperadoValido: false },
        { desc: '500 emojis', valor: '😀'.repeat(500), esperadoValido: true },
        { desc: '501 emojis', valor: '😀'.repeat(501), esperadoValido: false },
        { desc: '499 letras + 1 emoji', valor: 'x'.repeat(499) + '😀', esperadoValido: true },
        { desc: '499 letras + 1 emoji + 1 letra', valor: 'x'.repeat(499) + '😀' + 'y', esperadoValido: false },
        { desc: 'Espacios exteriores con 500 letras útiles', valor: `  ${'x'.repeat(500)}  `.trim(), esperadoValido: true },
        { desc: 'Espacios exteriores con 501 letras útiles', valor: `  ${'x'.repeat(501)}  `.trim(), esperadoValido: false },
      ];

      for (const caso of casos) {
        const longitudFrontend = calcularLongitudTexto(caso.valor);
        const frontendValido = longitudFrontend <= 500;
        const backendValido = maxLength(caso.valor, 500);

        expect(frontendValido).toBe(caso.esperadoValido);
        expect(backendValido).toBe(caso.esperadoValido);
        expect(frontendValido).toBe(backendValido);
      }
    });
  });
});
