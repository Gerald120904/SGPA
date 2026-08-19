/* =========================================================
   DATOS TEMPORALES / MOCK DEL DASHBOARD
   =========================================================

   ATENCIÓN:

   TODOS LOS DATOS DE ESTE ARCHIVO SON QUEMADOS
   ÚNICAMENTE PARA DESARROLLO DEL PROTOTIPO.

   NO REPRESENTAN DATOS REALES DE LA UNIVERSIDAD NACIONAL.

   ---------------------------------------------------------

   CUANDO EL PRODUCT OWNER ENTREGUE LOS DATOS REALES:

   1. Sustituir este archivo por llamadas al backend.
   2. Crear un dashboard.service.js.
   3. Consumir los endpoints reales de NestJS.
   4. Eliminar estos valores temporales.

   ========================================================= */


export const DASHBOARD_MOCK = {

  /* =======================================================
     PERIODO
     ======================================================= */

  periodo: {

    nombre:
      'II Ciclo 2026',

    campus:
      'Campus Nicoya',

    /*
     * Valores soportados visualmente:
     *
     * ABIERTA
     * ADMINISTRATIVA
     * CERRADA
     */

    estado:
      'ABIERTA',

    estadoTexto:
      'Matrícula abierta',

    fechaInicio:
      '18 may. 2026',

    fechaFin:
      '28 ago. 2026'

  },


  /* =======================================================
     INDICADORES SUPERIORES
     ======================================================= */

  indicadores: [

    {
      id: 'estudiantes',
      icon: 'users',
      value: '1,248',
      label: 'Estudiantes activos',
      detail: '+36 este periodo'
    },

    {
      id: 'cursos',
      icon: 'book-open',
      value: '86',
      label: 'Cursos activos',
      detail: '72 con oferta'
    },

    {
      id: 'profesores',
      icon: 'briefcase',
      value: '54',
      label: 'Profesores asignados',
      detail: '48 disponibles'
    },

    {
      id: 'aulas',
      icon: 'door-open',
      value: '27 / 31',
      label: 'Aulas disponibles',
      detail: '4 ocupadas'
    }

  ],


  /* =======================================================
     DEMANDA POR CARRERA
     ======================================================= */

  demandaCarreras: [

    {
      carrera:
        'Informática',
      estudiantes:
        420
    },

    {
      carrera:
        'Administración',
      estudiantes:
        310
    },

    {
      carrera:
        'Turismo',
      estudiantes:
        285
    },

    {
      carrera:
        'Inglés',
      estudiantes:
        167
    }

  ],


  /* =======================================================
     OFERTA ACADÉMICA
     ======================================================= */

  oferta: {

    cursosOfertados:
      72,

    gruposAbiertos:
      58,

    pendientes:
      14

  },


  /* =======================================================
     ALERTAS
     ======================================================= */

  alertas: [

    {
      type:
        'warning',

      text:
        '4 cursos sin profesor'
    },

    {
      type:
        'danger',

      text:
        '2 aulas sobre capacidad'
    },

    {
      type:
        'attention',

      text:
        '7 grupos con alta demanda'
    }

  ],


  /* =======================================================
     ACTIVIDAD RECIENTE
     ======================================================= */

  actividad: [

    {
      time:
        '21:32',

      icon:
        'book-open',

      text:
        'Se actualizó el curso EIF-408'
    },

    {
      time:
        '20:15',

      icon:
        'briefcase',

      text:
        'Se asignó un profesor a MAT-001'
    },

    {
      time:
        '18:46',

      icon:
        'clipboard-list',

      text:
        'Se creó la oferta del grupo 02'
    },

    {
      time:
        '16:08',

      icon:
        'user-plus',

      text:
        'Se registró un nuevo estudiante'
    }

  ],


  /* =======================================================
     ACCIONES RÁPIDAS
     ======================================================= */

  acciones: [

    {
      title:
        'Crear oferta académica',

      route:
        '/oferta',

      icon:
        'circle-plus'
    },

    {
      title:
        'Registrar estudiante',

      route:
        '/estudiantes',

      icon:
        'user-plus'
    },

    {
      title:
        'Generar proyección',

      route:
        '/proyeccion',

      icon:
        'line-chart'
    }

  ],


  /* =======================================================
     ÚLTIMA ACTUALIZACIÓN TEMPORAL
     ======================================================= */

  ultimaActualizacion:
    'Datos temporales de desarrollo'

};