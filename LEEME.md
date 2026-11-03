# Carnet virtual EDUMAS

- **Panel** (`/admin/`): solo entra `comunicaciones@edumas.gov.co` con su contraseña. Es la única cuenta que puede agregar, modificar o eliminar funcionarios.
- **App del funcionario** (`/c/…`): cada funcionario abre su enlace personal, escribe su número de documento e instala el carnet en el celular (iPhone o Android). Funciona sin internet después de abrirlo una vez.
- **Verificación** (`/v/…`): lo que se abre al escanear el QR del carnet.

Proyecto de Firebase: `carnet-edumas` (plan Spark, gratis). La configuración ya está puesta en `public/assets/config.js` y `.firebaserc`.

## Publicar

1. Instala Node.js (versión LTS) desde https://nodejs.org
2. Abre una terminal dentro de esta carpeta (la que tiene `firebase.json`).
   En Windows: abre la carpeta, haz clic en la barra de direcciones, escribe `cmd` y presiona Enter.
3. Ejecuta, uno por uno:

```
npm install -g firebase-tools
firebase login
firebase deploy
```

`firebase login` abre el navegador: entra con la misma cuenta de Google del proyecto.
`firebase deploy` sube la página y las reglas de seguridad. Al terminar muestra la dirección:
`https://carnet-edumas.web.app`

4. Entra a `https://carnet-edumas.web.app/admin/` con `comunicaciones@edumas.gov.co` y su contraseña.

## Uso diario
1. Panel → **Registrar funcionario** → datos y foto → Guardar.
2. En la ficha, **Enviar por WhatsApp** o **Copiar** el enlace personal.
3. El funcionario abre el enlace, escribe su número de documento y toca **Instalar** (Android) o **Compartir → Agregar a inicio** (iPhone).
4. Si alguien deja la entidad: **Desactivar carnet**. En su celular y en el QR aparece como inactivo.
5. Si un enlace llegó a quien no debía: **Generar enlace nuevo**. El anterior deja de servir.
6. **Olvidé mi contraseña** en la pantalla de entrada envía un correo para cambiarla.

## Qué datos son públicos
- La lista de funcionarios solo la ve `comunicaciones@edumas.gov.co`.
- El carnet de cada persona solo se abre con su enlace personal más su número de documento.
- La verificación del QR muestra nombre, foto, tipo, dependencia, vigencia y los últimos 4 dígitos del documento.

## Cambios posteriores
- Datos de la entidad (teléfono, dirección, lema, NIT): pestaña **Entidad** del panel.
- Diseño del carnet: `public/assets/tpl-front.jpg`, `tpl-back.jpg` (1080 × 1500 px) y `public/assets/draw.js`.
- Después de cambiar archivos, ejecuta otra vez `firebase deploy`.
- Para cambiar el correo del administrador, edítalo en `firestore.rules` y `public/assets/config.js` y vuelve a publicar.
- Dominio propio (por ejemplo `carnets.edumas.gov.co`): consola de Firebase → Hosting → Agregar dominio personalizado.
