# CIGSA - Sistema de Gestión de Órdenes de Trabajo

Sistema PWA para la gestión integral de órdenes de trabajo y servicio para CIGSA, empresa especializada en soldadura que presta servicios a Minera de Panamá.

## Características

### Rol Administrador
- ✅ Gestión completa de clientes, equipos, técnicos y usuarios
- ✅ Creación y asignación de órdenes de trabajo
- ✅ Dashboard con KPIs de productividad, avance y finanzas
- ✅ Bitácora de actividad del sistema
- ✅ Visualización y gestión de todas las órdenes de trabajo

### Rol Técnico
- ✅ Vista móvil optimizada para teléfonos
- ✅ Visualización de órdenes asignadas
- ✅ Realización de inspecciones con mediciones iniciales
- ✅ Documentación del servicio con observaciones y fotos
- ✅ Cierre de órdenes con mediciones finales
- ✅ Acceso a documentación y planos PDF del equipo

## Tecnologías

- **Backend**: Node.js + Express + MySQL
- **Frontend**: React + Vite + PWA
- **Base de Datos**: MySQL

## Requisitos Previos

- Node.js (v16 o superior)
- MySQL (v8 o superior)
- npm o yarn

## Instalación

### 1. Clonar el repositorio

```bash
cd c:\react\cigsa
```

### 2. Configurar el Backend

```bash
cd backend
npm install
```

Crear un archivo `.env` en la carpeta `backend` con la siguiente configuración:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=cigsa_db
PORT=3001
NODE_ENV=development
JWT_SECRET=tu-secret-key-seguro-aqui
UPLOAD_DIR=uploads
```

### 3. Inicializar la Base de Datos

El sistema creará automáticamente la base de datos y las tablas al iniciar el servidor por primera vez.

### 4. Iniciar el Backend

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

### 5. Configurar el Frontend

En una nueva terminal:

```bash
cd frontend
npm install
```

### 6. Iniciar el Frontend

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Uso

### Primer Usuario Administrador

Después de iniciar el servidor por primera vez, puedes crear el usuario administrador inicial ejecutando:

```bash
cd backend
npm run create-admin
```

O con parámetros personalizados:

```bash
npm run create-admin [username] [password] [email] [fullName]
```

Por defecto crea:
- Usuario: `admin`
- Contraseña: `admin123`
- Email: `admin@cigsa.com`
- Nombre: `Administrador`

**IMPORTANTE**: Cambia la contraseña después del primer inicio de sesión.

### Estados de las Órdenes

Las órdenes de trabajo tienen los siguientes estados:

1. **Creada**: Orden creada por el administrador, sin asignar
2. **Asignada**: Orden asignada a un técnico
3. **En Proceso**: Técnico ha iniciado el trabajo
4. **Completada**: Técnico ha finalizado el servicio
5. **Aceptada**: Cliente ha verificado y aceptado el servicio (lista para facturar)

### Flujo de Trabajo

1. **Administrador**:
   - Crea clientes y equipos
   - Crea órdenes de trabajo
   - Asigna órdenes a técnicos
   - Monitorea el progreso desde el dashboard

2. **Técnico**:
   - Ve sus órdenes asignadas en su móvil
   - Inicia la orden (cambia estado a "En Proceso")
   - Toma mediciones iniciales
   - Documenta con fotos y observaciones durante el servicio
   - Toma mediciones finales
   - Completa la orden (cambia estado a "Completada")

3. **Administrador**:
   - Verifica la orden completada
   - Cambia el estado a "Aceptada" cuando el cliente verifica
   - La orden queda lista para facturación

## Estructura del Proyecto

```
cigsa/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   └── schema.sql
│   ├── middleware/
│   │   ├── auth.js
│   │   └── logger.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clients.js
│   │   ├── equipment.js
│   │   ├── technicians.js
│   │   ├── users.js
│   │   ├── workOrders.js
│   │   └── dashboard.js
│   ├── uploads/
│   │   ├── photos/
│   │   └── documents/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── contexts/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   └── technician/
│   │   ├── services/
│   │   └── App.jsx
│   ├── public/
│   └── package.json
└── README.md
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual
- `POST /api/auth/change-password` - Cambiar contraseña

### Órdenes de Trabajo
- `GET /api/work-orders` - Listar órdenes
- `GET /api/work-orders/:id` - Obtener orden detallada
- `POST /api/work-orders` - Crear orden (admin)
- `PUT /api/work-orders/:id` - Actualizar orden
- `POST /api/work-orders/:id/measurements` - Agregar medición
- `POST /api/work-orders/:id/photos` - Subir foto
- `POST /api/work-orders/:id/observations` - Agregar observación
- `POST /api/work-orders/:id/documents` - Subir documento

### Dashboard
- `GET /api/dashboard/kpis` - KPIs del sistema (admin)
- `GET /api/dashboard/activity-log` - Bitácora (admin)
- `GET /api/dashboard/technician/:id` - Dashboard técnico

## Desarrollo

### Modo Desarrollo

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

### Build para Producción

Frontend:
```bash
cd frontend
npm run build
```

El build se generará en `frontend/dist` y estará listo para desplegar como PWA.

---

## Despliegue en producción (GitHub + DigitalOcean)

Pasos para publicar el código en GitHub y actualizar la aplicación en el servidor de DigitalOcean (IP: **165.245.137.48**).

### 1. Subir el código a GitHub

#### 1.1 Crear el repositorio en GitHub (si aún no existe)

1. Entra en [GitHub](https://github.com) e inicia sesión.
2. Clic en **New repository**.
3. Nombre del repositorio (ej: `cigsa`).
4. Elige **Private** o **Public**.
5. No marques "Add a README" si ya tienes el proyecto local.
6. Clic en **Create repository**.

#### 1.2 Inicializar Git y subir el código (desde tu máquina local)

Abre una terminal en la carpeta del proyecto (`c:\react\cigsa` o la ruta donde está el código):

```bash
# Ir a la carpeta del proyecto
cd c:\react\cigsa

# Si Git no está inicializado
git init

# Añadir el remoto (sustituye TU_USUARIO y TU_REPO por tu usuario y nombre del repo)
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git

# Si ya tenías un remoto y quieres cambiarlo
# git remote set-url origin https://github.com/TU_USUARIO/TU_REPO.git

# Ver la rama actual (suele ser main o master)
git branch

# Añadir todos los archivos, hacer commit y subir
git add .
git status
git commit -m "Actualización: descripción de los cambios"
git push -u origin main
```

Si tu rama se llama `master` en lugar de `main`:

```bash
git push -u origin master
```

> **Nota:** Si pide usuario y contraseña, usa un [Personal Access Token](https://github.com/settings/tokens) de GitHub en lugar de la contraseña.

---

### 2. Conectarse al servidor en DigitalOcean

Desde tu máquina (PowerShell o terminal):

```bash
ssh root@165.245.137.48
```

O con un usuario distinto de `root`:

```bash
ssh usuario@165.245.137.48
```

- La primera vez te pedirá confirmar la huella del servidor (escribe `yes`).
- Luego la contraseña del usuario (o usa clave SSH si la tienes configurada).

Cuando veas un prompt como `root@nombre-servidor:~#`, ya estás dentro del servidor.

---

### 3. Actualizar los archivos en el servidor

Una vez conectado por SSH al servidor:

#### Opción A: Usar el script de despliegue (recomendado)

```bash
cd /var/www/cigsa
./deploy.sh
```

El script hace:

- `git fetch` y `git pull` (trae los últimos cambios de GitHub).
- En `backend`: `npm install` y `pm2 restart cigsa-backend`.
- En `frontend`: `npm install` y `npm run build`.

#### Opción B: Pasos manuales

```bash
# 1. Ir al directorio del proyecto
cd /var/www/cigsa

# 2. Traer los últimos cambios de GitHub
git fetch --all
git pull origin main
# (usa master si tu rama se llama así: git pull origin master)

# 3. Backend: instalar dependencias y reiniciar
cd backend
npm install
pm2 restart cigsa-backend
cd ..

# 4. Frontend: instalar dependencias y construir
cd frontend
npm install
npm run build
cd ..
```

---

### 4. Comprobar que todo funciona

En el servidor:

```bash
# Estado del backend
pm2 list
pm2 logs cigsa-backend --lines 20

# Health check del API
curl -sS http://127.0.0.1:3001/api/health
```

En el navegador:

- **Frontend:** `http://165.245.137.48`
- **API:** `http://165.245.137.48/api/health`

---

### 5. Resumen rápido (después del primer despliegue)

| Dónde        | Qué hacer |
|-------------|-----------|
| **Tu PC**   | Hacer cambios → `git add .` → `git commit -m "mensaje"` → `git push origin main` |
| **Servidor**| `ssh root@165.245.137.48` → `cd /var/www/cigsa` → `./deploy.sh` |

---

### 6. Problemas frecuentes

- **"Permission denied" al hacer `git pull`:** En el servidor, asegúrate de que la clave SSH o el token estén configurados para ese repositorio, o usa HTTPS con usuario y token.
- **"pm2: command not found":** Instala PM2: `npm install -g pm2`.
- **Backend no arranca:** Revisa `pm2 logs cigsa-backend` y el archivo `.env` en `backend/` (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET).
- **Cambios en la base de datos:** Al iniciar, el backend ejecuta migraciones. Reiniciar con `pm2 restart cigsa-backend` suele ser suficiente para aplicar cambios de esquema.

---

## Notas Importantes

1. **Seguridad**: Cambia el `JWT_SECRET` en producción por un valor seguro y aleatorio.

2. **Base de Datos**: Asegúrate de que MySQL esté corriendo antes de iniciar el backend.

3. **Uploads**: Los archivos se guardan en `backend/uploads/`. Asegúrate de que esta carpeta tenga permisos de escritura.

4. **PWA**: La aplicación está configurada como PWA y puede instalarse en dispositivos móviles.

5. **CORS**: El backend está configurado para aceptar peticiones desde `localhost:3000`. Ajusta según sea necesario.

## Soporte

Para problemas o preguntas, contacta al equipo de desarrollo.

