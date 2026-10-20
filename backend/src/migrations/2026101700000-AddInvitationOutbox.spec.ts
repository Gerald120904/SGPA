import { QueryRunner } from 'typeorm';
import { AddInvitationOutbox2026101700000 } from './2026101700000-AddInvitationOutbox';

describe('migración aislada de invitaciones', () => {
  const migration = new AddInvitationOutbox2026101700000();
  const runner = {
    query: jest.fn(),
    hasTable: jest.fn(),
    createTable: jest.fn(),
    dropTable: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    runner.query.mockResolvedValue([{ db: 'sgpa_test' }]);
    runner.hasTable.mockResolvedValue(false);
  });

  it('rechaza bases no autorizadas antes de alterar el esquema', async () => {
    runner.query.mockResolvedValue([{ db: 'otra_base' }]);
    await expect(
      migration.up(runner as unknown as QueryRunner),
    ).rejects.toThrow('fuera de sgpa o sgpa_test');
    expect(runner.createTable).not.toHaveBeenCalled();
  });

  it('permite crear la tabla en la base principal sgpa', async () => {
    runner.query.mockResolvedValue([{ db: 'sgpa' }]);
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.createTable).toHaveBeenCalledTimes(1);
    expect(runner.createTable.mock.calls[0][0].name).toBe('invitacion_outbox');
  });

  it('crea la tabla una sola vez en el destino autorizado', async () => {
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.createTable).toHaveBeenCalledTimes(1);
    expect(runner.createTable.mock.calls[0][0].name).toBe('invitacion_outbox');
  });

  it('impide una reversión que perdería invitaciones', async () => {
    runner.hasTable.mockResolvedValue(true);
    runner.query
      .mockResolvedValueOnce([{ db: 'sgpa_test' }])
      .mockResolvedValueOnce([{ total: 1 }]);
    await expect(
      migration.down(runner as unknown as QueryRunner),
    ).rejects.toThrow('No se elimina');
    expect(runner.dropTable).not.toHaveBeenCalled();
  });

  it('permite revertir solamente una tabla vacía', async () => {
    runner.hasTable.mockResolvedValue(true);
    runner.query
      .mockResolvedValueOnce([{ db: 'sgpa_test' }])
      .mockResolvedValueOnce([{ total: 0 }]);
    await migration.down(runner as unknown as QueryRunner);
    expect(runner.dropTable).toHaveBeenCalledWith('invitacion_outbox');
  });
});
