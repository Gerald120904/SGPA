export const estadoEstudiantes = {
 carreraSeleccionada:null, planSeleccionado:null, vistaActual:'CARRERAS',
 carrerasDisponibles:[], planesDisponibles:[], estudiantes:[], catalogoEstudiantes:[],
 solicitudesFormularios:[], registrosBandejaRevision:[], seleccionBandejaRevision:new Set(),
 intervaloSolicitudes:null, instanciaActual:0, timerBusqueda:null, timerBandeja:null,
 versionCarreras:0, versionPlanes:0, versionEstudiantes:0, versionDialog:0,
 versionBandeja:0, versionSolicitudes:0, versionProgreso:0,
};
export const accionesEstudiantes=Object.create(null);
