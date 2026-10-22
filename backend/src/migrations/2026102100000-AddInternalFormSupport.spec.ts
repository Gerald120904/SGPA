import { getMetadataArgsStorage, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { FormularioEstudiante } from '../formularios-estudiantes/entities/formulario-estudiante.entity';
import { ProveedorFormulario } from '../formularios-estudiantes/constants/proveedor-formulario.constant';
import { AddInternalFormSupport2026102100000 } from './2026102100000-AddInternalFormSupport';

describe('Migración AddInternalFormSupport2026102100000', () => {
  let migration: AddInternalFormSupport2026102100000;
  let mockTable: Table;
  let mockRunner: {
    query: jest.Mock;
    getTable: jest.Mock;
    addColumn: jest.Mock;
    createIndex: jest.Mock;
    dropIndex: jest.Mock;
    dropColumn: jest.Mock;
  };

  beforeEach(() => {
    migration = new AddInternalFormSupport2026102100000();
    mockTable = new Table({
      name: 'formularios_estudiantes',
      columns: [
        new TableColumn({ name: 'id', type: 'int' }),
        new TableColumn({ name: 'titulo', type: 'varchar' }),
      ],
      indices: [],
    });

    mockRunner = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT DATABASE()')) {
          return Promise.resolve([{ db: 'sgpa_test' }]);
        }
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve([{ total: 0 }]);
        }
        return Promise.resolve([]);
      }),
      getTable: jest.fn().mockResolvedValue(mockTable),
      addColumn: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue(undefined),
      dropIndex: jest.fn().mockResolvedValue(undefined),
      dropColumn: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('up', () => {
    it('mantiene el mapeo de la entidad alineado con VARCHAR(20) y el default de Google', () => {
      const proveedor = getMetadataArgsStorage().columns.find(
        ({ target, propertyName }) =>
          target === FormularioEstudiante && propertyName === 'proveedor',
      );
      const token = getMetadataArgsStorage().columns.find(
        ({ target, propertyName }) =>
          target === FormularioEstudiante && propertyName === 'tokenPublico',
      );

      expect(proveedor?.options).toMatchObject({
        type: 'varchar',
        length: 20,
        default: ProveedorFormulario.GOOGLE_FORMS,
      });
      expect(token?.options).toMatchObject({
        name: 'token_publico',
        type: 'varchar',
        length: 64,
        nullable: true,
      });
      expect(getMetadataArgsStorage().indices).toContainEqual(
        expect.objectContaining({
          target: FormularioEstudiante,
          name: 'UQ_formularios_token_publico',
          unique: true,
        }),
      );
    });

    it('rechaza bases de datos no autorizadas', async () => {
      mockRunner.query.mockResolvedValueOnce([{ db: 'otra_base_de_datos' }]);

      await expect(
        migration.up(mockRunner as unknown as QueryRunner),
      ).rejects.toThrow('Migración de formularios internos bloqueada');
    });

    it('falla si la tabla formularios_estudiantes no existe', async () => {
      mockRunner.getTable.mockResolvedValueOnce(null);

      await expect(
        migration.up(mockRunner as unknown as QueryRunner),
      ).rejects.toThrow('No existe la tabla requerida formularios_estudiantes');
    });

    it('agrega proveedor, ejecuta backfill a GOOGLE_FORMS, y agrega token_publico con índice único', async () => {
      await migration.up(mockRunner as unknown as QueryRunner);

      expect(mockRunner.addColumn).toHaveBeenCalledTimes(2);

      const [tabla1, colProveedor] = mockRunner.addColumn.mock.calls[0];
      expect(tabla1).toBe('formularios_estudiantes');
      expect(colProveedor.name).toBe('proveedor');
      expect(colProveedor.default).toBe("'GOOGLE_FORMS'");

      expect(mockRunner.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE formularios_estudiantes SET proveedor = 'GOOGLE_FORMS'"),
      );

      const [tabla2, colToken] = mockRunner.addColumn.mock.calls[1];
      expect(tabla2).toBe('formularios_estudiantes');
      expect(colToken.name).toBe('token_publico');

      expect(mockRunner.createIndex).toHaveBeenCalledTimes(1);
      const [tablaIdx, idxToken] = mockRunner.createIndex.mock.calls[0];
      expect(tablaIdx).toBe('formularios_estudiantes');
      expect(idxToken.name).toBe('UQ_formularios_token_publico');
      expect(idxToken.isUnique).toBe(true);
    });

    it('es idempotente si las columnas e índices ya existen', async () => {
      mockTable = new Table({
        name: 'formularios_estudiantes',
        columns: [
          new TableColumn({ name: 'id', type: 'int' }),
          new TableColumn({ name: 'proveedor', type: 'varchar' }),
          new TableColumn({ name: 'token_publico', type: 'varchar' }),
        ],
        indices: [
          new TableIndex({
            name: 'UQ_formularios_token_publico',
            columnNames: ['token_publico'],
          }),
        ],
      });
      mockRunner.getTable.mockResolvedValue(mockTable);

      await migration.up(mockRunner as unknown as QueryRunner);

      expect(mockRunner.addColumn).not.toHaveBeenCalled();
      expect(mockRunner.createIndex).not.toHaveBeenCalled();
    });
  });

  describe('down', () => {
    it('rechaza reversión fuera de bases autorizadas', async () => {
      mockRunner.query.mockResolvedValueOnce([{ db: 'otra_db' }]);

      await expect(
        migration.down(mockRunner as unknown as QueryRunner),
      ).rejects.toThrow('Reversión bloqueada');
    });

    it('impide reversión si existen formularios INTERNO en la tabla', async () => {
      mockTable = new Table({
        name: 'formularios_estudiantes',
        columns: [
          new TableColumn({ name: 'proveedor', type: 'varchar' }),
          new TableColumn({ name: 'token_publico', type: 'varchar' }),
        ],
        indices: [
          new TableIndex({
            name: 'UQ_formularios_token_publico',
            columnNames: ['token_publico'],
          }),
        ],
      });
      mockRunner.getTable.mockResolvedValue(mockTable);
      mockRunner.query
        .mockResolvedValueOnce([{ db: 'sgpa_test' }])
        .mockResolvedValueOnce([{ total: 3 }]); // 3 formularios internos existentes

      await expect(
        migration.down(mockRunner as unknown as QueryRunner),
      ).rejects.toThrow('existen formularios de proveedor INTERNO registrados');

      expect(mockRunner.dropColumn).not.toHaveBeenCalled();
    });

    it('revierte limpiamente cuando no hay registros INTERNO', async () => {
      mockTable = new Table({
        name: 'formularios_estudiantes',
        columns: [
          new TableColumn({ name: 'proveedor', type: 'varchar' }),
          new TableColumn({ name: 'token_publico', type: 'varchar' }),
        ],
        indices: [
          new TableIndex({
            name: 'UQ_formularios_token_publico',
            columnNames: ['token_publico'],
          }),
        ],
      });
      mockRunner.getTable.mockResolvedValue(mockTable);
      mockRunner.query
        .mockResolvedValueOnce([{ db: 'sgpa_test' }])
        .mockResolvedValueOnce([{ total: 0 }]); // 0 internos

      await migration.down(mockRunner as unknown as QueryRunner);

      expect(mockRunner.dropIndex).toHaveBeenCalledWith(
        'formularios_estudiantes',
        'UQ_formularios_token_publico',
      );
      expect(mockRunner.dropColumn).toHaveBeenCalledWith(
        'formularios_estudiantes',
        'token_publico',
      );
      expect(mockRunner.dropColumn).toHaveBeenCalledWith(
        'formularios_estudiantes',
        'proveedor',
      );
    });
  });
});
