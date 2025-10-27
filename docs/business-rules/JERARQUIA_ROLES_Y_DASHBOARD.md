# Jerarquía de Roles y Vistas del Dashboard - WholeSale Connect AI

## 📋 Resumen de la Jerarquía

WholeSale Connect AI es una plataforma multi-tenant con 4 roles principales organizados jerárquicamente:

```
OWNER (Sistema Global)
  ↓
SUPERADMIN (Mayorista/Tenant)
  ↓
ADMIN (Agencia)
  ↓
SELLER (Vendedor)
```

---

## 🎯 Roles y Permisos

### 1. OWNER (Propietario del Sistema)

**Alcance:** Acceso total a todos los tenants y agencias del sistema

**Características:**
- No tiene `tenant_id` ni `agency_id` asignados (valores NULL)
- Ve y gestiona TODO el sistema
- Puede crear/editar/eliminar cualquier usuario de cualquier rol
- Acceso a todos los datos cross-tenant

**Permisos de Gestión de Usuarios:**
- ✅ Puede crear: OWNER, SUPERADMIN, ADMIN, SELLER
- ✅ Puede editar: Todos los usuarios
- ✅ Puede eliminar: Todos los usuarios (hard delete)
- ✅ Puede ver: Todos los usuarios del sistema

**Permisos de Gestión de Agencias:**
- ✅ Crear agencias en cualquier tenant
- ✅ Editar cualquier agencia
- ✅ Eliminar cualquier agencia (hard delete)
- ✅ Ver todas las agencias de todos los tenants

---

### 2. SUPERADMIN (Administrador del Mayorista)

**Alcance:** Gestión de un tenant específico y sus agencias

**Características:**
- Tiene `tenant_id` asignado (puede tener múltiples agencias)
- Tiene `agency_id` asignado (puede ser NULL si gestiona múltiples agencias del tenant)
- Ve y gestiona todas las agencias de su tenant
- Supervisa rendimiento agregado de las agencias

**Permisos de Gestión de Usuarios:**
- ✅ Puede crear: SUPERADMIN, ADMIN, SELLER (solo en su tenant)
- ❌ NO puede crear: OWNER
- ✅ Puede editar: Usuarios de su tenant (excepto OWNER)
- ✅ Puede eliminar: Usuarios de su tenant (soft delete, excepto OWNER)
- ✅ Puede ver: Usuarios de las agencias de su tenant

**Permisos de Gestión de Agencias:**
- ✅ Crear agencias en su tenant
- ✅ Editar agencias de su tenant
- ✅ Ver agencias de su tenant
- ❌ NO puede eliminar agencias (hard delete reservado para OWNER)

---

### 3. ADMIN (Administrador de Agencia)

**Alcance:** Gestión de una agencia específica

**Características:**
- Tiene `tenant_id` asignado
- Tiene `agency_id` asignado (una agencia específica)
- Ve y gestiona solo su agencia
- Supervisa el equipo de vendedores (SELLERS)

**Permisos de Gestión de Usuarios:**
- ✅ Puede crear: SELLER (solo en su agencia)
- ❌ NO puede crear: OWNER, SUPERADMIN, ADMIN
- ✅ Puede editar: SELLERS de su agencia
- ❌ NO puede eliminar usuarios
- ✅ Puede ver: SELLERS de su agencia

**Permisos de Gestión de Agencias:**
- ❌ NO puede crear agencias
- ✅ Puede ver su propia agencia
- ✅ Puede editar algunos campos de su agencia (branding, contacto)
- ❌ NO puede eliminar agencias

---

### 4. SELLER (Vendedor)

**Alcance:** Gestión de leads asignados personalmente

**Características:**
- Tiene `tenant_id` asignado
- Tiene `agency_id` asignado
- Solo ve sus propios leads asignados
- Ve conversaciones y mensajes de sus leads

**Permisos de Gestión de Usuarios:**
- ❌ NO puede crear usuarios
- ❌ NO puede editar usuarios
- ❌ NO puede eliminar usuarios
- ✅ Puede ver: Solo su propio perfil

**Permisos de Gestión de Agencias:**
- ❌ NO puede gestionar agencias
- ✅ Puede ver información de su agencia (solo lectura)

---

## 📊 Vistas del Dashboard por Rol

### Dashboard OWNER

**Título:** "Dashboard Global (OWNER)"

**Descripción:** "Vista completa de todos los tenants y agencias del sistema"

**Métricas Visibles:**

1. **Objetivos del Mes** (Agregado Global)
   - Ingresos mensuales totales (todos los tenants)
   - Tasa de conversión global
   - Tiempo de respuesta promedio

2. **Integraciones** (Estado Global)
   - Estado de integraciones por tenant
   - Eurovips, Starlings, Delfos, etc.

3. **Métricas Clave**
   - Conversaciones totales hoy (todos los tenants)
   - Cotizaciones generadas
   - Satisfacción promedio
   - Tiempo de respuesta global

4. **Performance por Agencia (Cross-Tenant)**
   - Lista de TODAS las agencias de TODOS los tenants
   - Comparativa de revenue por agencia
   - Tasa de conversión por agencia
   - Nombre del tenant al que pertenece cada agencia

5. **Alertas Importantes**
   - Leads pendientes de seguimiento (global)
   - Integraciones con errores
   - Agencias con bajo rendimiento

**Código de Referencia:** [Dashboard.tsx:179-193](src/pages/Dashboard.tsx#L179-L193)

```typescript
if (isOwner) return 'Dashboard Global (OWNER)';
// ...
if (isOwner) return 'Vista completa de todos los tenants y agencias del sistema';
```

**Ejemplo con datos reales:**

```
OWNER: owner@wholesaleconnect.com
├── Ve Tenant: "Mayorista España"
│   ├── Agencia: "Travel Dreams Madrid" → $45,000 revenue, 65% conv.
│   └── Agencia: "Sun & Beach BCN" → $38,000 revenue, 72% conv.
├── Ve Tenant: "Mayorista México"
│   ├── Agencia: "Viajes Cancún" → $52,000 revenue, 68% conv.
│   └── Agencia: "CDMX Travel" → $41,000 revenue, 70% conv.
└── Métricas totales: $176,000 revenue, 69% conversión promedio
```

---

### Dashboard SUPERADMIN

**Título:** "Dashboard del Mayorista"

**Descripción:** "Gestión y supervisión de todas tus agencias"

**Métricas Visibles:**

1. **Objetivos del Mes** (Agregado del Tenant)
   - Ingresos mensuales del tenant
   - Tasa de conversión del tenant
   - Tiempo de respuesta promedio

2. **Integraciones** (Del Tenant)
   - Estado de integraciones configuradas para el tenant
   - Eurovips, Starlings, Delfos específicos del tenant

3. **Métricas Clave**
   - Conversaciones totales hoy (del tenant)
   - Cotizaciones generadas (del tenant)
   - Satisfacción promedio (del tenant)
   - Tiempo de respuesta (del tenant)

4. **Performance de Agencias** (Del Tenant)
   - Lista de agencias del tenant
   - Revenue por agencia
   - Tasa de conversión por agencia
   - Número de vendedores por agencia

5. **Alertas Importantes**
   - Leads pendientes de seguimiento (del tenant)
   - Integraciones del tenant con errores
   - Agencias con bajo rendimiento (del tenant)

**Código de Referencia:** [Dashboard.tsx:181](src/pages/Dashboard.tsx#L181), [Dashboard.tsx:433-463](src/pages/Dashboard.tsx#L433-L463)

```typescript
if (isSuperAdmin) return 'Dashboard del Mayorista';
// ...
{(isSuperAdmin || isOwner) && metrics?.agenciesPerformance && (
  <Card>
    <CardTitle>Performance de Agencias</CardTitle>
    // Shows agencies of the tenant
  </Card>
)}
```

**Ejemplo con datos reales:**

```
SUPERADMIN: admin@mayoristaespana.com
Tenant: "Mayorista España"
├── Agencia: "Travel Dreams Madrid"
│   ├── 3 vendedores
│   └── $45,000 revenue, 65% conversión
├── Agencia: "Sun & Beach BCN"
│   ├── 5 vendedores
│   └── $38,000 revenue, 72% conversión
└── Total Tenant: $83,000 revenue, 68.5% conversión promedio
```

---

### Dashboard ADMIN

**Título:** "Dashboard de la Agencia"

**Descripción:** "Supervisión del equipo de vendedores y métricas de agencia"

**Métricas Visibles:**

1. **Objetivos del Mes** (De la Agencia)
   - Ingresos mensuales de la agencia
   - Tasa de conversión de la agencia
   - Tiempo de respuesta de la agencia

2. **Integraciones** (De la Agencia)
   - Estado de integraciones configuradas para la agencia
   - Eurovips, Starlings, Delfos de la agencia

3. **Métricas Clave**
   - Conversaciones totales hoy (de la agencia)
   - Cotizaciones generadas (de la agencia)
   - Satisfacción promedio (de la agencia)
   - Tiempo de respuesta (de la agencia)

4. **Performance del Equipo** (Team Performance Card)
   - Lista de SELLERS de la agencia
   - Leads por vendedor
   - Conversiones por vendedor
   - Revenue por vendedor
   - Rating de cada vendedor

5. **Alertas Importantes**
   - Leads pendientes de seguimiento (de la agencia)
   - Vendedores con bajo rendimiento
   - Seguimientos urgentes del equipo

**Código de Referencia:** [Dashboard.tsx:182](src/pages/Dashboard.tsx#L182), [Dashboard.tsx:429-431](src/pages/Dashboard.tsx#L429-L431)

```typescript
if (isAdmin) return 'Dashboard de la Agencia';
// ...
{isAdmin && metrics?.teamPerformance && (
  <TeamPerformanceCard teamPerformance={metrics.teamPerformance} />
)}
```

**Ejemplo con datos reales:**

```
ADMIN: admin@traveldreamsmadrid.com
Agencia: "Travel Dreams Madrid"
├── Vendedor: Juan Pérez
│   ├── 25 leads asignados
│   ├── 18 conversiones (72%)
│   └── $15,000 revenue
├── Vendedor: María García
│   ├── 30 leads asignados
│   ├── 20 conversiones (66.7%)
│   └── $18,000 revenue
├── Vendedor: Carlos López
│   ├── 20 leads asignados
│   ├── 12 conversiones (60%)
│   └── $12,000 revenue
└── Total Agencia: 75 leads, 50 conversiones (66.7%), $45,000 revenue
```

---

### Dashboard SELLER

**Título:** "Mi Dashboard Personal"

**Descripción:** "Tus leads asignados y métricas personales de rendimiento"

**Métricas Visibles:**

1. **Objetivos del Mes** (Personales)
   - Ingresos mensuales personales
   - Tasa de conversión personal
   - Tiempo de respuesta personal

2. **Integraciones** (Heredadas de la Agencia)
   - Estado de integraciones disponibles (solo visualización)
   - No puede modificar integraciones

3. **Métricas Clave Personales**
   - Conversaciones asignadas hoy
   - Cotizaciones generadas personales
   - Satisfacción de sus clientes
   - Tiempo de respuesta personal

4. **Leads Urgentes** (SellerUrgentLeadsCard)
   - Lista de leads asignados con fechas próximas
   - Seguimientos pendientes
   - Deadlines de cierre

5. **Métricas Personales** (PersonalMetricsCard)
   - Mis leads totales
   - Mis conversiones (won)
   - Mi revenue total
   - Mi tasa de conversión
   - Distribución de leads por sección

6. **Próximos Vencimientos** (Solo personales)
   - Deadlines de sus leads
   - Fechas de viaje próximas
   - Seguimientos programados

**Código de Referencia:** [Dashboard.tsx:183](src/pages/Dashboard.tsx#L183), [Dashboard.tsx:422-427](src/pages/Dashboard.tsx#L422-L427)

```typescript
if (isSeller) return 'Mi Dashboard Personal';
// ...
{isSeller && metrics?.personalMetrics && (
  <>
    <SellerUrgentLeadsCard urgentLeads={metrics.personalMetrics.upcoming_deadlines || []} />
    <PersonalMetricsCard metrics={metrics.personalMetrics} />
  </>
)}
```

**Ejemplo con datos reales:**

```
SELLER: juan.perez@traveldreamsmadrid.com
Mis Métricas:
├── Leads asignados: 25
├── Conversiones (won): 18 (72%)
├── Revenue personal: $15,000
├── Objetivo mensual: $20,000 (75% completado)
├── Leads por sección:
│   ├── Nuevos: 5
│   ├── Cotizados: 8
│   ├── Negociando: 7
│   ├── Ganados: 18
│   └── Perdidos: 7
└── Próximos vencimientos:
    ├── María González → Cancún (2 días)
    ├── Roberto Sánchez → Madrid (5 días)
    └── Ana Martínez → Barcelona (7 días)
```

---

## 🔐 Reglas de Negocio (RLS Policies)

### Tabla: users

**SELECT (Ver usuarios):**
```sql
-- Puede ver:
- Sí mismo (cualquier rol)
- OWNER: todos los usuarios
- SUPERADMIN: usuarios de su tenant/agencias asignadas
- ADMIN: SELLERS de su agencia
- SELLER: solo sí mismo
```

**INSERT (Crear usuarios):**
```sql
-- Puede crear:
- OWNER: OWNER, SUPERADMIN, ADMIN, SELLER (en cualquier tenant/agencia)
- SUPERADMIN: SUPERADMIN, ADMIN, SELLER (solo en su tenant)
- ADMIN: SELLER (solo en su agencia)
- SELLER: nadie
```

**UPDATE (Editar usuarios):**
```sql
-- Puede editar:
- Sí mismo (cualquier rol, campos limitados)
- OWNER: todos los usuarios
- SUPERADMIN: usuarios de su tenant (excepto OWNER)
- ADMIN: SELLERS de su agencia
- SELLER: solo sí mismo (campos limitados)
```

**DELETE (Eliminar usuarios):**
```sql
-- Puede eliminar (hard delete):
- OWNER: cualquier usuario
- Otros: NO (pueden "deactivate" pero no hard delete)
```

**Código de Referencia:** [20251005000002_user_management_helpers.sql:194-247](supabase/migrations/20251005000002_user_management_helpers.sql#L194-L247)

---

### Tabla: agencies

**SELECT (Ver agencias):**
```sql
-- Puede ver:
- OWNER: todas las agencias
- SUPERADMIN: agencias de su tenant
- ADMIN: su agencia
- SELLER: su agencia (solo lectura)
```

**INSERT (Crear agencias):**
```sql
-- Puede crear:
- OWNER: agencias en cualquier tenant
- SUPERADMIN: agencias en su tenant
- ADMIN: NO
- SELLER: NO
```

**UPDATE (Editar agencias):**
```sql
-- Puede editar:
- OWNER: cualquier agencia
- SUPERADMIN: agencias de su tenant
- ADMIN: NO (o solo campos específicos como branding)
- SELLER: NO
```

**DELETE (Eliminar agencias):**
```sql
-- Puede eliminar:
- OWNER: cualquier agencia (hard delete)
- Otros: NO
```

**Código de Referencia:** [20251005000002_user_management_helpers.sql:254-302](supabase/migrations/20251005000002_user_management_helpers.sql#L254-L302)

---

### Tabla: leads

**SELECT (Ver leads):**
```sql
-- Puede ver:
- OWNER: todos los leads
- SUPERADMIN: leads de su tenant
- ADMIN: leads de su agencia
- SELLER: solo leads asignados a él (assigned_user_id = auth.uid())
```

**INSERT (Crear leads):**
```sql
-- Puede crear:
- OWNER: leads en cualquier agencia
- SUPERADMIN: leads en agencias de su tenant
- ADMIN: leads en su agencia
- SELLER: leads en su agencia (se auto-asigna)
```

**UPDATE (Editar leads):**
```sql
-- Puede editar:
- OWNER: cualquier lead
- SUPERADMIN: leads de su tenant
- ADMIN: leads de su agencia
- SELLER: solo sus leads asignados
```

**DELETE (Eliminar leads):**
```sql
-- Puede eliminar:
- OWNER: cualquier lead
- SUPERADMIN: leads de su tenant
- ADMIN: leads de su agencia
- SELLER: NO (o solo sus propios leads con restricciones)
```

---

### Tabla: conversations

**SELECT (Ver conversaciones):**
```sql
-- Puede ver:
- OWNER: todas las conversaciones
- SUPERADMIN: conversaciones de su tenant
- ADMIN: conversaciones de su agencia
- SELLER: conversaciones de sus leads asignados
```

**INSERT (Crear conversaciones):**
```sql
-- Puede crear:
- Sistema/Webhooks: conversaciones nuevas
- OWNER: conversaciones en cualquier agencia
- SUPERADMIN: conversaciones en su tenant
- ADMIN: conversaciones en su agencia
- SELLER: conversaciones asignadas a él
```

---

## 📌 Funciones Helper Clave

### `can_create_user_with_role(target_role)`
Verifica si el usuario actual puede crear un usuario con el rol especificado.

**Código:** [20251005000002_user_management_helpers.sql:8-41](supabase/migrations/20251005000002_user_management_helpers.sql#L8-L41)

### `can_manage_user(target_user_id)`
Verifica si el usuario actual puede editar/eliminar al usuario objetivo.

**Código:** [20251005000002_user_management_helpers.sql:44-87](supabase/migrations/20251005000002_user_management_helpers.sql#L44-L87)

### `get_allowed_roles_for_creation()`
Retorna array de roles que el usuario actual puede crear.

**Código:** [20251005000002_user_management_helpers.sql:90-115](supabase/migrations/20251005000002_user_management_helpers.sql#L90-L115)

### `can_create_agency()`
Verifica si el usuario puede crear agencias.

**Código:** [20251005000002_user_management_helpers.sql:122-139](supabase/migrations/20251005000002_user_management_helpers.sql#L122-L139)

### `can_manage_agency(target_agency_id)`
Verifica si el usuario puede editar la agencia objetivo.

**Código:** [20251005000002_user_management_helpers.sql:142-177](supabase/migrations/20251005000002_user_management_helpers.sql#L142-L177)

---

## 🔍 Vista: users_with_details

Vista enriquecida que combina usuarios con información de agencias y tenants.

```sql
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.agency_id,
  u.tenant_id,
  u.provider,
  u.created_at,
  a.name as agency_name,
  t.name as tenant_name,
  a.status as agency_status
FROM users u
LEFT JOIN agencies a ON u.agency_id = a.id
LEFT JOIN tenants t ON u.tenant_id = t.id;
```

**Código:** [20251005000002_user_management_helpers.sql:309-324](supabase/migrations/20251005000002_user_management_helpers.sql#L309-L324)

Esta vista se usa en el hook `useUsers` para listar usuarios con su contexto completo.

**Código de uso:** [useUsers.ts:72-74](src/hooks/useUsers.ts#L72-L74)

---

## 📝 Ejemplos de Usuarios Reales

### Escenario 1: Sistema con 2 Tenants

```
🏢 SISTEMA WHOLESALE CONNECT AI

┌─ OWNER: system.owner@wholesaleconnect.com
│  └── Alcance: TODO el sistema

├─ 🌍 Tenant: "Mayorista España" (ID: tenant-esp-001)
│  │
│  ├─ SUPERADMIN: admin@mayoristaespana.com
│  │  └── Alcance: Todo el tenant "Mayorista España"
│  │
│  ├─ 📍 Agencia: "Travel Dreams Madrid" (ID: agency-mad-001)
│  │  │
│  │  ├─ ADMIN: admin@traveldreamsmadrid.com
│  │  │  └── Alcance: Solo agencia "Travel Dreams Madrid"
│  │  │
│  │  ├─ SELLER: juan.perez@traveldreamsmadrid.com
│  │  │  └── Leads asignados: 25 (solo ve estos)
│  │  │
│  │  └─ SELLER: maria.garcia@traveldreamsmadrid.com
│  │     └── Leads asignados: 30 (solo ve estos)
│  │
│  └─ 📍 Agencia: "Sun & Beach BCN" (ID: agency-bcn-001)
│     │
│     ├─ ADMIN: admin@sunbeachbcn.com
│     │  └── Alcance: Solo agencia "Sun & Beach BCN"
│     │
│     ├─ SELLER: carlos.lopez@sunbeachbcn.com
│     │  └── Leads asignados: 20
│     │
│     └─ SELLER: ana.martinez@sunbeachbcn.com
│        └── Leads asignados: 35

└─ 🌍 Tenant: "Mayorista México" (ID: tenant-mex-001)
   │
   ├─ SUPERADMIN: admin@mayoristamexico.com
   │  └── Alcance: Todo el tenant "Mayorista México"
   │
   ├─ 📍 Agencia: "Viajes Cancún" (ID: agency-cun-001)
   │  │
   │  ├─ ADMIN: admin@viajescancun.com
   │  │  └── Alcance: Solo agencia "Viajes Cancún"
   │  │
   │  └─ SELLER: luis.rodriguez@viajescancun.com
   │     └── Leads asignados: 40
   │
   └─ 📍 Agencia: "CDMX Travel" (ID: agency-cdmx-001)
      │
      ├─ ADMIN: admin@cdmxtravel.com
      │  └── Alcance: Solo agencia "CDMX Travel"
      │
      ├─ SELLER: sofia.hernandez@cdmxtravel.com
      │  └── Leads asignados: 28
      │
      └─ SELLER: diego.morales@cdmxtravel.com
         └── Leads asignados: 22
```

---

## 🎨 Qué Ve Cada Usuario en el Dashboard

### 1. system.owner@wholesaleconnect.com (OWNER)

**Dashboard Global:**
```
📊 INGRESOS TOTALES: $350,000 (todos los tenants)
📈 CONVERSIÓN GLOBAL: 68%

🌍 Tenants:
├─ Mayorista España: $165,000 (47%)
└─ Mayorista México: $185,000 (53%)

📍 Top Agencias (Cross-Tenant):
1. Viajes Cancún (Mayorista México): $95,000 → 70% conv.
2. CDMX Travel (Mayorista México): $90,000 → 68% conv.
3. Travel Dreams Madrid (Mayorista España): $85,000 → 65% conv.
4. Sun & Beach BCN (Mayorista España): $80,000 → 72% conv.

⚠️ Alertas:
- 15 leads pendientes de seguimiento (global)
- Integración Delfos con error en Mayorista España
- Agencia Travel Dreams Madrid por debajo del objetivo (85% del goal)
```

---

### 2. admin@mayoristaespana.com (SUPERADMIN - Tenant España)

**Dashboard del Mayorista:**
```
📊 INGRESOS DEL TENANT: $165,000
📈 CONVERSIÓN DEL TENANT: 68.5%

📍 Mis Agencias:
1. Travel Dreams Madrid
   ├─ 3 vendedores
   ├─ 75 leads totales
   ├─ $85,000 revenue
   └─ 65% conversión

2. Sun & Beach BCN
   ├─ 2 vendedores
   ├─ 55 leads totales
   ├─ $80,000 revenue
   └─ 72% conversión

⚠️ Alertas:
- 8 leads pendientes en Travel Dreams Madrid
- Integración Delfos con error
- Sun & Beach BCN superó objetivo mensual ✅
```

---

### 3. admin@traveldreamsmadrid.com (ADMIN - Agencia Madrid)

**Dashboard de la Agencia:**
```
📊 INGRESOS DE LA AGENCIA: $85,000
📈 CONVERSIÓN DE LA AGENCIA: 65%

👥 Mi Equipo de Vendedores:
1. Juan Pérez
   ├─ 25 leads asignados
   ├─ 18 conversiones (72%)
   └─ $32,000 revenue

2. María García
   ├─ 30 leads asignados
   ├─ 20 conversiones (66.7%)
   └─ $35,000 revenue

3. Carlos López (de otra agencia - NO LO VE)
   └─ [No visible para este ADMIN]

📊 Métricas de Agencia:
├─ Total leads: 75 (solo de Madrid)
├─ Leads nuevos hoy: 5
├─ Cotizaciones enviadas: 12
└─ Conversaciones activas: 18

⚠️ Alertas:
- 8 leads de Juan con seguimiento pendiente
- María tiene 3 deadlines esta semana
- Objetivo mensual: $100,000 (85% completado)
```

---

### 4. juan.perez@traveldreamsmadrid.com (SELLER)

**Mi Dashboard Personal:**
```
📊 MIS INGRESOS: $32,000
📈 MI CONVERSIÓN: 72%
🎯 OBJETIVO PERSONAL: $40,000 (80% completado)

📋 Mis Leads (25 totales):
├─ Nuevos: 3
├─ Cotizados: 8
├─ Negociando: 6
├─ Ganados: 18
└─ Perdidos: 7

⚠️ Mis Seguimientos Urgentes:
1. María González → Cancún (checkin en 2 días) 🔴
2. Roberto Sánchez → Madrid (seguimiento hoy) 🟠
3. Ana Martínez → Barcelona (cotización pendiente) 🟡

📅 Esta Semana:
├─ Lunes: 3 seguimientos programados
├─ Miércoles: 2 presentaciones de cotización
└─ Viernes: 1 cierre previsto ($5,000)

💬 Mis Conversaciones Activas: 8
├─ WhatsApp: 5
└─ Web: 3

❌ NO puede ver:
- Leads de María García (otra vendedora)
- Métricas de otros vendedores
- Dashboard de la agencia completa
- Configuración de usuarios
```

---

## 🔑 Resumen de Accesos por Rol

| Recurso | OWNER | SUPERADMIN | ADMIN | SELLER |
|---------|-------|------------|-------|--------|
| **Usuarios** ||||
| Ver todos los usuarios | ✅ | ❌ (solo su tenant) | ❌ (solo sellers de su agencia) | ❌ (solo sí mismo) |
| Crear OWNER | ✅ | ❌ | ❌ | ❌ |
| Crear SUPERADMIN | ✅ | ✅ (en su tenant) | ❌ | ❌ |
| Crear ADMIN | ✅ | ✅ (en su tenant) | ❌ | ❌ |
| Crear SELLER | ✅ | ✅ (en su tenant) | ✅ (en su agencia) | ❌ |
| Eliminar usuarios | ✅ (hard delete) | ❌ | ❌ | ❌ |
| **Agencias** ||||
| Ver todas las agencias | ✅ | ❌ (solo su tenant) | ❌ (solo su agencia) | ❌ (solo su agencia) |
| Crear agencias | ✅ | ✅ (en su tenant) | ❌ | ❌ |
| Editar agencias | ✅ | ✅ (de su tenant) | ⚠️ (solo branding) | ❌ |
| Eliminar agencias | ✅ (hard delete) | ❌ | ❌ | ❌ |
| **Leads** ||||
| Ver todos los leads | ✅ | ❌ (solo su tenant) | ❌ (solo su agencia) | ❌ (solo asignados) |
| Crear leads | ✅ | ✅ (en su tenant) | ✅ (en su agencia) | ✅ (auto-asignados) |
| Asignar leads | ✅ | ✅ (en su tenant) | ✅ (en su agencia) | ❌ |
| Editar cualquier lead | ✅ | ⚠️ (de su tenant) | ⚠️ (de su agencia) | ❌ (solo suyos) |
| **Dashboard** ||||
| Métricas globales | ✅ | ❌ | ❌ | ❌ |
| Métricas del tenant | ✅ | ✅ | ❌ | ❌ |
| Métricas de agencia | ✅ | ✅ (sus agencias) | ✅ (su agencia) | ❌ |
| Métricas de equipo | ✅ | ✅ (de sus agencias) | ✅ (de su agencia) | ❌ |
| Métricas personales | ✅ | ✅ | ✅ | ✅ |
| **Configuración** ||||
| Integraciones globales | ✅ | ❌ | ❌ | ❌ |
| Integraciones del tenant | ✅ | ✅ | ❌ | ❌ |
| Integraciones de agencia | ✅ | ✅ | ✅ | ❌ (solo vista) |

---

## 📚 Referencias del Código

### Hooks principales:
- [useUsers.ts](src/hooks/useUsers.ts) - Gestión de usuarios con permisos
- [useAuthUser.ts](src/hooks/useAuthUser.ts) - Autenticación y roles
- [useReports.ts](src/hooks/useReports.ts) - Métricas por rol

### Componentes del Dashboard:
- [Dashboard.tsx](src/pages/Dashboard.tsx) - Dashboard principal
- [TeamPerformanceCard.tsx](src/components/dashboard/TeamPerformanceCard.tsx) - Para ADMIN
- [PersonalMetricsCard.tsx](src/components/dashboard/PersonalMetricsCard.tsx) - Para SELLER
- [SellerUrgentLeadsCard.tsx](src/components/dashboard/SellerUrgentLeadsCard.tsx) - Para SELLER

### Migraciones clave:
- [20251005000002_user_management_helpers.sql](supabase/migrations/20251005000002_user_management_helpers.sql) - Funciones y RLS

---

## 🚀 Cómo Consultar Usuarios en Supabase

Para ver los usuarios actuales y su jerarquía, ejecuta en SQL Editor de Supabase:

```sql
-- Ver todos los usuarios con su contexto
SELECT
  u.email,
  u.role,
  t.name as tenant,
  a.name as agencia
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
LEFT JOIN agencies a ON u.agency_id = a.id
ORDER BY
  CASE u.role
    WHEN 'OWNER' THEN 1
    WHEN 'SUPERADMIN' THEN 2
    WHEN 'ADMIN' THEN 3
    WHEN 'SELLER' THEN 4
  END;
```

O usa el archivo preparado: [query_users_hierarchy.sql](query_users_hierarchy.sql)

---

**Fecha de actualización:** 5 de Octubre 2025
**Sistema:** WholeSale Connect AI v2.0
**Documentado por:** Claude Code
