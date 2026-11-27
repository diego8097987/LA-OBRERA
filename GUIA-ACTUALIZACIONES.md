# Guía de Actualizaciones Automáticas — LA OBRERA POS (.exe)

Tu aplicación **LA OBRERA POS** para **Windows 10 y Windows 11** ya viene conectada de fábrica al repositorio oficial de actualizaciones:

- **Repositorio GitHub:** `https://github.com/diego8097987/LA-OBRERA`
- **Canal de descargas automáticas:** `https://github.com/diego8097987/LA-OBRERA/releases/latest/download`

Todas las computadoras que instalen el `.exe` buscarán actualizaciones automáticamente al abrir y cada 30 minutos **sin tener que configurar nada ni desinstalar la aplicación**.

---

## 1. Cómo instalar por primera vez en cada PC del restaurante

1. Descarga el último instalador `LA-OBRERA-POS-Setup-X.Y.Z.exe` desde:
   `https://github.com/diego8097987/LA-OBRERA/releases/latest`
2. Ejecútalo en cada computadora (Administrador, Mesero, Cocina, Cajero). Se instalará en español sin requerir contraseña de administrador del sistema.

---

## 2. Cómo hacer cambios y publicar una actualización para TODOS

Cuando modifiques algo en el sistema (`src\...`):

1. Haz doble clic en **`publicar-actualizacion.bat`** (o ejecuta `npm.cmd run release:patch`).
2. El script automáticamente:
   - Sube la versión (por ejemplo `1.0.1 → 1.0.2`).
   - Verifica TypeScript (`lint`) y corre todas las pruebas (`test`).
   - Compila el nuevo `.exe`, `latest.yml` y `.blockmap`.
   - Sube el código y crea automáticamente el **Release en GitHub (`diego8097987/LA-OBRERA`)** con los 3 archivos listos.

---

## 3. Qué verán los usuarios cuando publiques una nueva versión

1. Al abrir **LA OBRERA POS** (o al pulsar el botón de versión **`v1.0.1 → Buscar actualizaciones ahora`**), aparecerá automáticamente una barra en la parte superior avisando la nueva versión disponible.
2. El usuario hace clic en **"Descargar ahora"** (con barra de progreso y verificación de integridad SHA-512).
3. Al terminar, hace clic en **"Instalar y reiniciar"**.
4. La aplicación se actualiza sola en segundos conservando la sesión y toda la configuración.

*(También queda disponible `iniciar-servidor-actualizaciones.bat` por si alguna vez deseas actualizar equipos por red local Wi-Fi/LAN).*
