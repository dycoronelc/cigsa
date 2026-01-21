# Guía de Actualización del Servidor - DigitalOcean

Esta guía te ayudará a actualizar el código de la aplicación CIGSA en el servidor de DigitalOcean después de hacer cambios en el repositorio local.

## Prerrequisitos

- Tener acceso SSH al servidor
- Haber hecho `git push` de los cambios al repositorio remoto
- Haber actualizado la base de datos manualmente (si aplica)

---

## Paso 1: Conectarse al Servidor

```bash
ssh usuario@TU_IP_DEL_SERVIDOR
```

Ejemplo:
```bash
ssh root@165.245.137.48
```

---

## Paso 2: Navegar al Directorio del Proyecto

```bash
cd /var/www/cigsa
```

O la ruta donde tengas el proyecto clonado.

---

## Paso 3: Actualizar el Código desde Git

```bash
# Verificar que estás en la rama correcta (normalmente main o master)
git branch

# Traer los últimos cambios del repositorio
git fetch --all
git pull origin main
```

> **Nota:** Si tu rama principal es `master` en lugar de `main`, cambia `main` por `master` en el comando.

Si hay conflictos, resuélvelos manualmente o contacta al equipo.

---

## Paso 4: Actualizar Backend

```bash
# Ir al directorio del backend
cd backend

# Instalar nuevas dependencias (si hay cambios en package.json)
npm install

# Verificar que el servidor esté corriendo
pm2 list

# Reiniciar el backend para aplicar cambios
pm2 restart cigsa-backend

# Ver los logs para verificar que no hay errores
pm2 logs cigsa-backend --lines 50
```

Si el proceso no se llama `cigsa-backend`, verifica el nombre con:
```bash
pm2 list
```

Y usa ese nombre en el comando `pm2 restart`.

---

## Paso 5: Actualizar Frontend

```bash
# Ir al directorio del frontend
cd ../frontend

# Instalar nuevas dependencias (si hay cambios en package.json)
npm install

# Reconstruir la aplicación
npm run build
```

Esto generará los archivos estáticos en la carpeta `dist/` que Nginx está sirviendo.

---

## Paso 6: Verificar que Nginx Está Sirviendo los Archivos Correctos

```bash
# Verificar la configuración de Nginx
sudo nginx -t

# Si hay errores, corrígelos antes de continuar
# Si todo está bien, recargar Nginx (no reinicia, solo recarga la config)
sudo systemctl reload nginx
```

---

## Paso 7: Verificar que Todo Funciona

### 7.1 Verificar Backend

```bash
# Desde el servidor, probar el health check
curl -sS http://127.0.0.1:3001/api/health
```

Debería devolver algo como:
```json
{"status":"OK","message":"CIGSA API is running"}
```

### 7.2 Verificar Frontend

Abre tu navegador y visita:
```
http://TU_IP_DEL_SERVIDOR
```

O si tienes dominio:
```
https://tu-dominio.com
```

### 7.3 Verificar que el Proxy Funciona

```bash
# Desde el servidor
curl -sS http://127.0.0.1/api/health
```

También debería devolver el JSON del health check.

---

## Paso 8: Limpiar Cache del Navegador (Importante para PWAs)

Si la aplicación es una PWA, los usuarios necesitan limpiar el cache:

1. Abre las **DevTools** (F12)
2. Ve a la pestaña **Application**
3. En **Service Workers**, haz clic en **Unregister**
4. En **Storage**, haz clic en **Clear site data**
5. Recarga la página con **Ctrl+F5** (o Cmd+Shift+R en Mac)

---

## Comandos Rápidos (Todo en Uno)

Si prefieres ejecutar todo de una vez:

```bash
# Conectarse al servidor
ssh usuario@TU_IP

# Navegar y actualizar
cd /var/www/cigsa
git fetch --all
git pull origin main

# Backend
cd backend
npm install
pm2 restart cigsa-backend
pm2 logs cigsa-backend --lines 20

# Frontend
cd ../frontend
npm install
npm run build

# Recargar Nginx
sudo nginx -t && sudo systemctl reload nginx

# Verificar
curl -sS http://127.0.0.1/api/health
```

---

## Solución de Problemas

### Warnings EBADENGINE (Node.js versión antigua)

Si ves warnings como:
```
npm WARN EBADENGINE Unsupported engine {
  package: '@isaacs/balanced-match@4.0.1',
  required: { node: '20 || >=22' },
  current: { node: 'v18.19.1' }
}
```

**Esto significa que necesitas actualizar Node.js a la versión 20 o superior.**

#### Verificar versión actual:
```bash
node -v
npm -v
```

#### Actualizar Node.js a versión 20 LTS:

```bash
# Detener PM2 temporalmente para evitar conflictos
pm2 stop all

# Instalar NodeSource repository para Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Actualizar Node.js
sudo apt-get install -y nodejs

# Verificar nueva versión
node -v
npm -v

# Debería mostrar v20.x.x o superior
```

#### Reinstalar dependencias globales (si aplica):

```bash
# Reinstalar PM2 con la nueva versión de Node.js
sudo npm install -g pm2

# Verificar que PM2 funciona
pm2 --version
```

#### Reinstalar dependencias del proyecto:

```bash
cd /var/www/cigsa/backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Reiniciar aplicaciones:

```bash
# Reiniciar backend con PM2
cd /var/www/cigsa/backend
pm2 restart cigsa-backend
pm2 logs cigsa-backend --lines 20
```

#### Verificar que los warnings desaparecieron:

```bash
cd /var/www/cigsa/frontend
npm install
# Ya no deberían aparecer warnings EBADENGINE
```

> **Nota:** Si después de actualizar Node.js sigues viendo la versión antigua, puede ser que tengas múltiples instalaciones. Verifica con:
> ```bash
> which node
> which npm
> ```
> Si apuntan a ubicaciones diferentes, puede ser necesario actualizar el PATH o usar `nvm` (Node Version Manager).

### Error: "npm: command not found"

```bash
# Instalar Node.js si no está instalado
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Error: "pm2: command not found"

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2
```

### El backend no inicia

```bash
# Ver logs detallados
pm2 logs cigsa-backend --lines 100

# Verificar variables de entorno
cd /var/www/cigsa/backend
cat .env

# Verificar que MySQL está corriendo
sudo systemctl status mysql
```

### El frontend no se actualiza

1. Verifica que `npm run build` se ejecutó correctamente
2. Verifica que Nginx está apuntando a la carpeta `dist/` correcta:
   ```bash
   sudo nginx -T | grep "root.*cigsa.*dist"
   ```
3. Limpia el cache del navegador (ver Paso 8)

### Error 502 Bad Gateway

```bash
# Verificar que el backend está corriendo
pm2 list

# Verificar que el backend responde
curl -sS http://127.0.0.1:3001/api/health

# Verificar configuración de Nginx
sudo nginx -T | grep -A 5 "location /api"
```

---

## Notas Importantes

1. **Backup antes de actualizar:** Siempre es recomendable hacer un backup de la base de datos antes de actualizaciones importantes:
   ```bash
   mysqldump -u root -p cigsa_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Variables de entorno:** Si agregaste nuevas variables de entorno (`.env`), asegúrate de actualizarlas en el servidor:
   ```bash
   cd /var/www/cigsa/backend
   nano .env
   # Agregar/modificar variables
   pm2 restart cigsa-backend
   ```

3. **Permisos de archivos:** Si hay problemas con permisos:
   ```bash
   sudo chown -R $USER:$USER /var/www/cigsa
   ```

4. **Espacio en disco:** Verifica que hay espacio suficiente:
   ```bash
   df -h
   ```

---

## Checklist de Actualización

- [ ] Conectado al servidor por SSH
- [ ] Verificada versión de Node.js (`node -v` - debe ser 20.x o superior)
- [ ] Si Node.js < 20, actualizado Node.js (ver sección "Warnings EBADENGINE")
- [ ] Código actualizado con `git pull`
- [ ] Dependencias del backend instaladas (`npm install`)
- [ ] Backend reiniciado con PM2
- [ ] Logs del backend verificados (sin errores)
- [ ] Dependencias del frontend instaladas (`npm install` - sin warnings EBADENGINE)
- [ ] Frontend reconstruido (`npm run build`)
- [ ] Nginx recargado
- [ ] Health check del backend funciona
- [ ] Aplicación accesible en el navegador
- [ ] Cache del navegador limpiado (si es PWA)

---

## Contacto y Soporte

Si encuentras problemas durante la actualización, verifica:
1. Los logs de PM2: `pm2 logs cigsa-backend`
2. Los logs de Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Los logs de MySQL: `sudo tail -f /var/log/mysql/error.log`

---

**Última actualización:** Enero 2026
