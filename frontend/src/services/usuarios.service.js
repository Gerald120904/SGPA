export async function listarUsuarios() {

  if (
    !window.sgpa ||
    typeof window.sgpa
      .listarUsuarios !==
      'function'
  ) {

    throw new Error(
      'La API segura de Electron no está disponible.'
    );

  }


  return window.sgpa
    .listarUsuarios();

}
