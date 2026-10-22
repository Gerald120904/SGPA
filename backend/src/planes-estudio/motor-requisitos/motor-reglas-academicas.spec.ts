import { TipoRequisito } from '../constants/tipo-requisito.constant';
import { MotorReglasAcademicas } from './motor-reglas-academicas';
import {
  AsignaturaRegla,
  PoliticaCorrequisito,
  RequisitoRegla,
} from './types/motor-reglas.types';

describe('MotorReglasAcademicas (Subfase 1A)', () => {
  const crearAsignatura = (
    id: number,
    codigo: string,
    nombre: string,
    nivel: number,
    ciclo: number,
    activo = true,
    planEstudioId = 1,
  ): AsignaturaRegla => ({
    id,
    planEstudioId,
    codigo,
    nombre,
    nivel,
    ciclo,
    orden: id,
    activo,
    creditos: 4,
  });

  const crearRequisito = (
    asignaturaId: number,
    requisitoAsignaturaId: number,
    tipo: TipoRequisito = TipoRequisito.REQUISITO,
  ): RequisitoRegla => ({
    asignaturaId,
    requisitoAsignaturaId,
    tipo,
  });

  describe('1. Asignaturas sin prerrequisitos', () => {
    it('debe marcar como HABILITADA cualquier asignatura que no tenga requisitos previos', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'MAT001', 'Matemática para Informática', 1, 1),
      ];
      const requisitos: RequisitoRegla[] = [];

      const resultado = MotorReglasAcademicas.evaluar(asignaturas, requisitos, []);

      expect(resultado.esValido).toBe(true);
      expect(resultado.asignaturas).toHaveLength(2);
      expect(resultado.mapaAsignaturas.get(1)?.estado).toBe('HABILITADA');
      expect(resultado.mapaAsignaturas.get(2)?.estado).toBe('HABILITADA');
      expect(resultado.mapaAsignaturas.get(1)?.requisitosFaltantes).toHaveLength(0);
    });
  });

  describe('2. Prerrequisito cumplido', () => {
    it('debe habilitar la asignatura cuando su prerrequisito está marcado como aprobado', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [crearRequisito(2, 1)];

      const resultado = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1]);

      expect(resultado.esValido).toBe(true);
      expect(resultado.aprobadasValidas).toEqual([1]);
      const prog2 = resultado.mapaAsignaturas.get(2)!;
      expect(prog2.estado).toBe('HABILITADA');
      expect(prog2.bloqueadaPorRequisitos).toBe(false);
      expect(prog2.requisitosFaltantes).toHaveLength(0);
    });
  });

  describe('3. Prerrequisito no cumplido', () => {
    it('debe mantener como BLOQUEADA una asignatura cuyo requisito no ha sido aprobado', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [crearRequisito(2, 1)];

      const resultado = MotorReglasAcademicas.evaluar(asignaturas, requisitos, []);

      expect(resultado.esValido).toBe(true);
      expect(resultado.aprobadasValidas).toEqual([]);
      const prog2 = resultado.mapaAsignaturas.get(2)!;
      expect(prog2.estado).toBe('BLOQUEADA');
      expect(prog2.bloqueadaPorRequisitos).toBe(true);
      expect(prog2.requisitosFaltantes).toHaveLength(1);
      expect(prog2.requisitosFaltantes[0].requisitoAsignaturaId).toBe(1);
      expect(prog2.motivoBloqueo).toContain('EIF201');
    });
  });

  describe('4. Cadena lineal de requisitos (Programación I -> II -> III -> IV)', () => {
    const asignaturas: AsignaturaRegla[] = [
      crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
      crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
      crearAsignatura(3, 'EIF203', 'Programación III', 2, 1),
      crearAsignatura(4, 'EIF204', 'Programación IV', 2, 2),
    ];
    const requisitos: RequisitoRegla[] = [
      crearRequisito(2, 1),
      crearRequisito(3, 2),
      crearRequisito(4, 3),
    ];

    it('habilita secuencialmente cada nivel según avanza la aprobación', () => {
      // Caso 4a: Solo Prog I aprobada
      const res1 = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1]);
      expect(res1.mapaAsignaturas.get(1)?.aprobada).toBe(true);
      expect(res1.mapaAsignaturas.get(2)?.estado).toBe('HABILITADA');
      expect(res1.mapaAsignaturas.get(3)?.estado).toBe('BLOQUEADA');
      expect(res1.mapaAsignaturas.get(4)?.estado).toBe('BLOQUEADA');

      // Caso 4b: Prog I y Prog II aprobadas
      const res2 = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 2]);
      expect(res2.mapaAsignaturas.get(2)?.aprobada).toBe(true);
      expect(res2.mapaAsignaturas.get(3)?.estado).toBe('HABILITADA');
      expect(res2.mapaAsignaturas.get(4)?.estado).toBe('BLOQUEADA');

      // Caso 4c: Prog I, II y III aprobadas
      const res3 = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 2, 3]);
      expect(res3.mapaAsignaturas.get(3)?.aprobada).toBe(true);
      expect(res3.mapaAsignaturas.get(4)?.estado).toBe('HABILITADA');

      // Caso 4d: Todas aprobadas
      const res4 = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 2, 3, 4]);
      expect(res4.aprobadasValidas).toEqual([1, 2, 3, 4]);
      expect(res4.mapaAsignaturas.get(4)?.aprobada).toBe(true);
      expect(res4.mapaAsignaturas.get(4)?.estado).toBe('HABILITADA');
    });

    it('rechaza saltos inválidos: Prog III no puede estar aprobada si falta Prog II', () => {
      // El estudiante intenta marcar Prog I y Prog III sin Prog II
      const resInvalido = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 3]);

      expect(resInvalido.aprobadasValidas).toEqual([1]);
      expect(resInvalido.desmarcadasCascada).toHaveLength(1);
      expect(resInvalido.desmarcadasCascada[0].asignaturaId).toBe(3);
      expect(resInvalido.mapaAsignaturas.get(3)?.aprobada).toBe(false);
      expect(resInvalido.mapaAsignaturas.get(3)?.estado).toBe('BLOQUEADA');
    });
  });

  describe('5. Múltiples requisitos obligatorios (Lógica AND)', () => {
    it('requiere que TODOS los requisitos obligatorios estén aprobados para habilitar', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Bases de Datos I', 1, 2),
        crearAsignatura(3, 'EIF301', 'Taller de Programación', 2, 1),
      ];
      // Taller requiere Programación I Y Bases de Datos I
      const requisitos: RequisitoRegla[] = [
        crearRequisito(3, 1),
        crearRequisito(3, 2),
      ];

      // Solo 1 requisito aprobado -> Sigue bloqueada
      const resSoloProg1 = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1]);
      const taller1 = resSoloProg1.mapaAsignaturas.get(3)!;
      expect(taller1.estado).toBe('BLOQUEADA');
      expect(taller1.requisitosFaltantes).toHaveLength(1);
      expect(taller1.requisitosFaltantes[0].requisitoAsignaturaId).toBe(2);

      // Solo 2do requisito aprobado -> Sigue bloqueada
      const resSoloBD = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [2]);
      const taller2 = resSoloBD.mapaAsignaturas.get(3)!;
      expect(taller2.estado).toBe('BLOQUEADA');
      expect(taller2.requisitosFaltantes).toHaveLength(1);
      expect(taller2.requisitosFaltantes[0].requisitoAsignaturaId).toBe(1);

      // Ambos aprobados -> HABILITADA
      const resAmbos = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 2]);
      const taller3 = resAmbos.mapaAsignaturas.get(3)!;
      expect(taller3.estado).toBe('HABILITADA');
      expect(taller3.requisitosFaltantes).toHaveLength(0);
    });
  });

  describe('6. Dependencias ramificadas (1 requisito habilita varias)', () => {
    it('permite que una asignatura previa habilite múltiples ramas independientes', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
        crearAsignatura(3, 'EIF205', 'Estructuras de Datos', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1),
        crearRequisito(3, 1),
      ];

      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1]);

      expect(res.mapaAsignaturas.get(2)?.estado).toBe('HABILITADA');
      expect(res.mapaAsignaturas.get(3)?.estado).toBe('HABILITADA');
    });
  });

  describe('7. Desmarcado en cascada y propagación transitiva', () => {
    it('invalida todas las asignaturas dependientes cuando se desmarca un requisito previo', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
        crearAsignatura(3, 'EIF203', 'Programación III', 2, 1),
        crearAsignatura(4, 'EIF204', 'Programación IV', 2, 2),
      ];
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1),
        crearRequisito(3, 2),
        crearRequisito(4, 3),
      ];

      // El estudiante tenía [1, 2, 3, 4] y desmarca Prog I (queda [2, 3, 4])
      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [2, 3, 4]);

      // Deben podarse 4, 3 y 2 en cascada
      expect(res.aprobadasValidas).toEqual([]);
      expect(res.desmarcadasCascada).toHaveLength(3);

      const idsPodados = res.desmarcadasCascada.map((d) => d.asignaturaId);
      expect(idsPodados).toContain(2);
      expect(idsPodados).toContain(3);
      expect(idsPodados).toContain(4);

      // Todas deben quedar bloqueadas excepto Prog I (que no tiene requisitos)
      expect(res.mapaAsignaturas.get(1)?.estado).toBe('HABILITADA');
      expect(res.mapaAsignaturas.get(2)?.estado).toBe('BLOQUEADA');
      expect(res.mapaAsignaturas.get(3)?.estado).toBe('BLOQUEADA');
      expect(res.mapaAsignaturas.get(4)?.estado).toBe('BLOQUEADA');
    });
  });

  describe('8. Asignaturas independientes que no deben afectarse', () => {
    it('mantiene intactas las asignaturas de otras líneas o áreas curriculares', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
        crearAsignatura(10, 'LET101', 'Comunicación Oral y Escrita', 1, 1),
        crearAsignatura(11, 'LET102', 'Inglés I', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1),
        crearRequisito(11, 10),
      ];

      // Desmarcar Prog I dejando [2, 10, 11]
      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [2, 10, 11]);

      // Prog II se poda, pero LET101 y LET102 se conservan aprobadas
      expect(res.aprobadasValidas).toEqual([10, 11]);
      expect(res.desmarcadasCascada.map((d) => d.asignaturaId)).toEqual([2]);
      expect(res.mapaAsignaturas.get(10)?.aprobada).toBe(true);
      expect(res.mapaAsignaturas.get(11)?.aprobada).toBe(true);
      expect(res.mapaAsignaturas.get(11)?.estado).toBe('HABILITADA');
    });
  });

  describe('9. Asignaturas inexistentes o ajenas al plan', () => {
    it('ignora identificadores que no pertenecen al catálogo del plan sin alterar los válidos', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
      ];
      const requisitos: RequisitoRegla[] = [];

      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 9999, -5]);

      expect(res.aprobadasValidas).toEqual([1]);
      expect(res.solicitadasOriginales).toContain(1);
    });

    it('detecta inconsistencia si un requisito exige una asignatura inexistente', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
      ];
      const requisitos: RequisitoRegla[] = [crearRequisito(1, 999)];

      const validacion = MotorReglasAcademicas.validarGrafo(asignaturas, requisitos);

      expect(validacion.esValido).toBe(false);
      expect(validacion.inconsistencias.some((msg) => msg.includes('#999'))).toBe(true);
    });
  });

  describe('10. Dependencias cíclicas y autorreferencias', () => {
    it('detecta ciclos directos (A -> B -> A)', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Prog I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Prog II', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1),
        crearRequisito(1, 2), // Ciclo
      ];

      const validacion = MotorReglasAcademicas.validarGrafo(asignaturas, requisitos);

      expect(validacion.esValido).toBe(false);
      expect(validacion.inconsistencias.some((msg) => msg.includes('ciclo'))).toBe(true);
    });

    it('detecta autorreferencias (A -> A)', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Prog I', 1, 1),
      ];
      const requisitos: RequisitoRegla[] = [crearRequisito(1, 1)];

      const validacion = MotorReglasAcademicas.validarGrafo(asignaturas, requisitos);

      expect(validacion.esValido).toBe(false);
      expect(
        validacion.inconsistencias.some((msg) =>
          msg.includes('no puede ser requisito de sí misma'),
        ),
      ).toBe(true);
    });
  });

  describe('11. Asignaturas inactivas', () => {
    it('marca las asignaturas inactivas con estado INACTIVA y no permite que sean aprobadas', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1, false), // inactiva
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2, true),
      ];
      const requisitos: RequisitoRegla[] = [];

      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, [1, 2]);

      expect(res.mapaAsignaturas.get(1)?.estado).toBe('INACTIVA');
      expect(res.mapaAsignaturas.get(1)?.aprobada).toBe(false);
      expect(res.aprobadasValidas).toEqual([2]);
    });
  });

  describe('12. Identificadores repetidos y entradas no numéricas', () => {
    it('depura duplicados y valores espurios de forma determinista', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
      ];
      const requisitos: RequisitoRegla[] = [crearRequisito(2, 1)];

      const entradaSucia = [1, 1, 1, 2, 2, NaN as any, null as any, 'texto' as any];
      const res = MotorReglasAcademicas.evaluar(asignaturas, requisitos, entradaSucia);

      expect(res.aprobadasValidas).toEqual([1, 2]);
    });
  });

  describe('13. Comportamiento determinista', () => {
    it('produce exactamente el mismo resultado ante múltiples ejecuciones con orden arbitrario', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'EIF201', 'Programación I', 1, 1),
        crearAsignatura(2, 'EIF202', 'Programación II', 1, 2),
        crearAsignatura(3, 'EIF203', 'Programación III', 2, 1),
      ];
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1),
        crearRequisito(3, 2),
      ];

      const resultadoReferencia = MotorReglasAcademicas.evaluar(
        asignaturas,
        requisitos,
        [1, 2, 3],
      );

      for (let i = 0; i < 15; i++) {
        // Barajar orden de entrada
        const permutacion = [3, 1, 2].sort(() => Math.random() - 0.5);
        const resultadoActual = MotorReglasAcademicas.evaluar(
          asignaturas,
          requisitos,
          permutacion,
        );

        expect(resultadoActual.aprobadasValidas).toEqual(
          resultadoReferencia.aprobadasValidas,
        );
        expect(resultadoActual.asignaturas.map((a) => a.estado)).toEqual(
          resultadoReferencia.asignaturas.map((a) => a.estado),
        );
      }
    });
  });

  describe('14. Tratamiento específico de CORREQUISITOS', () => {
    it('distingue CORREQUISITO de REQUISITO y aplica la política seleccionada', () => {
      const asignaturas: AsignaturaRegla[] = [
        crearAsignatura(1, 'MAT001', 'Cálculo I', 1, 1),
        crearAsignatura(2, 'FIS001', 'Física I', 1, 1),
      ];
      // Física I tiene como CORREQUISITO a Cálculo I
      const requisitos: RequisitoRegla[] = [
        crearRequisito(2, 1, TipoRequisito.CORREQUISITO),
      ];

      // Política por defecto (BLOQUEAR_REVISION): Sin opciones, bloquea preventivamente
      const resDefecto = MotorReglasAcademicas.evaluar(
        asignaturas,
        requisitos,
        [2],
      );
      expect(resDefecto.aprobadasValidas).toEqual([]);
      expect(resDefecto.desmarcadasCascada).toHaveLength(1);
      expect(resDefecto.desmarcadasCascada[0].motivo).toContain(
        'pendiente de definición de regla académica por el Product Owner',
      );
      expect(resDefecto.mapaAsignaturas.get(2)?.estado).toBe('BLOQUEADA');
      expect(resDefecto.mapaAsignaturas.get(2)?.motivoBloqueo).toContain(
        'pendiente de confirmación de política académica',
      );

      // Política 1: EXIGIR_APROBADO
      const resEstrictoSinCorreq = MotorReglasAcademicas.evaluar(
        asignaturas,
        requisitos,
        [2], // Solo Física marcada
        { politicaCorrequisito: PoliticaCorrequisito.EXIGIR_APROBADO },
      );
      expect(resEstrictoSinCorreq.aprobadasValidas).toEqual([]);
      expect(resEstrictoSinCorreq.desmarcadasCascada).toHaveLength(1);

      // Política 2: INFORMATIVO (Permite aprobado histórico sin bloquear)
      const resInformativo = MotorReglasAcademicas.evaluar(
        asignaturas,
        requisitos,
        [2],
        { politicaCorrequisito: PoliticaCorrequisito.INFORMATIVO },
      );
      expect(resInformativo.aprobadasValidas).toEqual([2]);
      expect(resInformativo.mapaAsignaturas.get(2)?.estado).toBe('HABILITADA');

      // Ambas aprobadas con política estricta
      const resAmbas = MotorReglasAcademicas.evaluar(
        asignaturas,
        requisitos,
        [1, 2],
        { politicaCorrequisito: PoliticaCorrequisito.EXIGIR_APROBADO },
      );
      expect(resAmbas.aprobadasValidas).toEqual([1, 2]);
      expect(resAmbas.mapaAsignaturas.get(2)?.aprobada).toBe(true);
    });
  });
});
