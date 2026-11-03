# Carnet virtual EDUMAS

Plataforma de carnetización digital del Establecimiento de Desarrollo Urbano y Medio Ambiente de Soledad (EDUMAS). Permite al administrador registrar funcionarios (practicantes, contratistas y funcionarios de planta), entregar a cada uno un carnet instalable en el celular (PWA, funciona sin internet), verificar la autenticidad del carnet por código QR y registrar cada presentación con fecha, hora y ubicación.

Desarrollado por el Ing. Manuel Pianeta.

## Arquitectura

| Componente | Tecnología |
|---|---|
| Hosting | Firebase Hosting (sitio estático, sin servidor propio) |
| Base de datos | Cloud Firestore, accedida por su API REST desde el navegador |
| Autenticación | Firebase Authentication (correo y contraseña), API REST de Identity Toolkit |
| App del funcionario | PWA con service worker y caché local |
| Dibujo del carnet | Canvas, plantillas JPG, QR con `qrcode-generator`, PDF con `jsPDF` |
| Geocodificación | Nominatim (OpenStreetMap) |

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
  assets/config.js     Configuración web de Firebase
  sw.js                Service worker
  .htaccess            Equivalente de las rutas para hosting Apache
```

## Modelo de datos

| Colección | Contenido | Acceso |
|---|---|---|
| `funcionarios/{id}` | Ficha completa del funcionario | Solo administrador |
| `carnets/{sha256(token:documento)}` | Datos para mostrar el carnet | Lectura pública por ID exacto; escritura solo administrador |
| `verificacion/{vtoken}` | Datos públicos de verificación | Lectura pública por ID exacto; escritura solo administrador |
| `registros/{id}` | Presentaciones (QR escaneado, hora, ubicación) | Creación pública validada; lectura y borrado solo administrador; no se puede editar |
| `ajustes/entidad` | Datos de la entidad | Lectura pública; escritura solo administrador |

El administrador se identifica por el correo del token de Firebase Auth (`request.auth.token.email`).

## Flujos

1. **Alta de funcionario:** el administrador crea la ficha. Se generan un `token` aleatorio (enlace personal `/c/{token}/`) y un `vtoken` aleatorio (QR de verificación `/v/{vtoken}`).
2. **Instalación:** el funcionario abre su enlace o el QR de instalación y escribe su número de documento. El ID del documento en `carnets` es `sha256(token + ":" + documento)`: sin el enlace y el documento no se puede ubicar el carnet.
3. **Verificación:** quien escanea el QR del carnet abre `/v/{vtoken}`, ve el estado (activo, vencido, inactivo) y se crea un documento en `registros` con la hora del servidor y, si se da permiso, la ubicación del dispositivo que escanea.

## Decisiones de seguridad

- Lista de colecciones con `list` denegado para usuarios públicos: solo se puede leer un documento conociendo su ID.
- Tokens de 20+ caracteres generados con `crypto.getRandomValues`.
- `registros`: la regla exige que `v` exista en `verificacion`, que el nombre coincida, que `fecha == request.time`, valores permitidos para `resultado` y `ubicacion`, y longitudes máximas.
- En la verificación pública el documento de identidad se muestra enmascarado.
- Rutas `/c/**`, `/v/**` y `/admin/**` con `noindex` y `Referrer-Policy: no-referrer`.

## Limitaciones conocidas

- `config.js` contiene la API key web de Firebase. Es pública por diseño en Firebase; la protección de datos está en las reglas. Se recomienda restringir la key por dominio en Google Cloud Console.
- Quien tenga un `vtoken` válido puede crear registros falsos de presentación para ese funcionario.
- La ubicación del registro es la del teléfono que escanea y depende del permiso del usuario.
- Los datos del carnet quedan en `localStorage` del teléfono para uso sin conexión.
- La foto del funcionario se guarda como data URL dentro de los documentos.
- El inicio de sesión del administrador no tiene segundo factor.
- La marca "Desarrollado por" está protegida por ofuscación en `api.js`; no es una medida criptográfica.

## Despliegue

```
npm install -g firebase-tools
firebase login
firebase deploy
```

## Qué se pide revisar

1. `firestore.rules`: lecturas o escrituras no previstas, enumeración, escalamiento a administrador.
2. Manejo de sesión y tokens en `public/assets/api.js`.
3. XSS o inyección en `admin.js`, `carnet.js` y `verificar.js`.
4. Caché del service worker y datos en `localStorage`.
5. Exposición de datos personales en las rutas públicas.

Reportes de seguridad: ver `SECURITY.md`.
