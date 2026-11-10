# Respuesta al reporte de vulnerabilidades

Reporte atendido: «Reporte de vulnerabilidades y cambios necesarios», 9-nov-2026, sobre el commit `2b03d6b`.
Versión con los cambios: 1.1.0 (10-nov-2026).

Estados:
- **Corregido:** resuelto en el código de este repositorio.
- **Parcial:** se corrigió lo que se puede hacer en el código con el plan Spark; queda una parte pendiente.
- **TI / Jurídica:** depende de la consola de Firebase, de Google Cloud o de una decisión de la entidad.

## Hallazgos

| ID | Estado | Qué se hizo | Qué falta |
|---|---|---|---|
| H-01 | Parcial | Las reglas exigen `email_verified == true` además del correo de la lista. El panel pide verificar el correo antes de entrar. | TI: deshabilitar el registro libre de usuarios en Authentication y revisar la lista de usuarios. Los claims de rol requieren el Admin SDK. |
| H-02 | Parcial | Se eliminaron el guardia y la ofuscación de `api.js`. El crédito queda como texto plano en el pie de página. `SECURITY.md` apunta al correo institucional. | TI: propietarios institucionales del proyecto y transferencia del repositorio. Jurídica: cesión de derechos. |
| H-03 | Parcial | La copia pública del carnet ya no guarda el número de documento: la app lo toma de lo que escribe el titular. | Decisión de la entidad sobre el RH en el carnet. El límite de intentos y el vencimiento de enlaces requieren Cloud Functions. |
| H-04 | Parcial | Se agregaron el aviso de privacidad (`/privacidad/`), la confirmación obligatoria de la autorización del titular en el panel (con fecha) y el aviso de ubicación en `/v/`. Se retiró Nominatim: solo se guardan coordenadas. | Jurídica: validar el texto del aviso, la política de tratamiento y el registro en el RNBD. |
| H-05 | Parcial | Las reglas validan campos obligatorios, tipos, longitudes y rangos de `tipo`, `cargo`, `lat`, `lng`, `precision` y `dispositivo`, y la coherencia entre `ubicacion` y las coordenadas. | App Check y creación de registros por Cloud Function con límite (plan Blaze). |
| H-06 | Parcial | Se agregaron CSP estricta, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS. La sesión pasó a `sessionStorage`, con un máximo de 8 horas. | La revocación del token requiere el Admin SDK. TI: cuentas nominales y MFA o SSO. |
| H-07 | Parcial | Bitácora inmutable de acciones (`bitacora`). Al eliminar un funcionario se borran sus registros de presentación. | TI: respaldos programados (plan Blaze) y prueba de restauración. Borrado lógico (papelera). |
| H-08 | Corregido | Sin conexión, el carnet deja de mostrarse a las 72 horas de la última validación. La vigencia usa la hora del servidor (`readTime`) y no retrocede si se atrasa el reloj. | — |
| H-09 | Parcial | «Generar enlace y QR nuevos» ahora rota también el QR del carnet y borra la verificación anterior; el historial conserva los registros anteriores. | QR efímero firmado (requiere un servidor que firme). |
| H-10 | Corregido | El CSV neutraliza celdas que comienzan con `=`, `+`, `-`, `@`, tabulación o retorno. | — |
| H-11 | Parcial | `package.json` y `package-lock.json` con versiones fijas; jsPDF actualizado de 2.5.1 a 4.2.1; `npm audit`: 0 vulnerabilidades en dependencias de producción; `scripts/vendor.js` copia las librerías. | CI con `npm audit`. |
| H-12 | Corregido | Cabeceras completas en todas las rutas (`firebase.json` y `.htaccess`). Se retiró Nominatim. | — |
| H-13 | TI | El repositorio se creó como privado. | TI: confirmar que sigue privado y restringir la API key por referente y por API. |
| H-14 | Parcial | Pruebas de reglas en `tests/reglas.test.js` (`npm run test:reglas`). Pruebas de extremo a extremo del panel, la app y la verificación con datos simulados. | CI/CD, entornos separados y validaciones del lado del servidor. |

## Acciones del reporte que dependen de la entidad

| # | Acción | Responsable |
|---|---|---|
| 1 | Deshabilitar el registro libre de usuarios y revisar cuentas | TI |
| 2 | Agregar al menos dos propietarios institucionales al proyecto | TI |
| 3 | Restringir la API key | TI |
| 4 | Presupuesto, alertas y evaluación del plan Blaze | TI / Finanzas |
| 5, 16 | Exportación inicial y respaldos programados | TI |
| 6 | Transferir el repositorio a la organización institucional | TI / Desarrollador |
| 7 | Validar el aviso de privacidad y el formato de autorización | Jurídica |
| 12 | Cuentas nominales y MFA o SSO | TI |
| 17 | Dominio institucional | TI |
| 18 | Cesión de derechos y contratos | Jurídica |
| 27 | Prueba de penetración independiente | Tercero |

## Pasos al publicar esta versión

1. Publicar con `firebase deploy` (sitio y reglas).
2. Cada administrador entra al panel y verifica su correo.
3. En **Entidad**, tocar una vez **Actualizar carnets publicados** para retirar el número de documento de las copias públicas existentes.
4. Los carnets instalados se actualizan solos al abrirse con conexión.
