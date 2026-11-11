# Carnet virtual EDUMAS

Plataforma de carnetización digital del Establecimiento de Desarrollo Urbano y Medio Ambiente de Soledad (EDUMAS). Permite al administrador registrar funcionarios (practicantes, contratistas y funcionarios de planta), entregar a cada uno un carnet instalable en el celular (PWA, funciona sin internet), verificar la autenticidad del carnet por código QR y registrar cada presentación con fecha, hora y, si quien escanea lo autoriza, la ubicación.

Desarrollado por el Ing. Manuel Pianeta.

## Arquitectura

| Componente | Tecnología |
|---|---|
| Hosting | Firebase Hosting (sitio estático, sin servidor propio) |
| Base de datos | Cloud Firestore, accedida por su API REST desde el navegador |
| Autenticación | Firebase Authentication (correo y contraseña), API REST de Identity Toolkit |
| App del funcionario | PWA con service worker y caché local |
| Dibujo del carnet | Canvas, plantillas JPG, QR con `qrcode-generator`, PDF con `jsPDF` |
| Fondo blanco de la foto | MediaPipe Selfie Segmentation (Apache 2.0), ejecutado en el navegador del administrador |

No hay backend propio ni Cloud Functions. Toda la seguridad de datos depende de `firestore.rules`.

## Estructura

```
firebase.json          Hosting: rutas /c/** (carnet) y /v/** (verificación), cabeceras
firestore.rules        Reglas de seguridad de Firestore
public/
  admin/               Panel de administración
  carnet/              App instalable del funcionario
  verificar/           Página pública que abre el QR del carnet
  assets/api.js        Cliente REST de Firestore y Auth
  assets/admin.js      Lógica del panel
  assets/carnet.js     Lógica de la app del funcionario
  assets/verificar.js  Verificación y registro de presentaciones
  assets/draw.js       Dibujo del carnet
  assets/config.js     Configuración web de Firebase y correos administradores
  privacidad/          Avisos de privacidad (personal y verificación)
  sw.js                Service worker
  .htaccess            Equivalente de rutas y cabeceras para Apache
scripts/vendor.js      Copia las librerías de node_modules a public/assets
tests/reglas.test.js   Pruebas de firestore.rules con el emulador
package.json           Dependencias con versión fija (jsPDF, qrcode-generator, MediaPipe)
```

## Modelo de datos

| Colección | Contenido | Acceso |
|---|---|---|
| `funcionarios/{id}` | Ficha completa del funcionario, con fecha de autorización de datos | Solo administrador |
| `carnets/{sha256(token:documento)}` | Datos para mostrar el carnet, sin el número de documento (la app lo toma de lo que escribe el titular) | Lectura pública por ID exacto; escritura solo administrador |
| `verificacion/{vtoken}` | Datos públicos de verificación | Lectura pública por ID exacto; escritura solo administrador |
| `registros/{id}` | Presentaciones (QR escaneado, hora, ubicación) | Creación pública validada; lectura y borrado solo administrador; no se puede editar |
| `bitacora/{id}` | Acciones de los administradores: quién, qué y cuándo (hora del servidor) | Lectura y creación solo administrador; no se edita ni se borra |
| `ajustes/entidad` | Datos de la entidad | Lectura pública; escritura solo administrador |

Los administradores se identifican por el correo del token de Firebase Auth (`request.auth.token.email`) con `email_verified == true`, contra la lista de `firestore.rules` y `config.js`.

## Flujos

1. **Alta de funcionario:** el administrador crea la ficha. Se generan un `token` aleatorio (enlace personal `/c/{token}/`) y un `vtoken` aleatorio (QR de verificación `/v/{vtoken}`).
2. **Instalación:** el funcionario abre su enlace o el QR de instalación y escribe su número de documento. El ID del documento en `carnets` es `sha256(token + ":" + documento)`: sin el enlace y el documento no se puede ubicar el carnet.
3. **Verificación:** quien escanea el QR del carnet abre `/v/{vtoken}`, ve el estado (activo, vencido, inactivo) y se crea un documento en `registros` con la hora del servidor y, si se da permiso, la ubicación del dispositivo que escanea.

## Decisiones de seguridad

- Administrador = correo de la lista y correo verificado. El panel pide verificar el correo antes de entrar.
- Lista de colecciones con `list` denegado para usuarios públicos: solo se puede leer un documento conociendo su ID.
- Tokens de 16 a 24 caracteres generados con `crypto.getRandomValues`.
- `registros`: la regla exige campos obligatorios, que `v` exista en `verificacion`, que el nombre coincida, `fecha == request.time`, valores permitidos y rangos de latitud, longitud y precisión. No se pueden editar.
- La copia pública del carnet no guarda el número de documento; la verificación lo muestra enmascarado.
- "Generar enlace y QR nuevos" rota el enlace personal y el QR del carnet; los anteriores dejan de funcionar.
- Eliminar un funcionario borra también sus registros de presentación.
- Sesión del administrador en `sessionStorage`, con un máximo de 8 horas.
- La app sin conexión deja de mostrar el carnet si no se valida en línea en 72 horas; la vigencia usa la hora del servidor de la última validación.
- Sin servicios externos de geocodificación: solo se guardan las coordenadas, con aviso al usuario.
- Cabeceras: Content-Security-Policy sin scripts en línea, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` y HSTS.
- Exportación CSV con neutralización de fórmulas.
- Bitácora de acciones de administración.

## Limitaciones conocidas

- `config.js` contiene la API key web de Firebase (pública por diseño). Debe restringirse por dominio en Google Cloud Console.
- Quien tenga un QR de carnet puede crear registros de presentación de esa persona; no hay límite de frecuencia (requiere Cloud Functions y App Check, plan Blaze).
- No hay límite de intentos en la activación del carnet del lado del servidor (requiere Cloud Functions).
- No se puede revocar el token de sesión desde el cliente; la sesión dura como máximo 8 horas.
- El inicio de sesión del administrador no tiene segundo factor (requiere Identity Platform).
- La foto del funcionario se guarda como data URL dentro de los documentos.
- Sin respaldos automáticos en el plan Spark.

## Desarrollo y despliegue

```
npm install
npm run vendor
npm run test:reglas
firebase deploy
```

`npm run test:reglas` necesita Java 11 o superior para el emulador de Firestore.

## Qué se pide revisar

1. `firestore.rules`: lecturas o escrituras no previstas, enumeración, escalamiento a administrador.
2. Manejo de sesión y tokens en `public/assets/api.js`.
3. XSS o inyección en `admin.js`, `carnet.js` y `verificar.js`.
4. Caché del service worker y datos en `localStorage`.
5. Exposición de datos personales en las rutas públicas.

Reportes de seguridad: ver `SECURITY.md`.
