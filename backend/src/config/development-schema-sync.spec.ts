import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { classifySchemaPlan, synchronizeDevelopmentSchemaSafely } from './development-schema-sync';

describe('sincronización segura de desarrollo', () => {
  it('conserva una FK equivalente aunque TypeORM quiera cambiarle el nombre', () => {
    const old = 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_anterior` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE RESTRICT';
    const plan = classifySchemaPlan([
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_anterior`' },
      { query: 'CREATE INDEX `IDX_hijos_estado` ON `hijos` (`estado`)' },
      { query: 'ALTER TABLE `hijos` ADD CONSTRAINT `FK_nueva` FOREIGN KEY (`padre_id`) REFERENCES `padres`(`id`) ON DELETE CASCADE' },
    ], [
      { query: old },
      { query: 'DROP INDEX `IDX_hijos_estado` ON `hijos`' },
      { query: 'ALTER TABLE `hijos` DROP FOREIGN KEY `FK_nueva`' },
    ]);

    expect(plan.blocked).toEqual([]);
    expect(plan.executable.map((item) => item.query)).toEqual([
      'CREATE INDEX `IDX_hijos_estado` ON `hijos` (`estado`)',
    ]);
    expect(plan.preserved).toEqual(['hijos.FK_anterior']);
  });

  it('permite crear tablas, columnas, índices y relaciones faltantes', () => {
    const queries = [
      { query: 'CREATE TABLE `nueva` (`id` int NOT NULL)' },
      { query: 'ALTER TABLE `existente` ADD `codigo` varchar(20) NULL' },
      { query: 'CREATE UNIQUE INDEX `UQ_codigo` ON `existente` (`codigo`)' },
      { query: 'ALTER TABLE `existente` ADD CONSTRAINT `FK_x` FOREIGN KEY (`x_id`) REFERENCES `x`(`id`)' },
    ];
    expect(classifySchemaPlan(queries, []).executable).toEqual(queries);
  });

  it.each([
    'DROP TABLE `usuarios`',
    'ALTER TABLE `usuarios` DROP COLUMN `correo`',
    'ALTER TABLE `usuarios` CHANGE `correo` `email` varchar(150)',
    'ALTER TABLE `usuarios` MODIFY `correo` varchar(200)',
    'RENAME TABLE `usuarios` TO `personas`',
  ])('bloquea operación destructiva: %s', (query) => {
    const plan = classifySchemaPlan([{ query }], []);
    expect(plan.executable).toEqual([]);
    expect(plan.blocked).toEqual([query]);
  });

  it('permanece desactivada fuera de start:dev y en producción', async () => {
    const dataSource = { isInitialized: true } as DataSource;
    const production = { get: (name: string) => ({ SGPA_START_PROFILE: 'development', NODE_ENV: 'production' })[name] } as ConfigService;
    const normalStart = { get: (name: string) => ({ NODE_ENV: 'development' })[name] } as ConfigService;
    await expect(synchronizeDevelopmentSchemaSafely(dataSource, production)).resolves.toEqual([]);
    await expect(synchronizeDevelopmentSchemaSafely(dataSource, normalStart)).resolves.toEqual([]);
  });
});
