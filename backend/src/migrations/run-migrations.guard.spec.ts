const {
  assertOnlyQa004Pending,
  assertQa004OnlyConfigured,
} = require('../../scripts/run-migrations') as {
  assertOnlyQa004Pending: (migrations: Array<{ name: string }>) => void;
  assertQa004OnlyConfigured: (migrations: Array<{ name: string }>) => void;
};

describe('runner de migraciones QA-004', () => {
  const qa004 = { name: 'AddOptativeRuleCounts2026101500000' };
  const ajena = { name: 'MigrationUnexpected2026101400000' };

  it('acepta únicamente la migración QA-004 configurada', () => {
    expect(() => assertQa004OnlyConfigured([qa004])).not.toThrow();
    expect(() => assertOnlyQa004Pending([qa004])).not.toThrow();
    expect(() => assertOnlyQa004Pending([])).not.toThrow();
  });

  it('rechaza configuraciones sin QA-004, múltiples o con migraciones ajenas', () => {
    expect(() => assertQa004OnlyConfigured([])).toThrow('Migraciones configuradas inesperadas');
    expect(() => assertQa004OnlyConfigured([qa004, ajena])).toThrow(
      'Migraciones configuradas inesperadas',
    );
    expect(() => assertQa004OnlyConfigured([ajena])).toThrow(
      'Migraciones configuradas inesperadas',
    );
  });

  it('detiene la ejecución ante cualquier migración pendiente ajena', () => {
    expect(() => assertOnlyQa004Pending([ajena])).toThrow(
      'Migraciones pendientes inesperadas',
    );
    expect(() => assertOnlyQa004Pending([qa004, ajena])).toThrow(
      'Migraciones pendientes inesperadas',
    );
  });
});
