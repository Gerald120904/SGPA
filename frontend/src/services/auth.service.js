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

export async function solicitarRecuperacion(
  correo
) {

  if (
    !window.sgpa ||
    typeof window.sgpa
      .solicitarRecuperacion !==
      'function'
  ) {

    throw new Error(
      'La API segura de Electron no está disponible.'
    );

  }


  return window.sgpa
    .solicitarRecuperacion({
      correo
    });

}


export async function restablecerPassword(
  correo,
  codigo,
  password
) {

  if (
    !window.sgpa ||
    typeof window.sgpa
      .restablecerPassword !==
      'function'
  ) {

    throw new Error(
      'La API segura de Electron no está disponible.'
    );

  }


  return window.sgpa
    .restablecerPassword({

      correo,
      codigo,
      password

    });

}
