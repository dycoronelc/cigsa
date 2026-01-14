# Importación de Equipos desde Excel

Este documento explica cómo importar los datos de equipos desde el archivo `Equipos.xlsx` a la base de datos.

## Estructura del Archivo Excel

El archivo `Equipos.xlsx` contiene información organizada de la siguiente manera:

- **Fila "MODELO"**: Contiene los nombres de los modelos de cada tipo de equipo
- **Fila "EJM COMPONENTES"**: Contiene los componentes asociados a cada modelo
- **Fila "ID" y siguientes**: Contienen los números de serie/ID de cada equipo individual

Las columnas representan diferentes tipos de equipos, identificados por su marca (DTU, CATERPILLAR, KOMATSU, P&H, LIEBHERR, ATLAS COPCO).

## Nueva Estructura de Base de Datos

La base de datos ahora utiliza una estructura normalizada con tres tablas:

1. **equipment_brands**: Almacena las marcas de equipos
2. **equipment_models**: Almacena los modelos de equipos (con referencia a marca y componentes)
3. **equipment**: Almacena los equipos individuales (con referencia a modelo y cliente opcional)

## Pasos para Importar los Datos

### 1. Migrar el Esquema de la Base de Datos

Primero, ejecuta el script de migración para crear las nuevas tablas:

```bash
npm run migrate-equipment
```

Este script:
- Crea las tablas `equipment_brands` y `equipment_models`
- Actualiza la tabla `equipment` para usar `model_id` en lugar de campos directos
- Crea un backup de datos existentes si los hay

**⚠️ ADVERTENCIA**: Si ya tienes datos en la tabla `equipment`, estos deben ser migrados manualmente o eliminados antes de continuar.

### 2. Importar los Datos del Excel

Una vez que el esquema esté actualizado, ejecuta el script de importación:

```bash
npm run import-equipment
```

Este script:
- Lee el archivo `backend/data/Equipos.xlsx`
- Extrae marcas, modelos, componentes y seriales
- Inserta los datos en las tablas correspondientes
- Evita duplicados (no inserta seriales que ya existen)

### 3. Verificar la Importación

Puedes verificar que los datos se importaron correctamente consultando:

```sql
-- Ver todas las marcas
SELECT * FROM equipment_brands;

-- Ver todos los modelos con sus marcas
SELECT em.*, eb.name as brand_name 
FROM equipment_models em 
JOIN equipment_brands eb ON em.brand_id = eb.id;

-- Ver todos los equipos con información completa
SELECT 
  e.serial_number,
  eb.name as brand,
  em.model_name,
  em.components,
  c.name as client_name
FROM equipment e
JOIN equipment_models em ON e.model_id = em.id
JOIN equipment_brands eb ON em.brand_id = eb.id
LEFT JOIN clients c ON e.client_id = c.id;
```

## API Endpoints Actualizados

Las rutas de la API han sido actualizadas para trabajar con la nueva estructura:

- `GET /api/equipment/brands` - Obtener todas las marcas
- `GET /api/equipment/models` - Obtener todos los modelos (opcional: `?brandId=X`)
- `GET /api/equipment` - Obtener todos los equipos (opcional: `?clientId=X&modelId=Y&brandId=Z`)
- `GET /api/equipment/:id` - Obtener un equipo por ID
- `POST /api/equipment` - Crear un nuevo equipo (requiere `modelId` y `serialNumber`)
- `PUT /api/equipment/:id` - Actualizar un equipo
- `DELETE /api/equipment/:id` - Desactivar un equipo (soft delete)

## Estructura de Respuesta

Cuando consultas equipos, la respuesta incluye información completa:

```json
{
  "id": 1,
  "model_id": 5,
  "serial_number": "DTU-001",
  "client_id": null,
  "location": null,
  "description": null,
  "is_active": true,
  "model_name": "Trucks_T284",
  "components": "Drag Link, Cilindro de Levante ODS, Cilindro de Levante DS",
  "brand_name": "DTU",
  "brand_id": 1,
  "client_name": null
}
```

## Notas Importantes

1. Los equipos importados **no tienen cliente asignado** inicialmente (`client_id = NULL`). Debes asignarlos manualmente cuando corresponda.

2. El campo `serial_number` es **único** en la base de datos. No se pueden insertar dos equipos con el mismo serial.

3. Si necesitas actualizar los datos desde el Excel nuevamente, el script detectará y omitirá los seriales que ya existen.

4. Los scripts de análisis (`analyze-equipment.js` y `analyze-equipment-detailed.js`) son temporales y pueden ser eliminados después de la importación.

