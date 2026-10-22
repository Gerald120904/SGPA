const { assertManualConfirmation } = require('../../scripts/run-migrations') as {
  assertManualConfirmation: (argv: string[], database: string | undefined) => void;
};

describe('runner manual de migraciones', () => {
  it('exige --apply y confirmación exacta de la base', () => {
    expect(() => assertManualConfirmation(['node', 'script'], 'sgpa')).toThrow('--apply');
    expect(() => assertManualConfirmation(['node', 'script', '--apply'], 'sgpa')).toThrow('--confirm-database');
    expect(() => assertManualConfirmation(
      ['node', 'script', '--apply', '--confirm-database=otra'], 'sgpa',
    )).toThrow('no coincide');
  });

  it('acepta la confirmación manual exacta', () => {
    expect(() => assertManualConfirmation(
      ['node', 'script', '--apply', '--confirm-database=sgpa'], 'sgpa',
    )).not.toThrow();
  });
});
