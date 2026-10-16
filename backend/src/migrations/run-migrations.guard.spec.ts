const { assertOnlyQa004Qa005Pending, assertQa004Qa005Configured } =
  require('../../scripts/run-migrations') as {
    assertOnlyQa004Qa005Pending: (migrations: Array<{ name: string }>) => void;
    assertQa004Qa005Configured: (migrations: Array<{ name: string }>) => void;
  };

describe('runner de migraciones QA-004 y QA-005', () => {
  const qa004 = { name: 'AddOptativeRuleCounts2026101500000' };
  const qa005 = { name: 'AddAulaEquipmentInventory2026101600000' };
  const ajena = { name: 'MigrationUnexpected2026101400000' };

  it('acepta únicamente QA-004 y QA-005 configuradas y pendientes', () => {
    expect(() => assertQa004Qa005Configured([qa004, qa005])).not.toThrow();
    expect(() => assertOnlyQa004Qa005Pending([qa005])).not.toThrow();
    expect(() => assertOnlyQa004Qa005Pending([qa004, qa005])).not.toThrow();
    expect(() => assertOnlyQa004Qa005Pending([])).not.toThrow();
  });

  it('rechaza configuraciones ausentes, duplicadas o con migraciones ajenas', () => {
    expect(() => assertQa004Qa005Configured([])).toThrow(
      'Migraciones configuradas inesperadas',
    );
    expect(() => assertQa004Qa005Configured([qa004, qa004])).toThrow(
      'Migraciones configuradas inesperadas',
    );
    expect(() => assertQa004Qa005Configured([qa004, ajena])).toThrow(
      'Migraciones configuradas inesperadas',
    );
    expect(() => assertQa004Qa005Configured([ajena])).toThrow(
      'Migraciones configuradas inesperadas',
    );
  });

  it('detiene la ejecución ante cualquier migración pendiente ajena o duplicada', () => {
    expect(() => assertOnlyQa004Qa005Pending([ajena])).toThrow(
      'Migraciones pendientes inesperadas',
    );
    expect(() => assertOnlyQa004Qa005Pending([qa004, ajena])).toThrow(
      'Migraciones pendientes inesperadas',
    );
    expect(() => assertOnlyQa004Qa005Pending([qa005, qa005])).toThrow(
      'Migraciones pendientes inesperadas',
    );
  });
});
