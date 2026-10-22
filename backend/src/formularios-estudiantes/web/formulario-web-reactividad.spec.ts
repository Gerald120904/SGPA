import { Script } from 'node:vm';
import { generarHtmlFormularioPublico } from './formulario-web.template';

describe('formulario público: refresco de prerrequisitos del mismo año', () => {
  it('muestra y oculta dependientes inmediatamente y poda la cadena sin perder la materia independiente', async () => {
    const token = 'a'.repeat(64);
    const html = generarHtmlFormularioPublico(token);
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const subject = (id: number, code: string, level: number, cycle: number, requirements: number[] = []) => ({
      asignaturaId: id, codigo: code, nombre: code, nivel: level, ciclo: cycle, orden: 1,
      activo: true, estado: requirements.length ? 'BLOQUEADA' : 'HABILITADA', creditos: 3,
      detallesRequisitos: requirements.map((requisitoAsignaturaId) => ({ tipo: 'REQUISITO', requisitoAsignaturaId })),
    });
    const catalogo = [
      { nivel: 1, ciclos: [
        { ciclo: 1, asignaturas: [subject(1, 'P1', 1, 1), subject(4, 'LIBRE', 1, 1)] },
        { ciclo: 2, asignaturas: [subject(2, 'P2', 1, 2, [1])] },
      ] },
      { nivel: 2, ciclos: [{ ciclo: 1, asignaturas: [subject(3, 'P3', 2, 1, [2])] }] },
    ];
    const root = { innerHTML: '', listeners: {} as Record<string, (event: any) => void>,
      addEventListener(type: string, handler: (event: any) => void) { this.listeners[type] = handler; },
      contains: () => true };
    const inputs: Record<string, string> = {
      'input-identificacion': 'QA-001', 'input-primer-nombre': 'Prueba',
      'input-segundo-nombre': '', 'input-primer-apellido': 'Sintetica',
      'input-segundo-apellido': '', 'input-correo': 'qa@example.test',
      'input-contacto': '', 'input-periodo': '1',
    };
    const elements = new Map<string, any>();
    const getElementById = (id: string) => {
      if (id === 'step-content') return root;
      if (!elements.has(id)) elements.set(id, {
        value: inputs[id] ?? '', style: {}, textContent: '',
        setAttribute: () => undefined,
      });
      return elements.get(id);
    };
    let ready: (() => Promise<void>) | undefined;
    const windowObject: Record<string, any> = {
      location: { pathname: `/formularios/p/${token}` }, scrollTo: () => undefined,
    };
    new Script(script!).runInNewContext({
      window: windowObject,
      document: {
        addEventListener: (_type: string, callback: () => Promise<void>) => { ready = callback; },
        getElementById,
      },
      fetch: async () => ({ ok: true, json: async () => ({
        formulario: { titulo: 'QA', descripcion: '' },
        carrera: { nombre: 'QA' }, planEstudio: { nombre: 'QA' },
        periodos: [{ id: 1, nombre: 'QA', codigo: 'QA' }], catalogo,
      }) }),
      setTimeout: () => undefined,
    });
    await ready!();
    windowObject.__sgpaAvanzarDatos();
    expect(root.innerHTML).toContain('P1');
    expect(root.innerHTML).not.toContain('P2');

    const change = (id: number, checked: boolean) => root.listeners.change({ target: {
      matches: () => true, dataset: { asignaturaId: String(id) }, checked,
    } });
    change(4, true);
    change(1, true);
    expect(root.innerHTML).toContain('P2');
    change(2, true);
    windowObject.__sgpaAvanzar();
    expect(root.innerHTML).toContain('P3');
    change(3, true);
    windowObject.__sgpaRetroceder();
    change(1, false);
    expect(root.innerHTML).not.toContain('P2');
    expect(root.innerHTML).toMatch(/id="chk-asig-4"[^>]*checked/);
    change(1, true);
    expect(root.innerHTML).toMatch(/id="chk-asig-2"[^>]*value="2"\s*>/);
    change(2, true);
    windowObject.__sgpaAvanzar();
    expect(root.innerHTML).toMatch(/id="chk-asig-3"[^>]*value="3"\s*>/);
  });
});
