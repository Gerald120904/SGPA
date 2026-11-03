import {
  AsignaturaFrontend,
  esAsignaturaElegibleFrontend,
  filtrarAsignaturasVisiblesFrontend,
  podarSeleccionesInvalidasFrontend,
  detectarAdvertenciasCorrequisitosFrontend,
} from './evaluador-requisitos-frontend';

describe('EvaluadorRequisitosFrontend (Motor Reactivo)', () => {
  // Materias de prueba para cadena Prog I -> II -> III -> IV y múltiples requisitos
  const prog1: AsignaturaFrontend = {
    asignaturaId: 101,
    codigo: 'EIF201',
    nombre: 'Programación I',
    nivel: 1,
    ciclo: 1,
    detallesRequisitos: [],
  };

  const mate1: AsignaturaFrontend = {
    asignaturaId: 102,
    codigo: 'MAT201',
    nombre: 'Matemática para Informática',
    nivel: 1,
    ciclo: 1,
    detallesRequisitos: [],
  };

  const prog2: AsignaturaFrontend = {
    asignaturaId: 103,
    codigo: 'EIF202',
    nombre: 'Programación II',
    nivel: 1,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 101,
        codigo: 'EIF201',
        nombre: 'Programación I',
        tipo: 'REQUISITO',
      },
    ],
  };

  const prog3: AsignaturaFrontend = {
    asignaturaId: 104,
    codigo: 'EIF203',
    nombre: 'Programación III',
    nivel: 2,
    ciclo: 1,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 103,
        codigo: 'EIF202',
        nombre: 'Programación II',
        tipo: 'REQUISITO',
      },
    ],
  };

  const prog4: AsignaturaFrontend = {
    asignaturaId: 105,
    codigo: 'EIF204',
    nombre: 'Programación IV',
    nivel: 2,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 104,
        codigo: 'EIF203',
        nombre: 'Programación III',
        tipo: 'REQUISITO',
      },
    ],
  };

  const estructuraDatos: AsignaturaFrontend = {
    asignaturaId: 106,
    codigo: 'EIF205',
    nombre: 'Estructuras de Datos',
    nivel: 2,
    ciclo: 1,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 101,
        codigo: 'EIF201',
        nombre: 'Programación I',
        tipo: 'REQUISITO',
      },
      {
        requisitoAsignaturaId: 102,
        codigo: 'MAT201',
        nombre: 'Matemática para Informática',
        tipo: 'REQUISITO',
      },
    ],
  };

  const conCorrequisito: AsignaturaFrontend = {
    asignaturaId: 107,
    codigo: 'EIF301',
    nombre: 'Taller de Programación',
    nivel: 2,
    ciclo: 2,
    detallesRequisitos: [
      {
        requisitoAsignaturaId: 101,
        tipo: 'CORREQUISITO',
      },
    ],
  };

  const inactiva: AsignaturaFrontend = {
    asignaturaId: 108,
    codigo: 'EIF999',
    nombre: 'Curso Antiguo Inactivo',
    nivel: 1,
    ciclo: 1,
    activo: false,
    detallesRequisitos: [],
  };

  const todasLasAsignaturas = [
    prog1,
    mate1,
    prog2,
    prog3,
    prog4,
    estructuraDatos,
    conCorrequisito,
    inactiva,
  ];

  describe('esAsignaturaElegibleFrontend', () => {
    it('debe permitir asignaturas sin requisitos aunque no haya nada aprobado', () => {
      const aprobadas = new Set<number>();
      expect(esAsignaturaElegibleFrontend(prog1, aprobadas)).toBe(true);
      expect(esAsignaturaElegibleFrontend(mate1, aprobadas)).toBe(true);
    });

    it('debe denegar asignaturas con requisitos cuando no han sido aprobados', () => {
      const aprobadas = new Set<number>();
      expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(false);
    });

    it('debe permitir asignatura cuando su requisito simple está aprobado', () => {
      const aprobadas = new Set<number>([101]); // Prog I
      expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(true);
    });

    it('debe evaluar cadena secuencial Prog I -> Prog II -> Prog III -> Prog IV', () => {
      const aprobadas = new Set<number>();
      expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(false);

      aprobadas.add(101); // Prog I
      expect(esAsignaturaElegibleFrontend(prog2, aprobadas)).toBe(true);
      expect(esAsignaturaElegibleFrontend(prog3, aprobadas)).toBe(false);

      aprobadas.add(103); // Prog II
      expect(esAsignaturaElegibleFrontend(prog3, aprobadas)).toBe(true);
      expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(false);

      aprobadas.add(104); // Prog III
      expect(esAsignaturaElegibleFrontend(prog4, aprobadas)).toBe(true);
    });

    it('debe exigir TODOS los requisitos obligatorios cuando son dos o más', () => {
      const aprobadas = new Set<number>([101]); // Solo Prog 1, falta Mate 1
      expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(false);

      aprobadas.add(102); // Prog 1 y Mate 1
      expect(esAsignaturaElegibleFrontend(estructuraDatos, aprobadas)).toBe(true);
    });

    it('no debe bloquear asignaturas con correquisitos bajo política INFORMATIVO (por defecto)', () => {
      const aprobadas = new Set<number>();
      expect(esAsignaturaElegibleFrontend(conCorrequisito, aprobadas)).toBe(true);
    });

    it('debe bloquear preventivamente asignaturas con correquisitos si se especifica BLOQUEAR_REVISION', () => {
      const aprobadas = new Set<number>([101]);
      expect(
        esAsignaturaElegibleFrontend(conCorrequisito, aprobadas, {
          politicaCorrequisito: 'BLOQUEAR_REVISION',
        }),
      ).toBe(false);
    });

    it('debe generar advertencia no bloqueante cuando se selecciona materia con correquisito faltante', () => {
      const aprobadas = new Set<number>([107]); // conCorrequisito seleccionado, pero 101 no
      const advertencias = detectarAdvertenciasCorrequisitosFrontend(
        todasLasAsignaturas,
        aprobadas,
      );
      expect(advertencias).toHaveLength(1);
      expect(advertencias[0].asignaturaId).toBe(107);
      expect(advertencias[0].correquisitoId).toBe(101);
      expect(advertencias[0].mensaje).toContain('Advertencia: Has seleccionado');
    });

    it('no genera advertencia si el correquisito también fue seleccionado', () => {
      const aprobadas = new Set<number>([107, 101]);
      const advertencias = detectarAdvertenciasCorrequisitosFrontend(
        todasLasAsignaturas,
        aprobadas,
      );
      expect(advertencias).toHaveLength(0);
    });

    it('debe denegar asignaturas inactivas', () => {
      const aprobadas = new Set<number>();
      expect(esAsignaturaElegibleFrontend(inactiva, aprobadas)).toBe(false);
    });
  });

  describe('podarSeleccionesInvalidasFrontend', () => {
    it('debe desmarcar en cascada cuando se remueve el requisito raíz (Prog I -> II -> III -> IV)', () => {
      // Estado inicial: estudiante tenía Prog 1, 2, 3 y 4 seleccionadas
      const aprobadas = new Set<number>([101, 103, 104, 105]);

      // Usuario desmarca Prog 1
      aprobadas.delete(101);

      const podadas = podarSeleccionesInvalidasFrontend(
        todasLasAsignaturas,
        aprobadas,
      );

      // Prog 2, 3 y 4 deben haberse podado en cascada
      expect(podadas).toEqual(expect.arrayContaining([103, 104, 105]));
      expect(aprobadas.size).toBe(0);
    });

    it('debe conservar asignaturas independientes cuando se poda una rama', () => {
      // Prog 1, Prog 2 y Mate 1 (independiente)
      const aprobadas = new Set<number>([101, 103, 102]);

      // Desmarca Prog 1
      aprobadas.delete(101);

      const podadas = podarSeleccionesInvalidasFrontend(
        todasLasAsignaturas,
        aprobadas,
      );

      expect(podadas).toEqual([103]);
      expect(aprobadas.has(102)).toBe(true); // Mate 1 se mantiene intacta
      expect(aprobadas.has(103)).toBe(false);
    });

    it('debe podar materia de múltiples requisitos si se remueve solo uno de ellos', () => {
      // Prog 1, Mate 1 y Estructuras de Datos
      const aprobadas = new Set<number>([101, 102, 106]);

      // Desmarca Mate 1
      aprobadas.delete(102);

      const podadas = podarSeleccionesInvalidasFrontend(
        todasLasAsignaturas,
        aprobadas,
      );

      expect(podadas).toEqual([106]);
      expect(aprobadas.has(101)).toBe(true);
      expect(aprobadas.has(106)).toBe(false);
    });
  });

  describe('filtrarAsignaturasVisiblesFrontend', () => {
    it('omite completamente del array las materias no elegibles (regla fundamental)', () => {
      const aprobadas = new Set<number>(); // Nada aprobado

      const visibles = filtrarAsignaturasVisiblesFrontend(
        todasLasAsignaturas,
        aprobadas,
      );

      const idsVisibles = visibles.map((a) => a.asignaturaId);
      // Deben aparecer Prog 1, Mate 1 y conCorrequisito (que es elegible bajo política informativa)
      expect(idsVisibles).toEqual([101, 102, 107]);
      // Prog 2, 3, 4, Estructuras (con prerrequisito faltante) e Inactiva NO DEBEN APARECER
      expect(idsVisibles).not.toContain(103);
      expect(idsVisibles).not.toContain(104);
      expect(idsVisibles).not.toContain(105);
      expect(idsVisibles).not.toContain(106);
      expect(idsVisibles).not.toContain(108);
    });
  });
});
