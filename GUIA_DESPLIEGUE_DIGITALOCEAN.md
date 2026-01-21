# Guía de Despliegue en DigitalOcean - CIGSA

Esta guía te ayudará a desplegar el sistema CIGSA completo (backend + frontend + MySQL) en DigitalOcean.

## 📋 Índice

1. [Preparación Local](#1-preparación-local)
2. [Crear Cuenta y Recursos en DigitalOcean](#2-crear-cuenta-y-recursos-en-digitalocean)
3. [Opción A: Despliegue en Droplet (VPS)](#opción-a-despliegue-en-droplet-vps-recomendado)
4. [Opción B: Despliegue en App Platform](#opción-b-despliegue-en-app-platform-más-fácil)
5. [Configuración de Dominio](#5-configuración-de-dominio)
6. [Mantenimiento y Actualizaciones](#6-mantenimiento-y-actualizaciones)

---

## 1. Preparación Local

### 1.1 Preparar el código para producción

#### Backend - Crear archivo `.env.example`:

```bash
# backend/.env.example
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password_seguro
DB_NAME=cigsa_db
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
PORT=3001
NODE_ENV=production
```

#### Frontend - Configuración de API

El frontend ya está configurado para usar variables de entorno. El archivo `frontend/src/config.js` maneja las URLs automáticamente.

**Para desarrollo local, crear archivo `.env` en `frontend/`:**

```env
VITE_API_URL=http://localhost:3001/api
VITE_STATIC_URL=http://localhost:3001
```

**Para producción, el archivo `.env` debe ser:**

```env
VITE_API_URL=/api
VITE_STATIC_URL=
```

(En producción, Nginx manejará el proxy y los archivos estáticos)

### 1.2 Preparar archivos para Git (si usas repositorio)

Crear `.gitignore` si no existe:

```
# backend/.gitignore
node_modules/
.env
uploads/
*.log

# frontend/.gitignore
node_modules/
dist/
.env
.env.local
```

---

## 2. Crear Cuenta y Recursos en DigitalOcean

### 2.1 Crear cuenta en DigitalOcean

1. Ve a [digitalocean.com](https://www.digitalocean.com)
2. Crea una cuenta (puedes usar GitHub para registro rápido)
3. Verifica tu email

### 2.2 Opciones de Despliegue

Tienes dos opciones principales:

**Opción A: Droplet (VPS)** - ~$12-24/mes
- Más control
- Más económico
- Requiere configuración manual
- Ideal para proyectos con tráfico moderado

**Opción B: App Platform** - ~$25-50/mes
- Más fácil de configurar
- Escalado automático
- Menos control
- Ideal si prefieres no gestionar servidor

---

## Opción A: Despliegue en Droplet (VPS) - RECOMENDADO

### Paso 1: Crear Droplet

1. En DigitalOcean, ve a **Create** → **Droplets**
2. Configuración recomendada:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic - Regular Intel (4GB RAM / 2 vCPUs) - $24/mes
     - O 2GB RAM / 1 vCPU - $12/mes (mínimo recomendado)
   - **Datacenter**: Elige el más cercano a tus usuarios
   - **Authentication**: SSH keys (recomendado) o Password
   - **Hostname**: `cigsa-server` (o el que prefieras)
3. Click en **Create Droplet**

### Paso 2: Conectarse al Droplet

```bash
# Desde tu máquina local (Windows PowerShell o Git Bash)
ssh root@TU_IP_DEL_DROPLET

# Si usas contraseña, te pedirá la contraseña
# Si usas SSH key, se conectará automáticamente
```

### Paso 3: Configuración Inicial del Servidor

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20.x (requerido para Vite 7 y React Router 7)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalación
node -v  # Debería mostrar v20.x.x
npm -v

# Instalar MySQL
apt install -y mysql-server

# Configurar MySQL (ejecutar y seguir las instrucciones)
mysql_secure_installation
# Durante la configuración:
# - Establece contraseña para root
# - Responde "Y" a todas las preguntas de seguridad

# Instalar Nginx (servidor web)
apt install -y nginx

# Instalar PM2 (gestor de procesos Node.js)
npm install -g pm2

# Instalar Git (si vas a clonar desde repositorio)
apt install -y git
```

### Paso 4: Configurar MySQL

```bash
# Conectarse a MySQL
mysql -u root -p

# Dentro de MySQL, ejecutar:
CREATE DATABASE cigsa_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cigsa_user'@'localhost' IDENTIFIED BY 'TU_PASSWORD_SEGURO_AQUI';
GRANT ALL PRIVILEGES ON cigsa_db.* TO 'cigsa_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Paso 5: Subir el Código al Servidor

**Opción 1: Usando Git (Recomendado)**

```bash
# En el servidor
cd /var/www
git clone TU_REPOSITORIO_GIT cigsa
# O si no tienes repositorio, crea la estructura manualmente
```

**Opción 2: Usando SCP (desde tu máquina local)**

```bash
# Desde tu máquina local (en PowerShell o Git Bash)
# Comprimir el proyecto (excluyendo node_modules)
# Luego subir:
scp -r C:\react\cigsa root@TU_IP_DEL_DROPLET:/var/www/cigsa
```

**Opción 3: Crear estructura manualmente**

```bash
# En el servidor
mkdir -p /var/www/cigsa
cd /var/www/cigsa
# Luego copiar archivos manualmente o usar git
```

### Paso 6: Configurar Backend

```bash
# En el servidor
cd /var/www/cigsa/backend

# Instalar dependencias
npm install --production

# Crear archivo .env
nano .env
```

**Contenido del archivo `.env`:**

```env
DB_HOST=127.0.0.1
DB_USER=cigsa_user
DB_PASSWORD=TU_PASSWORD_SEGURO_AQUI
DB_NAME=cigsa_db
JWT_SECRET=GENERA_UN_SECRET_LARGO_Y_SEGURO_AQUI
PORT=3001
NODE_ENV=production
```

**Nota importante:** Usa `127.0.0.1` en lugar de `localhost` para evitar problemas de conexión IPv6.

**Generar JWT_SECRET seguro:**

```bash
# En el servidor
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copia el resultado al JWT_SECRET en .env
```

```bash
# Crear directorio para uploads
mkdir -p /var/www/cigsa/backend/uploads/documents
mkdir -p /var/www/cigsa/backend/uploads/photos

# Inicializar base de datos completa
# Opción 1: Si tienes el script init-db actualizado
npm run init-db

# Opción 2: Si no tienes el script, iniciar el servidor una vez (ejecuta initDatabase automáticamente)
# node server.js
# (Espera 5-10 segundos hasta que veas "Server running on port 3001", luego presiona Ctrl+C)

# Opción 3: Ejecutar el schema manualmente desde MySQL
# mysql -u cigsa_user -p cigsa_db < /var/www/cigsa/backend/config/schema.sql

# Crear tablas adicionales (equipment_housings, equipment_documents, etc.)
npm run create-missing-tables

# Crear usuario administrador
npm run create-admin
```

**Si `npm run init-db` no existe**, actualiza el código en el servidor:

```bash
# Si usas Git:
cd /var/www/cigsa
git pull origin main
cd backend
npm install

# O copia manualmente los archivos actualizados desde tu máquina local
```

**Alternativa rápida sin actualizar código:**

```bash
# Iniciar el servidor una vez para que ejecute initDatabase()
cd /var/www/cigsa/backend
node server.js
# Espera a ver: "Server running on port 3001"
# Luego presiona Ctrl+C para detenerlo

# Ahora las tablas base deberían estar creadas, ejecutar:
npm run create-missing-tables
npm run create-admin
```

**Nota:** Si el comando `npm run create-missing-tables` da error, verifica:

1. **Que el archivo `.env` esté configurado correctamente:**
   ```bash
   cat .env
   # Debe mostrar DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
   ```

2. **Que la base de datos exista:**
   ```bash
   mysql -u cigsa_user -p -e "SHOW DATABASES;" | grep cigsa_db
   ```

3. **Que las tablas base existan:**
   ```bash
   mysql -u cigsa_user -p cigsa_db -e "SHOW TABLES;"
   # Debe mostrar: users, clients, equipment_brands, equipment_models, work_orders, etc.
   ```

4. **Verificar conexión a la base de datos:**
   ```bash
   mysql -u cigsa_user -p cigsa_db -e "SELECT 1;"
   ```

**Solución si hay errores:**

Si `npm run init-db` falla, puedes ejecutar el schema manualmente:

```bash
# Opción 1: Desde MySQL directamente
mysql -u cigsa_user -p cigsa_db < /var/www/cigsa/backend/config/schema.sql

# Opción 2: Iniciar el servidor una vez (ejecuta initDatabase automáticamente)
# node server.js
# (Espera 5 segundos y presiona Ctrl+C)
# Luego ejecuta: npm run create-missing-tables
```

### Paso 7: Configurar Frontend

```bash
# En el servidor
cd /var/www/cigsa/frontend

# Instalar dependencias
npm install

# Crear archivo .env
nano .env
```

**Contenido del archivo `.env` (para producción con Nginx):**

```env
VITE_API_URL=/api
VITE_STATIC_URL=
```

**Nota:** En producción con Nginx, no necesitas especificar la IP porque Nginx hace el proxy. Si estás probando sin Nginx, usa:
```env
VITE_API_URL=http://TU_IP:3001/api
VITE_STATIC_URL=http://TU_IP:3001
```

```bash
# Construir para producción
npm run build

# El resultado estará en /var/www/cigsa/frontend/dist
```

### Paso 8: Configurar Nginx

```bash
# Crear configuración de Nginx
nano /etc/nginx/sites-available/cigsa
```

**Contenido del archivo:**

```nginx
# Redirigir HTTP a HTTPS (opcional, si tienes SSL)
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;
    
    # Frontend - React App
    location / {
        root /var/www/cigsa/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Archivos estáticos del backend (uploads)
    location /uploads {
        alias /var/www/cigsa/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Archivos estáticos del frontend
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/cigsa/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Habilitar el sitio
ln -s /etc/nginx/sites-available/cigsa /etc/nginx/sites-enabled/

# Eliminar configuración por defecto (opcional)
rm /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Reiniciar Nginx
systemctl restart nginx
```

### Paso 9: Iniciar Backend con PM2

```bash
# En el servidor
cd /var/www/cigsa/backend

# Iniciar con PM2
pm2 start server.js --name cigsa-backend

# Configurar PM2 para iniciar al reiniciar el servidor
pm2 startup
pm2 save

# Ver logs
pm2 logs cigsa-backend

# Ver estado
pm2 status
```

### Paso 10: Configurar Firewall

```bash
# Permitir SSH, HTTP, HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Verificar estado
```

### Paso 11: Verificar que Todo Funciona

1. Abre tu navegador y ve a `http://TU_IP_DEL_DROPLET`
2. Deberías ver la pantalla de login
3. Prueba hacer login con el usuario administrador creado

---

## Opción B: Despliegue en App Platform (Más Fácil)

### Paso 1: Preparar Repositorio Git

1. Sube tu código a GitHub, GitLab o Bitbucket
2. Asegúrate de tener los archivos `.env.example` configurados

### Paso 2: Crear App en App Platform

1. En DigitalOcean, ve a **Create** → **Apps**
2. Conecta tu repositorio Git
3. Selecciona el repositorio y branch

### Paso 3: Configurar Base de Datos

1. En la configuración de la App, agrega un **Database**
2. Selecciona **MySQL**
3. Plan recomendado: **Basic** ($15/mes) o **Professional** ($60/mes)
4. Nombre de la base de datos: `cigsa_db`

### Paso 4: Configurar Backend

1. Agrega un **Component** → **Web Service**
2. Configuración:
   - **Name**: `backend`
   - **Source Directory**: `backend`
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **HTTP Port**: `3001`
   - **Environment Variables**:
     ```
     DB_HOST=${{cigsa-db.HOSTNAME}}
     DB_USER=${{cigsa-db.USERNAME}}
     DB_PASSWORD=${{cigsa-db.PASSWORD}}
     DB_NAME=${{cigsa-db.DATABASE}}
     JWT_SECRET=TU_JWT_SECRET_AQUI
     NODE_ENV=production
     PORT=3001
     ```
3. Agrega un **Volume** para `/uploads` (persistencia de archivos)

### Paso 5: Configurar Frontend

1. Agrega otro **Component** → **Static Site**
2. Configuración:
   - **Name**: `frontend`
   - **Source Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**:
     ```
     VITE_API_URL=${{backend.PUBLIC_URL}}/api
     ```

### Paso 6: Desplegar

1. Click en **Create Resources**
2. Espera a que se complete el despliegue (5-10 minutos)
3. Tu app estará disponible en una URL tipo: `https://cigsa-xxxxx.ondigitalocean.app`

---

## 5. Configuración de Dominio

### 5.1 Agregar Dominio en DigitalOcean

1. Ve a **Networking** → **Domains**
2. Agrega tu dominio (ej: `cigsa.com`)
3. Agrega los registros DNS:
   - **A Record**: `@` → IP del Droplet (si usas Droplet)
   - **CNAME**: `www` → `@` (opcional)

### 5.2 Configurar SSL con Let's Encrypt (Gratis)

**Solo para Opción A (Droplet):**

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d TU_DOMINIO.com -d www.TU_DOMINIO.com

# Renovación automática (ya está configurada)
certbot renew --dry-run
```

**Para Opción B (App Platform):**
- SSL se configura automáticamente en App Platform
- Solo agrega tu dominio en la configuración de la App

### 5.3 Actualizar Nginx para HTTPS (Opción A)

```bash
# Certbot ya actualiza automáticamente la configuración
# Pero puedes verificar:
nano /etc/nginx/sites-available/cigsa
```

Asegúrate de que tenga:

```nginx
server {
    listen 443 ssl http2;
    server_name TU_DOMINIO.com;
    
    ssl_certificate /etc/letsencrypt/live/TU_DOMINIO.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/TU_DOMINIO.com/privkey.pem;
    
    # ... resto de la configuración
}
```

---

## 6. Mantenimiento y Actualizaciones

### 6.1 Actualizar Código (Opción A - Droplet)

```bash
# Conectarse al servidor
ssh root@TU_IP

# Ir al directorio del proyecto
cd /var/www/cigsa

# Si usas Git:
git pull origin main

# Actualizar backend
cd backend
npm install --production
pm2 restart cigsa-backend

# Actualizar frontend
cd ../frontend
npm install
npm run build

# Reiniciar Nginx (si es necesario)
systemctl reload nginx
```

### 6.2 Ver Logs

```bash
# Logs del backend (PM2)
pm2 logs cigsa-backend

# Logs de Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Logs del sistema
journalctl -u nginx -f
```

### 6.3 Migrar Datos de Base de Datos Local al Servidor

Si tienes datos en tu base de datos local y quieres migrarlos al servidor:

**Paso 1: Exportar datos desde tu máquina local**

```bash
# En tu máquina local (Windows PowerShell o Git Bash)
# Ajusta las credenciales según tu configuración local
mysqldump -u root -p cigsa_db > cigsa_backup.sql

# O si tienes credenciales específicas:
mysqldump -u TU_USUARIO_LOCAL -p cigsa_db > cigsa_backup.sql
```

**Paso 2: Transferir el archivo al servidor**

```bash
# Desde tu máquina local, usar SCP para copiar el archivo
scp cigsa_backup.sql root@TU_IP_DEL_SERVIDOR:/root/

# O usar SFTP si prefieres
# sftp root@TU_IP_DEL_SERVIDOR
# put cigsa_backup.sql /root/
```

**Paso 3: Importar datos en el servidor**

```bash
# Conectarse al servidor
ssh root@TU_IP_DEL_SERVIDOR

# Importar los datos (ajusta las credenciales según tu configuración del servidor)
mysql -u cigsa_user -p cigsa_db < /root/cigsa_backup.sql

# Verificar que los datos se importaron correctamente
mysql -u cigsa_user -p cigsa_db -e "SELECT COUNT(*) as total_usuarios FROM users;"
mysql -u cigsa_user -p cigsa_db -e "SELECT COUNT(*) as total_clientes FROM clients;"
mysql -u cigsa_user -p cigsa_db -e "SELECT COUNT(*) as total_equipos FROM equipment;"
mysql -u cigsa_user -p cigsa_db -e "SELECT COUNT(*) as total_ordenes FROM work_orders;"
```

**Paso 4: Transferir archivos subidos (opcional)**

Si tienes fotos o documentos subidos localmente que quieres migrar:

```bash
# Desde tu máquina local
# Comprimir la carpeta de uploads
cd C:\react\cigsa\backend
tar -czf uploads_backup.tar.gz uploads/

# O en Windows PowerShell, usar Compress-Archive:
Compress-Archive -Path uploads -DestinationPath uploads_backup.zip

# Transferir al servidor
scp uploads_backup.tar.gz root@TU_IP_DEL_SERVIDOR:/root/
# O si usaste zip:
scp uploads_backup.zip root@TU_IP_DEL_SERVIDOR:/root/

# En el servidor, extraer los archivos
ssh root@TU_IP_DEL_SERVIDOR
cd /var/www/cigsa/backend
tar -xzf /root/uploads_backup.tar.gz
# O si usaste zip:
unzip /root/uploads_backup.zip -d .

# Asegurar permisos correctos
chown -R www-data:www-data uploads/
chmod -R 755 uploads/
```

**Nota importante:** 
- Si ya tienes datos en el servidor, haz un backup primero antes de importar
- Verifica que las estructuras de las tablas sean compatibles
- Si hay diferencias en IDs de usuarios, puede que necesites ajustar referencias

### 6.4 Backup de Base de Datos

```bash
# Crear script de backup
nano /root/backup-cigsa.sh
```

**Contenido:**

```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="cigsa_db"
DB_USER="cigsa_user"
DB_PASS="TU_PASSWORD"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/cigsa_$DATE.sql

# Eliminar backups más antiguos de 7 días
find $BACKUP_DIR -name "cigsa_*.sql" -mtime +7 -delete

echo "Backup creado: cigsa_$DATE.sql"
```

```bash
# Hacer ejecutable
chmod +x /root/backup-cigsa.sh

# Agregar a crontab (backup diario a las 2 AM)
crontab -e
# Agregar esta línea:
0 2 * * * /root/backup-cigsa.sh
```

### 6.4 Monitoreo

**PM2 Monitoring:**

```bash
# Instalar PM2 monitoring (opcional)
pm2 install pm2-server-monit
```

**DigitalOcean Monitoring:**

- Ve a tu Droplet → **Monitoring**
- Configura alertas para CPU, memoria, disco

---

## 7. Solución de Problemas Comunes

### Error: "ECONNREFUSED ::1:3306" o "Cannot connect to MySQL"

Este error indica que no se puede conectar a MySQL. Sigue estos pasos:

**Paso 1: Verificar que MySQL está corriendo:**
```bash
systemctl status mysql
# O en algunas distribuciones:
systemctl status mysqld
```

Si no está corriendo, iniciarlo:
```bash
systemctl start mysql
# O:
systemctl start mysqld
```

**Paso 2: Verificar que MySQL está escuchando en el puerto correcto:**
```bash
netstat -tuln | grep 3306
# O:
ss -tuln | grep 3306
# Debe mostrar: tcp 0 0 127.0.0.1:3306 o 0.0.0.0:3306
```

**Paso 3: Verificar el archivo `.env` - usar 127.0.0.1 en lugar de localhost:**
```bash
cd /var/www/cigsa/backend
cat .env
# Asegúrate de que DB_HOST=127.0.0.1 (no localhost)
```

Si dice `DB_HOST=localhost`, cambiarlo:
```bash
sed -i 's/DB_HOST=localhost/DB_HOST=127.0.0.1/' .env
# O editar manualmente:
nano .env
```

**Paso 4: Probar conexión manual a MySQL:**
```bash
mysql -u cigsa_user -p -h 127.0.0.1 cigsa_db
# Si funciona, MySQL está bien configurado
```

**Paso 5: Si MySQL no acepta conexiones, verificar configuración:**
```bash
# Ver archivo de configuración de MySQL
cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address
# Debe mostrar: bind-address = 127.0.0.1 (o 0.0.0.0 para aceptar todas)
```

### Error: "EBADENGINE Unsupported engine" (Node.js versión incorrecta)

Si ves advertencias sobre versiones de Node.js no soportadas, necesitas actualizar Node.js a la versión 20 o superior:

```bash
# Verificar versión actual
node -v

# Si muestra v18.x.x o menor, actualizar a Node.js 20:
# 1. Eliminar Node.js actual (si está instalado desde repositorio de Ubuntu)
apt remove nodejs npm -y

# 2. Instalar Node.js 20.x desde NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Verificar nueva versión
node -v  # Debe mostrar v20.x.x o superior
npm -v

# 4. Reinstalar dependencias del frontend
cd /var/www/cigsa/frontend
rm -rf node_modules package-lock.json
npm install

# 5. Reinstalar dependencias del backend (si es necesario)
cd /var/www/cigsa/backend
rm -rf node_modules package-lock.json
npm install
```

**Nota:** Las advertencias `EBADENGINE` no son errores críticos - el código puede funcionar con Node.js 18, pero se recomienda Node.js 20+ para mejor compatibilidad.

### Error: "npm run create-missing-tables" falla (otras causas)

Este error también puede ocurrir porque las tablas base no existen. Sigue estos pasos:

**Paso 1: Verificar que el archivo `.env` existe y está correcto:**
```bash
cd /var/www/cigsa/backend
cat .env
# Debe mostrar:
# DB_HOST=localhost
# DB_USER=cigsa_user
# DB_PASSWORD=tu_password
# DB_NAME=cigsa_db
```

**Paso 2: Verificar que la base de datos existe:**
```bash
mysql -u cigsa_user -p -e "SHOW DATABASES;" | grep cigsa_db
# Debe mostrar: cigsa_db
```

**Paso 3: Verificar que las tablas base existen:**
```bash
mysql -u cigsa_user -p cigsa_db -e "SHOW TABLES;"
# Debe mostrar al menos: users, clients, equipment_brands, equipment_models, work_orders
```

**Paso 4: Si las tablas NO existen, ejecutar el schema completo:**
```bash
cd /var/www/cigsa/backend
npm run init-db
```

**Paso 5: Si `init-db` también falla, ejecutar manualmente:**
```bash
# Opción A: Desde el script Node.js
node -e "import('./config/database.js').then(m => m.initDatabase())"

# Opción B: Desde MySQL directamente
mysql -u cigsa_user -p cigsa_db < config/schema.sql
```

**Paso 6: Una vez que las tablas base existan, ejecutar:**
```bash
npm run create-missing-tables
```

**Errores comunes y soluciones:**

- **"Table 'cigsa_db.equipment_brands' doesn't exist"**
  → Ejecuta primero `npm run init-db` para crear todas las tablas base

- **"Access denied for user 'cigsa_user'"**
  → Verifica las credenciales en `.env` y que el usuario tenga permisos:
  ```bash
  mysql -u root -p
  GRANT ALL PRIVILEGES ON cigsa_db.* TO 'cigsa_user'@'localhost';
  FLUSH PRIVILEGES;
  ```

- **"ER_NO_SUCH_TABLE"**
  → Las tablas base no existen. Ejecuta `npm run init-db` primero

### Error: "Cannot connect to database"

```bash
# Verificar que MySQL está corriendo
systemctl status mysql

# Verificar conexión
mysql -u cigsa_user -p cigsa_db

# Verificar firewall
ufw status
```

### Error: "Port 3001 already in use"

```bash
# Ver qué proceso usa el puerto
lsof -i :3001

# O usar
netstat -tulpn | grep 3001
```

### Error: Frontend no carga

```bash
# Verificar que Nginx está corriendo
systemctl status nginx

# Verificar configuración
nginx -t

# Ver logs de error
tail -f /var/log/nginx/error.log
```

### Error: Archivos no se suben

```bash
# Verificar permisos
chown -R www-data:www-data /var/www/cigsa/backend/uploads
chmod -R 755 /var/www/cigsa/backend/uploads
```

---

## 8. Checklist Final

- [ ] Backend corriendo con PM2
- [ ] Frontend construido y servido por Nginx
- [ ] Base de datos configurada y migrada
- [ ] Usuario administrador creado
- [ ] SSL configurado (si usas dominio)
- [ ] Firewall configurado
- [ ] Backups automáticos configurados
- [ ] Dominio apuntando correctamente
- [ ] Pruebas de login y funcionalidad básica

---

## 9. Costos Estimados

### Opción A (Droplet):
- Droplet (2GB RAM): $12/mes
- Dominio: $12/año (opcional)
- **Total: ~$12-24/mes**

### Opción B (App Platform):
- App Platform: $12/mes (mínimo)
- Database MySQL: $15/mes
- **Total: ~$27/mes mínimo**

---

## 10. Soporte Adicional

Si necesitas ayuda con algún paso específico:
1. Revisa los logs de error
2. Verifica la configuración de variables de entorno
3. Asegúrate de que todos los puertos están abiertos
4. Verifica permisos de archivos y directorios

¡Buena suerte con el despliegue! 🚀
