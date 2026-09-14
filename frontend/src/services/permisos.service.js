function validarApi(
  metodo,
) {
  if (
    !window.sgpa ||
    typeof window.sgpa[metodo] !==
      'function'
  ) {
    throw new Error(
      'La API segura de Electron no está disponible.',
    );
  }
}


export async function listarCatalogoPermisos() {
  validarApi(
    'listarCatalogoPermisos',
  );

  return window.sgpa
    .listarCatalogoPermisos();
}


export async function listarPlantillasPermisos() {
  validarApi(
    'listarPlantillasPermisos',
  );

  return window.sgpa
    .listarPlantillasPermisos();
}


export async function listarPermisosUsuario(
  usuarioId,
) {
  validarApi(
    'listarPermisosUsuario',
  );

  return window.sgpa
    .listarPermisosUsuario(
      usuarioId,
    );
}


export async function reemplazarPermisosUsuario(
  usuarioId,
  permisos,
) {
  validarApi(
    'reemplazarPermisosUsuario',
  );

  return window.sgpa
    .reemplazarPermisosUsuario(
      usuarioId,
      permisos,
    );
}
