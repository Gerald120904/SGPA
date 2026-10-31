import { QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { ConsolidatedAuditRestructuring2026103000000 } from './2026103000000-ConsolidatedAuditRestructuring';

describe('ConsolidatedAuditRestructuring2026103000000', () => {
  const migration = new ConsolidatedAuditRestructuring2026103000000();

  it('tiene el nombre oficial con timestamp de 13 dígitos', () => {
    expect(migration.name).toBe('ConsolidatedAuditRestructuring2026103000000');
    expect(migration.name.match(/(\d{13})$/)?.[1]).toBe('2026103000000');
  });

  it('crea tablas notificaciones y equivalencias_plan si no existen y actualiza columnas en tablas existentes', async () => {
    const createdTables: string[] = [];
    const addedColumns: Record<string, string[]> = {};
    const droppedIndices: Record<string, string[]> = {};
    const createdIndices: Record<string, string[]> = {};

    const estudiantesTable = new Table({
      name: 'estudiantes',
      columns: [
        new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
        new TableColumn({ name: 'cedula', type: 'varchar' }),
        new TableColumn({ name: 'correo_institucional', type: 'varchar' }),
        new TableColumn({ name: 'carrera_id', type: 'int' }),
      ],
      indices: [
        new TableIndex({ name: 'IDX_cedula_unique', columnNames: ['cedula'], isUnique: true }),
        new TableIndex({ name: 'IDX_correo_unique', columnNames: ['correo_institucional'], isUnique: true }),
      ],
    });

    const solicitudesTable = new Table({
      name: 'solicitudes_cambio',
      columns: [
        new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
        new TableColumn({ name: 'estado', type: 'varchar', length: '16' }),
      ],
    });

    const periodosTable = new Table({
      name: 'periodos_academicos',
      columns: [
        new TableColumn({ name: 'id', type: 'int', isPrimary: true }),
        new TableColumn({ name: 'codigo', type: 'varchar' }),
      ],
    });

    const mockTables: Record<string, Table> = {
      estudiantes: estudiantesTable,
      solicitudes_cambio: solicitudesTable,
      periodos_academicos: periodosTable,
    };

    const runner = {
      hasTable: jest.fn(async (name: string) => {
        return Boolean(mockTables[name]);
      }),
      getTable: jest.fn(async (name: string) => mockTables[name]),
      createTable: jest.fn(async (table: Table) => {
        createdTables.push(table.name);
      }),
      addColumn: jest.fn(async (tableName: string, column: TableColumn) => {
        addedColumns[tableName] = addedColumns[tableName] || [];
        addedColumns[tableName].push(column.name);
      }),
      changeColumn: jest.fn(async () => {}),
      createForeignKey: jest.fn(async () => {}),
      dropIndex: jest.fn(async (tableName: string, index: TableIndex) => {
        droppedIndices[tableName] = droppedIndices[tableName] || [];
        droppedIndices[tableName].push(index.name!);
      }),
      createIndex: jest.fn(async (tableName: string, index: TableIndex) => {
        createdIndices[tableName] = createdIndices[tableName] || [];
        createdIndices[tableName].push(index.name!);
      }),
    };

    await migration.up(runner as unknown as QueryRunner);

    expect(createdTables).toContain('notificaciones');
    expect(createdTables).toContain('equivalencias_plan');

    expect(addedColumns['estudiantes']).toContain('fecha_graduacion');
    expect(addedColumns['estudiantes']).toContain('graduado_por_usuario_id');
    expect(addedColumns['estudiantes']).toContain('observacion_graduacion');

    expect(droppedIndices['estudiantes']).toContain('IDX_cedula_unique');
    expect(droppedIndices['estudiantes']).toContain('IDX_correo_unique');
    expect(createdIndices['estudiantes']).toContain('UQ_estudiantes_carrera_cedula');

    expect(runner.changeColumn).toHaveBeenCalled();
    expect(addedColumns['solicitudes_cambio']).toContain('observaciones_devolucion');
    expect(addedColumns['solicitudes_cambio']).toContain('motivo_cancelacion');
    expect(addedColumns['solicitudes_cambio']).toContain('historial_versiones');

    expect(addedColumns['periodos_academicos']).toContain('fecha_apertura_actualizacion_docente');
    expect(addedColumns['periodos_academicos']).toContain('fecha_limite_entrega_docente');
    expect(addedColumns['periodos_academicos']).toContain('fecha_limite_revision_docente');
  });

  it('rechaza una reversión descontrolada en down()', async () => {
    await expect(migration.down({} as QueryRunner)).rejects.toThrow('no se revierte automáticamente');
  });
});
