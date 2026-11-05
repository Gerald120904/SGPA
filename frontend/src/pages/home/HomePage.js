import { escapeHtml } from '../../utils/html.js';
import { obtenerModuloPorRuta } from '../../config/modules.js';
import { puedeAcceder } from '../../config/permissions.js';
import { obtenerRolesEfectivos, obtenerPermisosUsuario } from '../../app/session.js';
import { listarEstudiantes } from '../../services/estudiantes.service.js';

const ACCIONES = [
  { title: 'Crear oferta académica', route: '/oferta', icon: 'circle-plus' },
  { title: 'Registrar estudiante', route: '/estudiantes', icon: 'user-plus' },
  { title: 'Generar proyección', route: '/proyeccion', icon: 'line-chart' },
];

function tarjetaIndicador(icon, label, id) {
  return `<article class="dashboard-stat-card">
    <div class="dashboard-stat-icon"><i data-lucide="${icon}" aria-hidden="true"></i></div>
    <div class="dashboard-stat-data"><strong id="${id}">Sin definir</strong><span>${label}</span>
      <small id="${id}-detalle">Indicador pendiente de definición</small></div>
  </article>`;
}

function tarjetaPanel(titulo, contenido) {
  return `<article class="dashboard-card"><header class="dashboard-card-header"><h3>${titulo}</h3></header>
    <div class="dashboard-card-body">${contenido}</div></article>`;
}

export function HomePage() {
  const roles = obtenerRolesEfectivos();
  const permisos = obtenerPermisosUsuario();

  const puedeVerEstudiantes = puedeAcceder(roles, 'estudiantes', permisos);
  const puedeVerCursos = puedeAcceder(roles, 'cursos', permisos);
  const puedeVerProfesores = puedeAcceder(roles, 'profesores', permisos);
  const puedeVerAulas = puedeAcceder(roles, 'aulas', permisos);

  const accesos = ACCIONES.filter(({ route }) => {
    const modulo = obtenerModuloPorRuta(route);
    return modulo && puedeAcceder(roles, modulo.id, permisos);
  });

  const acciones = accesos.length
    ? accesos.map(({ title, route, icon }) => `<button class="dashboard-action" data-route="${route}" type="button">
        <i data-lucide="${icon}" aria-hidden="true"></i><span>${escapeHtml(title)}</span>
        <i data-lucide="chevron-right" class="action-arrow" aria-hidden="true"></i></button>`).join('')
    : '<p>No hay accesos rápidos disponibles para este usuario.</p>';

  const kpis = [
    puedeVerEstudiantes ? tarjetaIndicador('users', 'Estudiantes activos en carreras autorizadas', 'dashboard-estudiantes-activos') : '',
    puedeVerCursos ? tarjetaIndicador('book-open', 'Cursos activos', 'dashboard-cursos') : '',
    puedeVerProfesores ? tarjetaIndicador('briefcase', 'Profesores asignados', 'dashboard-profesores') : '',
    puedeVerAulas ? tarjetaIndicador('door-open', 'Aulas disponibles', 'dashboard-aulas') : '',
  ].filter(Boolean).join('');

  return `<section class="dashboard-page">
    <div class="dashboard-page-header"><div><h2>Dashboard</h2><p>Resumen académico</p></div>
      <div class="dashboard-updated"><i data-lucide="clock" aria-hidden="true"></i><span>Datos del sistema</span></div></div>
    <div class="dashboard-kpis">
      ${kpis || '<p class="dashboard-no-kpis">No hay indicadores disponibles para el rol activo.</p>'}
    </div>
    <div class="dashboard-insights-grid">
      ${tarjetaPanel('Demanda por carrera', '<p>Indicador pendiente de definición.</p>')}
      ${tarjetaPanel('Estado del periodo', '<p>Periodo actual pendiente de definición.</p>')}
      ${tarjetaPanel('Oferta académica', '<p>Indicadores pendientes de definición.</p>')}
      ${tarjetaPanel('Alertas académicas', '<p>Alertas pendientes de definición.</p>')}
    </div>
    <div class="dashboard-bottom-grid">
      ${tarjetaPanel('Actividad reciente', '<p>Fuente de actividad pendiente de definición.</p>')}
      ${tarjetaPanel('Accesos rápidos', `<div class="dashboard-actions">${acciones}</div>`)}
    </div>
  </section>`;
}

export async function iniciarHomePage() {
  const valor = document.getElementById('dashboard-estudiantes-activos');
  if (!valor) return;
  const detalle = document.getElementById('dashboard-estudiantes-activos-detalle');
  valor.textContent = 'Cargando…';
  if (detalle) detalle.textContent = 'Consultando registros autorizados';
  try {
    const resultado = await listarEstudiantes({ estado: 'ACTIVO' });
    if (!resultado?.ok || !Array.isArray(resultado.estudiantes)) {
      throw new Error(resultado?.message || 'Respuesta de estudiantes inválida.');
    }
    const estudiantes = resultado.estudiantes;
    if (!valor.isConnected) return;
    valor.textContent = String(estudiantes.length);
    if (detalle) detalle.textContent = estudiantes.length ? 'Según los registros autorizados' : 'Sin registros activos';
  } catch {
    if (!valor.isConnected) return;
    valor.textContent = 'No disponible';
    if (detalle) detalle.textContent = 'No se pudo consultar este indicador';
  }
}
