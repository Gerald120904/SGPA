export async function login(
  correo,
  password
) {

  if (
    !window.sgpa ||
    typeof window.sgpa.login !== 'function'
  ) {

    throw new Error(
      'La API segura de Electron no está disponible.'
    );

  }


  return window.sgpa.login({

    correo,
    password

  });

}