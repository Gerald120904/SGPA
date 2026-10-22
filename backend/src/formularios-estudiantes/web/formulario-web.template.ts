/**
 * Plantilla HTML5 institucional para el formulario web público de estudiantes.
 * Se sirve directamente desde NestJS (mismo origen), sin dependencias de Electron,
 * con paleta institucional de la Universidad Nacional (UNA / SGPA), navegación accesible,
 * soporte multidispositivo y reactividad académica de prerrequisitos.
 */

export function generarHtmlFormularioPublico(token: string): string {
  // Escapar token para evitar inyección en atributos
  const tokenSanitizado = token.replace(/[^a-fA-F0-9]/g, '');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SGPA — Formulario Estudiantil Oficial</title>
  <meta name="description" content="Formulario público de registro de asignaturas aprobadas para estudiantes de la Universidad Nacional (SGPA).">
  <link rel="icon" href="data:,">
  <style>
    :root {
      --color-primary: #BA0C2F;
      --color-primary-dark: #8B001D;
      --color-primary-light: #FDF2F4;
      --color-primary-border: #F8B4BE;
      --color-bg: #F8FAFC;
      --color-card: #FFFFFF;
      --color-text-main: #0F172A;
      --color-text-muted: #475569;
      --color-border: #E2E8F0;
      --color-border-focus: #BA0C2F;
      --color-success: #15803D;
      --color-success-bg: #F0FDF4;
      --color-warning: #B45309;
      --color-warning-bg: #FFFBEB;
      --color-error: #B91C1C;
      --color-error-bg: #FEF2F2;
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --radius: 8px;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--font-family);
      background-color: var(--color-bg);
      color: var(--color-text-main);
      line-height: 1.5;
      padding: 1.5rem 1rem 3rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .container {
      width: 100%;
      max-width: 820px;
    }

    header.header {
      background: var(--color-card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      border-top: 6px solid var(--color-primary);
      padding: 1.5rem 2rem;
      margin-bottom: 1.5rem;
    }

    .header-logo-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .badge-institucional {
      background-color: var(--color-primary-light);
      color: var(--color-primary);
      border: 1px solid var(--color-primary-border);
      padding: 0.25rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    h1.title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-text-main);
      line-height: 1.25;
      margin-bottom: 0.5rem;
    }

    .carrera-info {
      font-size: 0.95rem;
      color: var(--color-text-muted);
      margin-bottom: 0.5rem;
    }

    .descripcion {
      font-size: 0.9rem;
      color: var(--color-text-muted);
      border-top: 1px solid var(--color-border);
      padding-top: 0.75rem;
      white-space: pre-line;
    }

    /* Progress bar */
    .progress-wrapper {
      background: var(--color-card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
    }

    .progress-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: 0.5rem;
    }

    .progress-bar-bg {
      background: var(--color-border);
      height: 8px;
      border-radius: 9999px;
      overflow: hidden;
    }

    .progress-bar-fill {
      background: var(--color-primary);
      height: 100%;
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Cards / Forms */
    .card {
      background: var(--color-card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 2rem;
      margin-bottom: 1.5rem;
    }

    h2.step-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-text-main);
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .step-subtitle {
      font-size: 0.9rem;
      color: var(--color-text-muted);
      margin-bottom: 1.5rem;
    }

    /* Form Fields */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }

    @media (max-width: 640px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
      body {
        padding: 1rem 0.5rem 2rem;
      }
      .card {
        padding: 1.25rem;
      }
      header.header {
        padding: 1.25rem;
      }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-text-main);
    }

    label .required-dot {
      color: var(--color-primary);
      margin-left: 0.15rem;
    }

    input[type="text"],
    input[type="email"],
    select,
    textarea {
      width: 100%;
      padding: 0.65rem 0.85rem;
      font-size: 0.95rem;
      font-family: inherit;
      color: var(--color-text-main);
      background-color: var(--color-card);
      border: 1px solid var(--color-border);
      border-radius: 6px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(186, 12, 47, 0.15);
    }

    .field-hint {
      font-size: 0.775rem;
      color: var(--color-text-muted);
    }

    .field-error {
      font-size: 0.8rem;
      color: var(--color-error);
      display: none;
      margin-top: 0.2rem;
    }

    /* Academic Cycle Section */
    .ciclo-bloque {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.5rem;
    }

    .ciclo-bloque:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .ciclo-titulo {
      font-size: 1rem;
      font-weight: 700;
      color: var(--color-primary-dark);
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .asignaturas-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .asignatura-item {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      background: #F8FAFC;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      transition: background 0.15s, border-color 0.15s;
      cursor: pointer;
    }

    .asignatura-item:hover {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }

    .asignatura-item.seleccionada {
      background: var(--color-primary-light);
      border-color: var(--color-primary-border);
    }

    .asignatura-item input[type="checkbox"] {
      width: 1.25rem;
      height: 1.25rem;
      margin-top: 0.15rem;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .asignatura-info {
      flex: 1;
    }

    .asignatura-codigo-nombre {
      font-size: 0.925rem;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .asignatura-meta {
      font-size: 0.8rem;
      color: var(--color-text-muted);
      margin-top: 0.15rem;
    }

    .nota-poda {
      background: var(--color-warning-bg);
      border: 1px solid #FCD34D;
      color: var(--color-warning);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      display: none;
    }

    /* Summary items */
    .summary-section {
      background: #F8FAFC;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
    }

    .summary-section h3 {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--color-text-main);
      margin-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .summary-item-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .summary-item-value {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text-main);
    }

    .declaracion-box {
      background: var(--color-warning-bg);
      border: 1px solid #FDE68A;
      border-radius: 6px;
      padding: 1rem;
      font-size: 0.85rem;
      color: #92400E;
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }

    /* Buttons */
    .btn-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      margin-top: 1.5rem;
    }

    button {
      font-family: inherit;
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: background 0.15s, transform 0.1s;
    }

    button:focus-visible {
      outline: 2px solid var(--color-border-focus);
      outline-offset: 2px;
    }

    .btn-primary {
      background: var(--color-primary);
      color: #FFFFFF;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--color-primary-dark);
    }

    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #FFFFFF;
      color: var(--color-text-main);
      border: 1px solid var(--color-border);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #F1F5F9;
    }

    /* Messages / States */
    .alert {
      padding: 1.25rem;
      border-radius: 6px;
      margin-bottom: 1.5rem;
      font-size: 0.95rem;
    }

    .alert-error {
      background: var(--color-error-bg);
      border: 1px solid #FCA5A5;
      color: var(--color-error);
    }

    .alert-success {
      background: var(--color-success-bg);
      border: 1px solid #86EFAC;
      color: var(--color-success);
    }

    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      gap: 1rem;
      color: var(--color-text-muted);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Honeypot */
    .ohnohoney {
      opacity: 0;
      position: absolute;
      top: 0;
      left: 0;
      height: 0;
      width: 0;
      z-index: -1;
    }
  </style>
</head>
<body>

  <div class="container" id="app-root">
    <!-- Header Institucional -->
    <header class="header" role="banner">
      <div class="header-logo-row">
        <span class="badge-institucional">Universidad Nacional</span>
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--color-text-muted);">SGPA Oficial</span>
      </div>
      <h1 class="title" id="form-titulo">Cargando formulario...</h1>
      <div class="carrera-info" id="form-carrera-plan">Verificando credenciales del formulario...</div>
      <div class="descripcion" id="form-descripcion">Por favor espere mientras se carga la estructura académica.</div>
    </header>

    <!-- Barra de progreso -->
    <div class="progress-wrapper" id="progress-container" style="display: none;" aria-live="polite">
      <div class="progress-meta">
        <span id="step-label">Paso 1 de 3</span>
        <span id="progress-percent">0%</span>
      </div>
      <div class="progress-bar-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="progress-bar">
        <div class="progress-bar-fill" id="progress-fill"></div>
      </div>
    </div>

    <!-- Alertas generales -->
    <div id="general-alert" style="display: none;" role="alert"></div>

    <!-- Contenedor dinámico de pasos -->
    <main id="step-content">
      <div class="card">
        <div class="loading-spinner">
          <div class="spinner"></div>
          <div>Cargando datos académicos del formulario...</div>
        </div>
      </div>
    </main>
  </div>

  <script>
    (function() {
      // 1. Extraer token seguro desde la URL actual
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const token = pathParts[pathParts.length - 1] || '${tokenSanitizado}';

      // 2. Estado reactivo en memoria
      const state = {
        token: token,
        cargado: false,
        formulario: null,
        carrera: null,
        planEstudio: null,
        periodos: [],
        catalogoNiveles: [], // Todos los niveles con asignaturas originales del plan
        asignaturasMap: new Map(), // id -> AsignaturaFrontend
        pasosDisponibles: [], // Lista dinámica de pasos ['datos', nivel1, nivel2, ..., 'resumen']
        pasoActualIndice: 0,
        // Datos del estudiante
        identificacion: '',
        primerNombre: '',
        segundoNombre: '',
        primerApellido: '',
        segundoApellido: '',
        correoEstudiantil: '',
        contacto: '',
        periodoIngresoId: null,
        optativasNoDisciplinarias: '',
        sitioWeb: '', // Honeypot
        // Conjunto de materias seleccionadas
        aprobadasSeleccionadas: new Set(),
        enviando: false,
        enviadoExitoso: false,
        codigoConfirmacion: null,
        idempotencyKey: null,
      };

      const claveAlmacenamientoIntento = 'sgpa:formulario:intento:' + token;
      function borrarClaveIntento() {
        state.idempotencyKey = null;
        try { window.localStorage.removeItem(claveAlmacenamientoIntento); } catch { /* almacenamiento bloqueado */ }
      }
      function obtenerClaveIntento() {
        if (!window.crypto?.randomUUID) throw new Error('Este navegador no permite crear una clave segura de envío.');
        try {
          const anterior = window.localStorage.getItem(claveAlmacenamientoIntento);
          if (anterior) return anterior;
          const nueva = window.crypto.randomUUID();
          window.localStorage.setItem(claveAlmacenamientoIntento, nueva);
          state.idempotencyKey = nueva;
          return nueva;
        } catch {
          throw new Error('Se necesita almacenamiento local para reintentar el envío de forma segura.');
        }
      }

      // 3. Inicialización
      document.addEventListener('DOMContentLoaded', init);

      async function init() {
        const root = document.getElementById('step-content');
        root.addEventListener('submit', (event) => {
          if (event.target.id === 'form-datos') event.preventDefault();
        });
        root.addEventListener('input', (event) => {
          if (event.target.name === 'sitioWeb') state.sitioWeb = event.target.value;
          if (event.target.id === 'input-optativas') state.optativasNoDisciplinarias = event.target.value;
        });
        root.addEventListener('change', (event) => {
          const input = event.target;
          if (input.matches('input[data-asignatura-id]')) {
            window.__sgpaToggleAsignatura(Number(input.dataset.asignaturaId), input.checked);
          }
        });
        root.addEventListener('click', (event) => {
          const button = event.target.closest('button');
          if (!button || !root.contains(button)) return;
          switch (button.id) {
            case 'btn-siguiente-datos': window.__sgpaAvanzarDatos(); break;
            case 'btn-anterior':
            case 'btn-anterior-resumen': window.__sgpaRetroceder(); break;
            case 'btn-siguiente': window.__sgpaAvanzar(); break;
            case 'btn-enviar-formulario': window.__sgpaEnviarSolicitud(); break;
            default:
              if (button.dataset.sgpaAction === 'print') window.print();
              if (button.dataset.sgpaAction === 'retry') window.location.reload();
          }
        });
        if (!token || token.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(token)) {
          renderErrorCard('Enlace inválido', 'El enlace suministrado no cumple con el formato oficial del SGPA.');
          return;
        }

        try {
          const res = await fetch('/formularios-publicos/' + encodeURIComponent(token));

          if (res.status === 404) {
            renderErrorCard('Formulario no encontrado o revocado', 'El formulario solicitado no existe o el enlace ha sido revocado por la administración académica.');
            return;
          }
          if (res.status === 400) {
            const data = await res.json().catch(() => ({}));
            renderErrorCard('Formulario no disponible', data.message || 'Este formulario se encuentra cerrado y no acepta nuevas respuestas.');
            return;
          }
          if (res.status === 429) {
            renderErrorCard('Límite de solicitudes alcanzado', 'Ha realizado demasiadas consultas. Por favor espere un momento antes de volver a intentar.');
            return;
          }
          if (!res.ok) {
            throw new Error('Error HTTP ' + res.status);
          }

          const data = await res.json();
          procesarDatosFormulario(data);
        } catch (err) {
          renderErrorCard('Error de conexión', 'No fue posible conectar con el servidor del SGPA. Verifique su conexión a internet y recargue la página.');
        }
      }

      function procesarDatosFormulario(data) {
        state.formulario = data.formulario;
        state.carrera = data.carrera;
        state.planEstudio = data.planEstudio;
        state.periodos = data.periodos || [];
        state.catalogoNiveles = data.catalogo || [];

        // Llenar mapa plano de asignaturas
        state.asignaturasMap.clear();
        for (const nivel of state.catalogoNiveles) {
          for (const ciclo of nivel.ciclos) {
            for (const asig of ciclo.asignaturas) {
              state.asignaturasMap.set(asig.asignaturaId, asig);
            }
          }
        }

        // Configurar encabezado
        document.getElementById('form-titulo').textContent = state.formulario.titulo || 'Formulario Estudiantil';
        document.getElementById('form-carrera-plan').textContent =
          (state.carrera.nombre || 'Carrera') + ' — ' + (state.planEstudio.nombre || 'Plan de Estudios');
        document.getElementById('form-descripcion').textContent = state.formulario.descripcion || '';
        document.getElementById('progress-container').style.display = 'block';

        state.cargado = true;
        recalcularPasos();
        renderPasoActual();
      }

      // 4. Lógica reactiva de requisitos
      function esAsignaturaElegible(asig) {
        if (!asig || asig.activo === false || asig.estado === 'INACTIVA' || asig.estado === 'INCONSISTENTE') {
          return false;
        }
        const reqs = asig.detallesRequisitos || [];
        for (const req of reqs) {
          if (req.tipo === 'CORREQUISITO') {
            return false; // Bloqueo preventivo de correquisitos
          }
          if (req.tipo === 'REQUISITO') {
            if (!state.aprobadasSeleccionadas.has(req.requisitoAsignaturaId)) {
              return false; // Falta prerrequisito -> NO ELEGIBLE
            }
          }
        }
        return true;
      }

      function podarSeleccionesInvalidas() {
        let huboCambios = true;
        let podadas = 0;
        while (huboCambios) {
          huboCambios = false;
          for (const asigId of Array.from(state.aprobadasSeleccionadas)) {
            const asig = state.asignaturasMap.get(asigId);
            if (!asig || !esAsignaturaElegible(asig)) {
              state.aprobadasSeleccionadas.delete(asigId);
              huboCambios = true;
              podadas++;
            }
          }
        }
        return podadas;
      }

      function recalcularPasos() {
        // Los pasos son: 'datos', los niveles que tengan al menos 1 asignatura elegible, y 'resumen'
        const pasos = ['datos'];

        for (const nivel of state.catalogoNiveles) {
          let tieneElegibles = false;
          for (const ciclo of nivel.ciclos) {
            for (const asig of ciclo.asignaturas) {
              if (esAsignaturaElegible(asig)) {
                tieneElegibles = true;
                break;
              }
            }
            if (tieneElegibles) break;
          }
          if (tieneElegibles) {
            pasos.push('nivel_' + nivel.nivel);
          }
        }

        pasos.push('resumen');
        state.pasosDisponibles = pasos;

        // Ajustar índice actual si quedó fuera de rango
        if (state.pasoActualIndice >= state.pasosDisponibles.length) {
          state.pasoActualIndice = state.pasosDisponibles.length - 1;
        }
      }

      function actualizarProgreso() {
        const total = state.pasosDisponibles.length;
        const actual = state.pasoActualIndice + 1;
        const porcentaje = Math.round((actual / total) * 100);

        document.getElementById('step-label').textContent = 'Paso ' + actual + ' de ' + total;
        document.getElementById('progress-percent').textContent = porcentaje + '%';
        document.getElementById('progress-bar').setAttribute('aria-valuenow', porcentaje);
        document.getElementById('progress-fill').style.width = porcentaje + '%';
      }

      // 5. Renderizado de vistas
      function renderPasoActual() {
        actualizarProgreso();
        const pasoId = state.pasosDisponibles[state.pasoActualIndice];

        if (pasoId === 'datos') {
          renderPasoDatos();
        } else if (pasoId.startsWith('nivel_')) {
          const nivelNumero = Number(pasoId.replace('nivel_', ''));
          renderPasoNivel(nivelNumero);
        } else if (pasoId === 'resumen') {
          renderPasoResumen();
        }
      }

      function renderPasoDatos() {
        const root = document.getElementById('step-content');

        let periodosHtml = '<option value="">-- Seleccione un período --</option>';
        for (const p of state.periodos) {
          const selected = state.periodoIngresoId === p.id ? 'selected' : '';
          periodosHtml += '<option value="' + p.id + '" ' + selected + '>' + escapeHtml(p.nombre) + ' (' + escapeHtml(p.codigo) + ')</option>';
        }

        root.innerHTML = \`
          <div class="card">
            <h2 class="step-title">Información del Estudiante</h2>
            <p class="step-subtitle">Ingrese sus datos oficiales para asociar correctamente su registro académico.</p>

            <form id="form-datos" novalidate>
              <!-- Honeypot anti-bots invisible -->
              <input type="text" name="sitioWeb" class="ohnohoney" tabindex="-1" autocomplete="off" value="\${escapeHtml(state.sitioWeb)}">

              <div class="form-grid">
                <div class="form-group">
                  <label for="input-identificacion">Identificación oficial <span class="required-dot">*</span></label>
                  <input type="text" id="input-identificacion" value="\${escapeHtml(state.identificacion)}" placeholder="Ej: 118230948" required>
                  <span class="field-error" id="err-identificacion">Ingrese una identificación válida (mínimo 3 caracteres).</span>
                </div>

                <div class="form-group">
                  <label for="input-periodo">Período de ingreso a la carrera <span class="required-dot">*</span></label>
                  <select id="input-periodo" required>
                    \${periodosHtml}
                  </select>
                  <span class="field-error" id="err-periodo">Debe seleccionar su período de ingreso.</span>
                </div>

                <div class="form-group">
                  <label for="input-primer-nombre">Primer nombre <span class="required-dot">*</span></label>
                  <input type="text" id="input-primer-nombre" value="\${escapeHtml(state.primerNombre)}" placeholder="Nombre" required>
                  <span class="field-error" id="err-primer-nombre">El primer nombre es obligatorio.</span>
                </div>

                <div class="form-group">
                  <label for="input-segundo-nombre">Segundo nombre (opcional)</label>
                  <input type="text" id="input-segundo-nombre" value="\${escapeHtml(state.segundoNombre)}" placeholder="Segundo nombre">
                </div>

                <div class="form-group">
                  <label for="input-primer-apellido">Primer apellido <span class="required-dot">*</span></label>
                  <input type="text" id="input-primer-apellido" value="\${escapeHtml(state.primerApellido)}" placeholder="Primer apellido" required>
                  <span class="field-error" id="err-primer-apellido">El primer apellido es obligatorio.</span>
                </div>

                <div class="form-group">
                  <label for="input-segundo-apellido">Segundo apellido (opcional)</label>
                  <input type="text" id="input-segundo-apellido" value="\${escapeHtml(state.segundoApellido)}" placeholder="Segundo apellido">
                </div>

                <div class="form-group">
                  <label for="input-correo">Correo institucional <span class="required-dot">*</span></label>
                  <input type="email" id="input-correo" value="\${escapeHtml(state.correoEstudiantil)}" placeholder="nombre.apellido@estudiantec.cr" required>
                  <span class="field-error" id="err-correo">Ingrese un correo electrónico válido.</span>
                </div>

                <div class="form-group">
                  <label for="input-contacto">Teléfono de contacto (opcional)</label>
                  <input type="text" id="input-contacto" value="\${escapeHtml(state.contacto)}" placeholder="8888-8888">
                </div>
              </div>

              <div class="btn-row" style="justify-content: flex-end;">
                <button type="button" class="btn-primary" id="btn-siguiente-datos">
                  Siguiente &rarr;
                </button>
              </div>
            </form>
          </div>
        \`;
      }

      window.__sgpaAvanzarDatos = function() {
        const idInput = document.getElementById('input-identificacion');
        const p1Input = document.getElementById('input-primer-nombre');
        const a1Input = document.getElementById('input-primer-apellido');
        const correoInput = document.getElementById('input-correo');
        const periodoInput = document.getElementById('input-periodo');

        let valido = true;

        if (!idInput.value || idInput.value.trim().length < 3) {
          document.getElementById('err-identificacion').style.display = 'block';
          valido = false;
        } else {
          document.getElementById('err-identificacion').style.display = 'none';
        }

        if (!p1Input.value || p1Input.value.trim().length < 1) {
          document.getElementById('err-primer-nombre').style.display = 'block';
          valido = false;
        } else {
          document.getElementById('err-primer-nombre').style.display = 'none';
        }

        if (!a1Input.value || a1Input.value.trim().length < 1) {
          document.getElementById('err-primer-apellido').style.display = 'block';
          valido = false;
        } else {
          document.getElementById('err-primer-apellido').style.display = 'none';
        }

        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!correoInput.value || !emailRegex.test(correoInput.value.trim())) {
          document.getElementById('err-correo').style.display = 'block';
          valido = false;
        } else {
          document.getElementById('err-correo').style.display = 'none';
        }

        if (!periodoInput.value) {
          document.getElementById('err-periodo').style.display = 'block';
          valido = false;
        } else {
          document.getElementById('err-periodo').style.display = 'none';
        }

        if (!valido) return;

        // Guardar valores en estado
        state.identificacion = idInput.value.trim();
        state.primerNombre = p1Input.value.trim();
        state.segundoNombre = document.getElementById('input-segundo-nombre').value.trim();
        state.primerApellido = a1Input.value.trim();
        state.segundoApellido = document.getElementById('input-segundo-apellido').value.trim();
        state.correoEstudiantil = correoInput.value.trim();
        state.contacto = document.getElementById('input-contacto').value.trim();
        state.periodoIngresoId = Number(periodoInput.value);

        recalcularPasos();
        state.pasoActualIndice++;
        renderPasoActual();
      };

      function renderPasoNivel(nivelNumero) {
        const root = document.getElementById('step-content');
        const nivel = state.catalogoNiveles.find(n => n.nivel === nivelNumero);

        if (!nivel) {
          state.pasoActualIndice++;
          renderPasoActual();
          return;
        }

        let ciclosHtml = '';
        let totalAsignaturasRenderizadas = 0;

        for (const ciclo of nivel.ciclos) {
          // Filtrar asignaturas elegibles: REGLA FUNDAMENTAL: si no cumple requisitos, NO APARECE
          const asignaturasElegibles = ciclo.asignaturas.filter(asig => esAsignaturaElegible(asig));

          if (asignaturasElegibles.length === 0) {
            continue; // Evitar mostrar ciclo vacío si no tiene materias elegibles
          }

          let itemsHtml = '';
          for (const asig of asignaturasElegibles) {
            totalAsignaturasRenderizadas++;
            const checked = state.aprobadasSeleccionadas.has(asig.asignaturaId) ? 'checked' : '';
            const claseSeleccionada = checked ? 'seleccionada' : '';

            itemsHtml += \`
              <label class="asignatura-item \${claseSeleccionada}" id="asig-item-\${asig.asignaturaId}">
                <input type="checkbox" id="chk-asig-\${asig.asignaturaId}" data-asignatura-id="\${asig.asignaturaId}" value="\${asig.asignaturaId}" \${checked}>
                <div class="asignatura-info">
                  <div class="asignatura-codigo-nombre">\${escapeHtml(asig.codigo)} — \${escapeHtml(asig.nombre)}</div>
                  <div class="asignatura-meta">Créditos: \${asig.creditos || 0}</div>
                </div>
              </label>
            \`;
          }

          ciclosHtml += \`
            <div class="ciclo-bloque">
              <h3 class="ciclo-titulo">Ciclo \${ciclo.ciclo}</h3>
              <div class="asignaturas-list">
                \${itemsHtml}
              </div>
            </div>
          \`;
        }

        root.innerHTML = \`
          <div class="card">
            <h2 class="step-title">Año / Nivel \${nivelNumero}</h2>
            <p class="step-subtitle">Marque las asignaturas que tiene aprobadas en este nivel. Las asignaturas con prerrequisitos pendientes no aparecen en la lista.</p>

            <div id="aviso-poda" class="nota-poda"></div>

            \${totalAsignaturasRenderizadas > 0 ? ciclosHtml : '<div class="alert alert-warning">No hay asignaturas disponibles para este año conforme a sus requisitos cumplidos.</div>'}

            <div class="btn-row">
              <button type="button" class="btn-secondary" id="btn-anterior">
                &larr; Anterior
              </button>
              <button type="button" class="btn-primary" id="btn-siguiente">
                Siguiente &rarr;
              </button>
            </div>
          </div>
        \`;
      }

      window.__sgpaToggleAsignatura = function(asigId, estaMarcada) {
        let podadas = 0;
        if (estaMarcada) {
          state.aprobadasSeleccionadas.add(asigId);
        } else {
          state.aprobadasSeleccionadas.delete(asigId);
          // Al desmarcar, ejecutar poda en cascada de dependencias
          podadas = podarSeleccionesInvalidas();
        }

        recalcularPasos();
        // Rehacer el paso actual: pueden aparecer o desaparecer materias del mismo año.
        renderPasoActual();
        if (podadas > 0) {
          mostrarAvisoPoda('Se desmarcaron ' + podadas + ' materia(s) dependiente(s) porque se eliminó su requisito previo.');
        }
      };

      function mostrarAvisoPoda(msg) {
        const aviso = document.getElementById('aviso-poda');
        if (aviso) {
          aviso.textContent = msg;
          aviso.style.display = 'block';
          setTimeout(() => { if (aviso) aviso.style.display = 'none'; }, 6000);
        }
      }

      function renderPasoResumen() {
        const root = document.getElementById('step-content');
        const periodoObj = state.periodos.find(p => p.id === state.periodoIngresoId);
        const periodoTxt = periodoObj ? (periodoObj.nombre + ' (' + periodoObj.codigo + ')') : 'No indicado';

        // Construir listado de materias aprobadas
        let materiasHtml = '';
        if (state.aprobadasSeleccionadas.size === 0) {
          materiasHtml = '<div style="font-size: 0.9rem; color: var(--color-text-muted); font-style: italic;">No ha marcado ninguna asignatura como aprobada.</div>';
        } else {
          materiasHtml = '<ul style="list-style-type: disc; padding-left: 1.25rem; font-size: 0.9rem;">';
          for (const asigId of state.aprobadasSeleccionadas) {
            const asig = state.asignaturasMap.get(asigId);
            if (asig) {
              materiasHtml += '<li style="margin-bottom: 0.25rem;"><strong>' + escapeHtml(asig.codigo) + '</strong> — ' + escapeHtml(asig.nombre) + ' (Nivel ' + asig.nivel + ', Ciclo ' + asig.ciclo + ')</li>';
            }
          }
          materiasHtml += '</ul>';
        }

        root.innerHTML = \`
          <div class="card">
            <h2 class="step-title">Resumen y Confirmación</h2>
            <p class="step-subtitle">Revise cuidadosamente los datos antes de enviar la solicitud.</p>

            <div class="summary-section">
              <h3>Datos del Estudiante</h3>
              <div class="summary-grid">
                <div>
                  <div class="summary-item-label">Identificación</div>
                  <div class="summary-item-value">\${escapeHtml(state.identificacion)}</div>
                </div>
                <div>
                  <div class="summary-item-label">Nombre Completo</div>
                  <div class="summary-item-value">\${escapeHtml(state.primerNombre)} \${escapeHtml(state.segundoNombre || '')} \${escapeHtml(state.primerApellido)} \${escapeHtml(state.segundoApellido || '')}</div>
                </div>
                <div>
                  <div class="summary-item-label">Correo Institucional</div>
                  <div class="summary-item-value">\${escapeHtml(state.correoEstudiantil)}</div>
                </div>
                <div>
                  <div class="summary-item-label">Período de Ingreso</div>
                  <div class="summary-item-value">\${escapeHtml(periodoTxt)}</div>
                </div>
              </div>
            </div>

            <div class="summary-section">
              <h3>Asignaturas Reportadas como Aprobadas (\${state.aprobadasSeleccionadas.size})</h3>
              \${materiasHtml}
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label for="input-optativas">Optativas no disciplinarias aprobadas (opcional)</label>
              <textarea id="input-optativas" rows="2" placeholder="Indique cursos o talleres optativos institucionales aprobados, si aplica.">\${escapeHtml(state.optativasNoDisciplinarias)}</textarea>
              <span class="field-hint">Si cursó optativas fuera de la malla disciplinaria, descríbalas aquí para revisión.</span>
            </div>

            <div class="declaracion-box">
              <strong>Declaración jurada estudiantil:</strong><br>
              Declaro que las asignaturas reportadas corresponden fielmente a mi avance curricular y entiendo que este registro quedará en estado <strong>PENDIENTE</strong>, sujeto a revisión y aprobación administrativa por la coordinación académica en el SGPA.
            </div>

            <div id="submit-error" class="alert alert-error" style="display: none;"></div>

            <div class="btn-row">
              <button type="button" class="btn-secondary" id="btn-anterior-resumen">
                &larr; Corregir Respuestas
              </button>
              <button type="button" class="btn-primary" id="btn-enviar-formulario">
                Confirmar y Enviar Solicitud &check;
              </button>
            </div>
          </div>
        \`;
      }

      window.__sgpaAvanzar = function() {
        if (state.pasoActualIndice < state.pasosDisponibles.length - 1) {
          state.pasoActualIndice++;
          renderPasoActual();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      window.__sgpaRetroceder = function() {
        if (state.pasoActualIndice > 0) {
          state.pasoActualIndice--;
          renderPasoActual();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      // 6. Envío final al backend
      window.__sgpaEnviarSolicitud = async function() {
        if (state.enviando) return; // Prevención de doble clic
        state.enviando = true;

        const btn = document.getElementById('btn-enviar-formulario');
        const errBox = document.getElementById('submit-error');
        if (errBox) errBox.style.display = 'none';
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Enviando solicitud...';
        }

        const payload = {
          identificacion: state.identificacion.trim(),
          primerNombre: state.primerNombre.trim(),
          segundoNombre: state.segundoNombre?.trim() || null,
          primerApellido: state.primerApellido.trim(),
          segundoApellido: state.segundoApellido?.trim() || null,
          correoEstudiantil: state.correoEstudiantil.trim().toLowerCase(),
          contacto: state.contacto?.trim() || null,
          periodoIngresoId: Number(state.periodoIngresoId),
          asignaturasAprobadasIds: Array.from(state.aprobadasSeleccionadas),
          optativasNoDisciplinarias: state.optativasNoDisciplinarias?.trim() || null,
          sitioWeb: state.sitioWeb || '', // Honeypot
        };

        try {
          payload.idempotencyKey = obtenerClaveIntento();
          const res = await fetch('/formularios-publicos/' + encodeURIComponent(state.token) + '/respuestas', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (res.status === 201 || res.ok) {
            const data = await res.json();
            state.enviadoExitoso = true;
            state.codigoConfirmacion = data.codigoConfirmacion || 'INT-REGISTRADO';
            borrarClaveIntento();
            renderExitoCard();
            return;
          }

          if (res.status === 429) {
            throw new Error('Demasiadas solicitudes. Por favor espere unos momentos antes de volver a presionar enviar.');
          }

          if (res.status === 409) {
            borrarClaveIntento();
            throw new Error('Los datos cambiaron respecto al intento anterior. Revise la solicitud y vuelva a enviarla.');
          }

          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'No fue posible registrar la solicitud. Revise los requisitos.');
        } catch (error) {
          state.enviando = false;
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Confirmar y Enviar Solicitud ✓';
          }
          if (errBox) {
            errBox.textContent = error.message || 'Ocurrió un error inesperado al enviar.';
            errBox.style.display = 'block';
            errBox.scrollIntoView({ behavior: 'smooth' });
          }
        }
      };

      function renderExitoCard() {
        document.getElementById('progress-container').style.display = 'none';
        const root = document.getElementById('step-content');

        root.innerHTML = \`
          <div class="card" style="text-align: center; padding: 3rem 2rem;">
            <div style="font-size: 3.5rem; color: var(--color-success); margin-bottom: 1rem;">&#10003;</div>
            <h2 class="step-title" style="justify-content: center; font-size: 1.5rem; margin-bottom: 0.5rem;">Solicitud Registrada Exitosamente</h2>
            <p style="color: var(--color-text-muted); font-size: 1rem; margin-bottom: 1.5rem;">Su registro ha sido almacenado de manera segura en el sistema.</p>

            <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 6px; padding: 1.25rem; display: inline-block; margin-bottom: 1.5rem; text-align: left; max-width: 500px; width: 100%;">
              <div style="font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase;">Código de Confirmación</div>
              <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-primary-dark); font-family: monospace; letter-spacing: 0.05em;" id="txt-codigo-confirmacion">\${escapeHtml(state.codigoConfirmacion)}</div>

              <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--color-text-muted);">
                <strong>Estado:</strong> <span style="background: var(--color-warning-bg); color: var(--color-warning); font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px;">PENDIENTE</span>
              </div>
            </div>

            <div class="alert alert-success" style="text-align: left; max-width: 600px; margin: 0 auto 1.5rem;">
              <strong>Próximos pasos:</strong><br>
              Las materias reportadas han quedado registradas en revisión administrativa. La coordinación de su carrera en el SGPA verificará las actas de notas antes de dar la aprobación definitiva. Conserve su código de confirmación.
            </div>

            <button type="button" class="btn-secondary" data-sgpa-action="print">
              &#128424; Imprimir Comprobante
            </button>
          </div>
        \`;
      }

      function renderErrorCard(titulo, detalle) {
        document.getElementById('progress-container').style.display = 'none';
        const root = document.getElementById('step-content');
        root.innerHTML = \`
          <div class="card" style="text-align: center; padding: 3rem 2rem;">
            <div style="font-size: 3rem; color: var(--color-error); margin-bottom: 1rem;">&#9888;</div>
            <h2 class="step-title" style="justify-content: center; font-size: 1.35rem; color: var(--color-error); margin-bottom: 0.5rem;">\${escapeHtml(titulo)}</h2>
            <p style="color: var(--color-text-muted); font-size: 0.95rem; max-width: 500px; margin: 0 auto 1.5rem;">\${escapeHtml(detalle)}</p>
            <button type="button" class="btn-secondary" data-sgpa-action="retry">Reintentar</button>
          </div>
        \`;
      }

      function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
    })();
  </script>
</body>
</html>`;
}
