const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const {
  assertSchemaAvailable,
  assertTargetIdentity,
  isEphemeralDataDir,
  parseArguments,
} = require('../../scripts/verify-etapa4-native-mysql');

describe('salvaguardas de verify-etapa4-native-mysql', () => {
  const uuid = '11111111-2222-3333-4444-555555555555';
  const datadir = path.join(os.tmpdir(), 'sgpa-jerarquia-prueba', 'data');
  const validos = [
    '--port=13379',
    `--uuid=${uuid}`,
    `--datadir=${datadir}`,
    '--schema=sgpa_etapa4_qa_20261020a',
  ];

  it('acepta solamente una configuración temporal explícita', () => {
    expect(parseArguments(validos)).toEqual({
      port: 13379,
      uuid,
      datadir: path.resolve(datadir),
      schema: 'sgpa_etapa4_qa_20261020a',
    });
    expect(isEphemeralDataDir(datadir)).toBe(true);
  });

  it.each([
    'sgpa',
    'sgpa_test',
    'produccion',
    'sgpa_etapa4_qa-malicioso',
    'sgpa_etapa4_qa` DROP DATABASE sgpa',
    'SGPA_ETAPA4_QA_PRUEBA',
  ])('rechaza el esquema no autorizado %s', (schema: string) => {
    expect(() => parseArguments(validos.map((arg: string) =>
      arg.startsWith('--schema=') ? `--schema=${schema}` : arg,
    ))).toThrow();
  });

  it('rechaza parámetros faltantes, repetidos, desconocidos o ambiguos', () => {
    expect(() => parseArguments(validos.slice(0, 3))).toThrow('Falta el parámetro obligatorio --schema');
    expect(() => parseArguments([...validos, '--schema=sgpa_etapa4_qa_otro'])).toThrow('Parámetro duplicado');
    expect(() => parseArguments([...validos, '--force=true'])).toThrow('Parámetro no permitido');
    expect(() => parseArguments([...validos, '--schema'])).toThrow('Parámetro no permitido');
  });

  it('rechaza esquemas preexistentes y no contiene una operación DROP DATABASE', () => {
    expect(() => assertSchemaAvailable([], 'sgpa_etapa4_qa_nuevo')).not.toThrow();
    expect(() => assertSchemaAvailable([{ existente: 1 }], 'sgpa_etapa4_qa_existente'))
      .toThrow('ya existe');
    const source = fs.readFileSync(path.resolve(__dirname, '../../scripts/verify-etapa4-native-mysql.js'), 'utf8');
    expect(source).not.toMatch(/DROP\s+DATABASE/i);
  });

  it('rechaza el puerto habitual, UUID inválido y datadir fuera del temporal', () => {
    expect(() => parseArguments(validos.map((arg: string) => arg.startsWith('--port=') ? '--port=3306' : arg))).toThrow();
    expect(() => parseArguments(validos.map((arg: string) => arg.startsWith('--uuid=') ? '--uuid=no-es-uuid' : arg))).toThrow();
    expect(() => parseArguments(validos.map((arg: string) =>
      arg.startsWith('--datadir=') ? `--datadir=${path.resolve('mysql-persistente')}` : arg,
    ))).toThrow();
  });

  it('exige que fuente y destino tengan identidad física diferente', () => {
    const source = { db: 'sgpa', port: 3306, uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      datadir: path.join('C:', 'mysql', 'data') };
    const target = { db: null, port: 13379, uuid, datadir };
    expect(() => assertTargetIdentity(source, target, { port: 13379, uuid, datadir: path.resolve(datadir) }))
      .not.toThrow();
    expect(() => assertTargetIdentity(source, { ...target, uuid: source.uuid },
      { port: 13379, uuid: source.uuid, datadir: path.resolve(datadir) })).toThrow('mismo UUID');
    expect(() => assertTargetIdentity({ ...source, port: 13379 }, target,
      { port: 13379, uuid, datadir: path.resolve(datadir) })).toThrow('mismo puerto');
  });
});
