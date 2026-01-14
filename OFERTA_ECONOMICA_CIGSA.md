# OFERTA ECONÓMICA - PROYECTO CIGSA
## Sistema de Gestión de Órdenes de Trabajo y Servicios

**Cliente:** CIGSA (Centro Industrial de Soldadura y Aplicaciones)  
**Fecha:** Diciembre 2024  
**Proyecto:** Aplicación PWA para Gestión de Órdenes de Trabajo y Servicios

---

## RESUMEN EJECUTIVO

Se ha desarrollado una aplicación web progresiva (PWA) completa para la gestión integral de órdenes de trabajo y servicios prestados por CIGSA a Minera de Panamá. El sistema incluye roles diferenciados para administradores y técnicos, con funcionalidades específicas para cada perfil, optimizado para uso en dispositivos móviles y escritorio.

---

## DESGLOSE DE MÓDULOS Y HORAS HOMBRE

### 1. ARQUITECTURA Y CONFIGURACIÓN INICIAL
**Descripción:** Configuración del proyecto, estructura de base de datos, autenticación JWT, middleware de seguridad y logging.

**Componentes:**
- Configuración de base de datos MySQL
- Sistema de autenticación con JWT
- Middleware de autorización por roles
- Sistema de logging de actividades
- Configuración PWA
- Estructura de carpetas y organización del código

**Horas Hombre:** 24 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $1,200 USD

---

### 2. MÓDULO DE AUTENTICACIÓN Y SEGURIDAD
**Descripción:** Sistema completo de login, gestión de sesiones y control de acceso.

**Componentes:**
- Pantalla de login con logo corporativo
- Autenticación JWT
- Gestión de tokens y refresh
- Protección de rutas por rol
- Middleware de seguridad
- Recuperación de contraseña (estructura base)

**Horas Hombre:** 16 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $800 USD

---

### 3. DASHBOARD ADMINISTRATIVO
**Descripción:** Panel de control con KPIs, métricas de productividad y visualización de datos.

**Componentes:**
- Dashboard con KPIs financieros
- Métricas de productividad técnica
- Avance de órdenes de servicio
- Gráficos y visualizaciones
- Responsive design

**Horas Hombre:** 20 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,100 USD

---

### 4. GESTIÓN DE CLIENTES
**Descripción:** CRUD completo para administración de clientes.

**Componentes:**
- Listado de clientes con filtros y búsqueda
- Crear nuevo cliente
- Editar cliente
- Desactivar cliente
- Validaciones y manejo de errores

**Horas Hombre:** 12 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $600 USD

---

### 5. GESTIÓN DE EQUIPOS (Sistema Completo Multi-Nivel)
**Descripción:** Sistema jerárquico de gestión de equipos con 4 niveles: Marcas, Modelos, Alojamientos y Equipos individuales.

**Componentes:**
- Gestión de Marcas de equipos
- Gestión de Modelos (asociados a marcas)
- Gestión de Alojamientos (asociados a modelos)
- Gestión de Equipos individuales (con número de serie)
- Asociación de equipos a clientes
- Sistema de documentación por nivel (marca/modelo/alojamiento)
- Subida y gestión de documentos técnicos
- Validaciones de integridad referencial
- Búsqueda y filtros avanzados

**Horas Hombre:** 32 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,760 USD

---

### 6. GESTIÓN DE SERVICIOS
**Descripción:** Administración completa de servicios ofrecidos por el taller.

**Componentes:**
- CRUD de servicios
- Código y descripción de servicios
- Categorización
- Duración estimada
- Precio estándar
- Gestión de costos (mano de obra, materiales, costo total)
- Cálculo de margen de ganancia
- Historial de servicios prestados
- Vista detallada con pestañas (Información General, Datos Financieros, Historial)

**Horas Hombre:** 24 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,320 USD

---

### 7. GESTIÓN DE USUARIOS Y TÉCNICOS
**Descripción:** Administración de usuarios del sistema con roles diferenciados.

**Componentes:**
- CRUD de usuarios
- Asignación de roles (admin, technician)
- Gestión de técnicos
- Validaciones de permisos
- Búsqueda y filtros

**Horas Hombre:** 16 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $800 USD

---

### 8. GESTIÓN DE ÓRDENES DE TRABAJO (Administrador)
**Descripción:** Sistema completo para creación, asignación y seguimiento de órdenes de trabajo.

**Componentes:**
- Listado de órdenes con filtros avanzados
- Creación de nuevas órdenes
- Asignación a técnicos
- Cambio de estados (creado, asignado, en proceso, finalizado, aceptado)
- Vista detallada con múltiples pestañas:
  - Detalles generales
  - Mediciones (iniciales y finales)
  - Fotos del servicio
  - Observaciones
  - Documentación técnica
- Fecha programada y seguimiento de fechas
- Búsqueda y filtros por estado, técnico, cliente, equipo

**Horas Hombre:** 40 horas  
**Precio Unitario:** $60 USD/hora  
**Subtotal:** $2,400 USD

---

### 9. CALENDARIO DE ÓRDENES DE TRABAJO
**Descripción:** Vista de calendario interactiva para visualización y gestión de órdenes.

**Componentes:**
- Calendario mensual con eventos
- Visualización de órdenes por fecha programada
- Colores diferenciados por estado
- Filtros por técnico y estado
- Vista responsive para móviles
- Integración con react-big-calendar

**Horas Hombre:** 18 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $990 USD

---

### 10. MÓDULO DE TÉCNICO (Dashboard y Gestión)
**Descripción:** Interfaz completa para técnicos con funcionalidades específicas.

**Componentes:**
- Dashboard de técnico con órdenes asignadas
- Vista de órdenes asignadas (solo las propias)
- Calendario personal del técnico
- Tarjetas interactivas de órdenes (clickeables)
- Navegación optimizada para móviles

**Horas Hombre:** 20 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,100 USD

---

### 11. MÓDULO DE INSPECCIÓN Y DOCUMENTACIÓN (Técnico)
**Descripción:** Sistema completo para que técnicos realicen inspecciones y documenten servicios.

**Componentes:**
- Vista detallada de orden de trabajo para técnico
- Captura de mediciones iniciales
- Captura de mediciones finales
- Comparación de mediciones
- Subida de fotos desde dispositivo móvil
- Gestión de observaciones (iniciales, durante servicio, finales)
- Cambio de estado de orden
- Cierre de órdenes con validaciones
- Visualización de documentación técnica (solo documentos autorizados)

**Horas Hombre:** 36 horas  
**Precio Unitario:** $60 USD/hora  
**Subtotal:** $2,160 USD

---

### 12. SISTEMA DE DOCUMENTACIÓN TÉCNICA
**Descripción:** Gestión avanzada de documentación asociada a equipos y órdenes.

**Componentes:**
- Subida de documentos por nivel (marca/modelo/alojamiento)
- Asociación automática de documentos a órdenes de trabajo
- Control de visibilidad para técnicos (checkboxes)
- Visualización de PDFs e imágenes
- Gestión de permisos por orden
- Tipos de documentos (manual, plano, especificación, otro)
- Sistema de archivos y almacenamiento

**Horas Hombre:** 24 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,320 USD

---

### 13. BITÁCORA DE ACTIVIDADES
**Descripción:** Sistema de registro y auditoría de todas las acciones del sistema.

**Componentes:**
- Registro automático de actividades
- Logging de acciones CRUD
- Registro de cambios de estado
- Historial de modificaciones
- Vista de bitácora para administradores
- Filtros y búsqueda en bitácora

**Horas Hombre:** 16 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $800 USD

---

### 14. DISEÑO RESPONSIVE Y UX/UI
**Descripción:** Diseño adaptativo y experiencia de usuario optimizada.

**Componentes:**
- Diseño responsive completo (móvil, tablet, desktop)
- Integración de logo corporativo
- Paleta de colores corporativa (incluyendo amarillo del logo)
- Componentes reutilizables
- Iconografía consistente
- Optimización para PWA
- Mejoras de usabilidad
- Animaciones y transiciones

**Horas Hombre:** 28 horas  
**Precio Unitario:** $55 USD/hora  
**Subtotal:** $1,540 USD

---

### 15. TESTING Y DEPURACIÓN
**Descripción:** Pruebas, corrección de errores y optimización.

**Componentes:**
- Testing de funcionalidades
- Corrección de bugs
- Optimización de consultas SQL
- Validación de integridad de datos
- Pruebas de integración
- Ajustes de rendimiento

**Horas Hombre:** 20 horas  
**Precio Unitario:** $50 USD/hora  
**Subtotal:** $1,000 USD

---

## RESUMEN DE COSTOS

| Módulo | Horas | Precio/Hora | Subtotal |
|--------|-------|-------------|----------|
| 1. Arquitectura y Configuración Inicial | 24 | $50 | $1,200 |
| 2. Módulo de Autenticación y Seguridad | 16 | $50 | $800 |
| 3. Dashboard Administrativo | 20 | $55 | $1,100 |
| 4. Gestión de Clientes | 12 | $50 | $600 |
| 5. Gestión de Equipos (Multi-Nivel) | 32 | $55 | $1,760 |
| 6. Gestión de Servicios | 24 | $55 | $1,320 |
| 7. Gestión de Usuarios y Técnicos | 16 | $50 | $800 |
| 8. Gestión de Órdenes de Trabajo (Admin) | 40 | $60 | $2,400 |
| 9. Calendario de Órdenes de Trabajo | 18 | $55 | $990 |
| 10. Módulo de Técnico (Dashboard) | 20 | $55 | $1,100 |
| 11. Módulo de Inspección y Documentación | 36 | $60 | $2,160 |
| 12. Sistema de Documentación Técnica | 24 | $55 | $1,320 |
| 13. Bitácora de Actividades | 16 | $50 | $800 |
| 14. Diseño Responsive y UX/UI | 28 | $55 | $1,540 |
| 15. Testing y Depuración | 20 | $50 | $1,000 |

**TOTAL DE HORAS:** 366 horas  
**TOTAL DEL PROYECTO:** $18,890 USD

---

## DESCUENTOS Y CONDICIONES

### Descuento por Proyecto Completo
**Descuento aplicado:** 10%  
**Monto del descuento:** $1,889 USD

### TOTAL FINAL
**SUBTOTAL:** $18,890 USD  
**DESCUENTO (10%):** -$1,889 USD  
**TOTAL A PAGAR:** $17,001 USD

---

## FORMA DE PAGO PROPUESTA

1. **Inicial (30%):** $5,100 USD - Al inicio del proyecto
2. **Intermedio (40%):** $6,800 USD - Al completar el 60% del desarrollo
3. **Final (30%):** $5,101 USD - Al entregar el proyecto completo y funcional

---

## ENTREGABLES

1. Código fuente completo del proyecto (Frontend y Backend)
2. Base de datos MySQL con estructura y datos de ejemplo
3. Documentación técnica del sistema
4. Manual de usuario para administradores
5. Manual de usuario para técnicos
6. Instrucciones de instalación y despliegue
7. Aplicación PWA funcional y desplegada

---

## TECNOLOGÍAS UTILIZADAS

### Frontend
- React 18+ con Vite
- React Router DOM
- Axios para comunicación API
- React Big Calendar
- Moment.js
- CSS Modules
- PWA Configuration

### Backend
- Node.js con Express.js
- MySQL con mysql2/promise
- JWT para autenticación
- Bcryptjs para hash de contraseñas
- Multer para manejo de archivos
- Middleware de seguridad y logging

### Base de Datos
- MySQL
- 15+ tablas relacionadas
- Índices optimizados
- Integridad referencial

---

## GARANTÍAS Y SOPORTE

### Garantía de Funcionamiento
- 3 meses de garantía post-entrega
- Corrección de bugs sin costo adicional
- Ajustes menores de funcionalidad

### Soporte Técnico
- Soporte por email durante 3 meses
- Resolución de consultas técnicas
- Asistencia en despliegue

---

## NOTAS ADICIONALES

- Todos los precios están en dólares estadounidenses (USD)
- El proyecto incluye diseño responsive completo
- Optimizado para dispositivos móviles (PWA)
- Sistema de roles y permisos implementado
- Bitácora completa de actividades
- Sistema de documentación técnica avanzado

---

**Preparado por:** Equipo de Desarrollo  
**Fecha:** Diciembre 2024  
**Vigencia de la oferta:** 30 días

---

*Esta oferta es válida por 30 días a partir de la fecha de emisión. Los precios y condiciones están sujetos a cambios después de este período.*


