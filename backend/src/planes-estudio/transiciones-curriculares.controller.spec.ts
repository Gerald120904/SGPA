import { TransicionesCurricularesController } from './transiciones-curriculares.controller';

describe('TransicionesCurricularesController', () => {
  it('delegates internal and preapproved external transfers to the transactional service', async () => {
    const service = { ejecutarTransicion: jest.fn().mockResolvedValue({ solicitados: 1, migrados: 1, fallidos: [] }) };
    const controller = new TransicionesCurricularesController(service as any);
    await expect(controller.ejecutar({ user: { sub: 1 } } as any, {
      carreraId: 1,
      planOrigenId: 1,
      planDestinoId: 2,
      estudianteIds: [1],
      motivo: 'Prueba de traslado interno',
    })).resolves.toEqual({ solicitados: 1, migrados: 1, fallidos: [] });
    expect(service.ejecutarTransicion).toHaveBeenCalled();
  });

  it('delegates a reversal by audit identifier and reason to the transactional service', async () => {
    const service = { revertirTransicion: jest.fn().mockResolvedValue({ revertida: true }) };
    const controller = new TransicionesCurricularesController(service as any);
    await expect(controller.revertir({ user: { sub: 9 } } as any, 17, {
      motivo: 'Reversion autorizada de prueba',
    })).resolves.toEqual({ revertida: true });
    expect(service.revertirTransicion).toHaveBeenCalledWith(9, 17, 'Reversion autorizada de prueba');
  });

  it('delegates external approval or rejection with the authenticated reviewer and request id', async () => {
    const service = { decidirConvalidacionExterna: jest.fn().mockResolvedValue({ estado: 'APROBADA' }) };
    const controller = new TransicionesCurricularesController(service as any);
    const dto = { decision: 'APROBADA', motivo: 'Evidencia revisada y verificada' } as any;
    await expect(controller.decidirConvalidacionExterna({ user: { sub: 31 } } as any, 42, dto))
      .resolves.toEqual({ estado: 'APROBADA' });
    expect(service.decidirConvalidacionExterna).toHaveBeenCalledWith(31, 42, dto);
  });

  it('records evidence review before the external decision step', async () => {
    const service = { verificarEvidenciaConvalidacionExterna: jest.fn().mockResolvedValue({ evidenciaVerificada: true }) };
    const controller = new TransicionesCurricularesController(service as any);
    const dto = { hashesVerificados: ['a'.repeat(64)], motivoRevision: 'Documento institucional abierto y contrastado',
      confirmacion: 'CONFIRMO_REVISION_DOCUMENTAL' } as any;
    await expect(controller.verificarEvidenciaConvalidacionExterna({ user: { sub: 31 } } as any, 42, dto))
      .resolves.toEqual({ evidenciaVerificada: true });
    expect(service.verificarEvidenciaConvalidacionExterna).toHaveBeenCalledWith(31, 42, dto);
  });
});
