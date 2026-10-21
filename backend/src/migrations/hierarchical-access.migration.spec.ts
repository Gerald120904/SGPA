import { QueryRunner } from 'typeorm';
import { AddHierarchicalAccess2026101900000 } from './2026101900000-AddHierarchicalAccess';

describe('AddHierarchicalAccess2026101900000', () => {
  it('revisa todas las tablas antes de eliminar una sola', async () => {
    const runner = {
      hasTable: jest.fn().mockResolvedValue(true),
      query: jest.fn()
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([{ total: 1 }]),
      dropTable: jest.fn(),
    };
    await expect(new AddHierarchicalAccess2026101900000()
      .down(runner as unknown as QueryRunner)).rejects.toThrow();
    expect(runner.dropTable).not.toHaveBeenCalled();
  });
});
