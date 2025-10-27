# 📊 Diagrama Visual de Jerarquía - WholeSale Connect AI

## 🏗️ Estructura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         🌐 WHOLESALE CONNECT AI                          │
│                              (Plataforma SaaS)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Gestiona
                                      ↓
                          ┌─────────────────────┐
                          │   👑 OWNER          │
                          │                     │
                          │ • Ve TODO           │
                          │ • Gestiona TODO     │
                          │ • Cross-tenant      │
                          │ • Sin restricciones │
                          └─────────────────────┘
                                      │
                       ┌──────────────┴──────────────┐
                       ↓                             ↓
            ┌──────────────────┐          ┌──────────────────┐
            │  🏢 TENANT 1     │          │  🏢 TENANT 2     │
            │  "Mayorista ESP" │          │  "Mayorista MEX" │
            └──────────────────┘          └──────────────────┘
                       │                             │
                       ↓                             ↓
            ┌──────────────────┐          ┌──────────────────┐
            │ 🔧 SUPERADMIN    │          │ 🔧 SUPERADMIN    │
            │                  │          │                  │
            │ • Ve su tenant   │          │ • Ve su tenant   │
            │ • Gestiona       │          │ • Gestiona       │
            │   agencias       │          │   agencias       │
            └──────────────────┘          └──────────────────┘
                       │                             │
         ┌─────────────┴───────┐          ┌─────────┴──────────┐
         ↓                     ↓          ↓                    ↓
    ┌─────────┐          ┌─────────┐  ┌─────────┐       ┌─────────┐
    │🏪 AG. 1 │          │🏪 AG. 2 │  │🏪 AG. 3 │       │🏪 AG. 4 │
    │ Madrid  │          │Barcelona│  │ Cancún  │       │  CDMX   │
    └─────────┘          └─────────┘  └─────────┘       └─────────┘
         │                     │            │                 │
         ↓                     ↓            ↓                 ↓
    ┌─────────┐          ┌─────────┐  ┌─────────┐       ┌─────────┐
    │👔 ADMIN │          │👔 ADMIN │  │👔 ADMIN │       │👔 ADMIN │
    │         │          │         │  │         │       │         │
    │• Gestiona│         │• Gestiona│ │• Gestiona│      │• Gestiona│
    │  equipo │          │  equipo │  │  equipo │       │  equipo │
    └─────────┘          └─────────┘  └─────────┘       └─────────┘
         │                     │            │                 │
    ┌────┴────┐           ┌────┴────┐  ┌────┴────┐      ┌────┴────┐
    ↓         ↓           ↓         ↓  ↓         ↓      ↓         ↓
┌───────┐ ┌───────┐   ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│👤SELL1│ │👤SELL2│   │👤SELL3│ │👤SELL4│ │👤SELL5│ │👤SELL6│ │👤SELL7│
│       │ │       │   │       │ │       │ │       │ │       │ │       │
│25leads│ │30leads│   │20leads│ │35leads│ │40leads│ │28leads│ │22leads│
└───────┘ └───────┘   └───────┘ └───────┘ └───────┘ └───────┘ └───────┘
```

---

## 🔄 Flujo de Datos por Rol

### 📈 Vista OWNER (Global)
```
┌──────────────────────────────────────────────────────────┐
│              📊 DASHBOARD OWNER                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  💰 Revenue Global: $350,000                            │
│  📈 Conversión Global: 68%                              │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                │
│  │ 🏢 Tenant ESP  │  │ 🏢 Tenant MEX  │                │
│  │ $165k (47%)    │  │ $185k (53%)    │                │
│  └────────────────┘  └────────────────┘                │
│                                                          │
│  🏆 TOP AGENCIAS (Cross-Tenant):                        │
│  ├─ 1. Viajes Cancún (MEX): $95k → 70%                 │
│  ├─ 2. CDMX Travel (MEX): $90k → 68%                   │
│  ├─ 3. Travel Dreams (ESP): $85k → 65%                 │
│  └─ 4. Sun & Beach (ESP): $80k → 72%                   │
│                                                          │
│  ⚠️ ALERTAS GLOBALES:                                   │
│  • 15 leads pendientes (todos los tenants)             │
│  • Integración Delfos error en ESP                     │
│  • Agencia Travel Dreams bajo objetivo                 │
└──────────────────────────────────────────────────────────┘
        ↓ Accede a
┌──────────────────────────────────────────────────────────┐
│  📋 GESTIÓN USUARIOS                                     │
│  ✅ Crea: OWNER, SUPERADMIN, ADMIN, SELLER              │
│  ✅ Edita: Todos                                        │
│  ✅ Elimina: Todos (hard delete)                        │
│  ✅ Ve: Todos (cross-tenant)                            │
└──────────────────────────────────────────────────────────┘
```

---

### 🏢 Vista SUPERADMIN (Tenant)
```
┌──────────────────────────────────────────────────────────┐
│         📊 DASHBOARD MAYORISTA ESPAÑA                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  💰 Revenue Tenant: $165,000                            │
│  📈 Conversión Tenant: 68.5%                            │
│                                                          │
│  🏪 MIS AGENCIAS:                                        │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │ Travel Dreams MAD   │  │ Sun & Beach BCN     │      │
│  │ • 3 vendedores      │  │ • 2 vendedores      │      │
│  │ • 75 leads          │  │ • 55 leads          │      │
│  │ • $85k revenue      │  │ • $80k revenue      │      │
│  │ • 65% conversión    │  │ • 72% conversión ✅ │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                          │
│  ⚠️ ALERTAS DEL TENANT:                                 │
│  • 8 leads pendientes en Travel Dreams                  │
│  • Integración Delfos con error                        │
│  • Sun & Beach superó objetivo ✅                       │
└──────────────────────────────────────────────────────────┘
        ↓ Accede a
┌──────────────────────────────────────────────────────────┐
│  📋 GESTIÓN USUARIOS (Tenant España)                     │
│  ✅ Crea: SUPERADMIN, ADMIN, SELLER (en su tenant)      │
│  ❌ NO crea: OWNER                                      │
│  ✅ Edita: Usuarios de su tenant (excepto OWNER)        │
│  ✅ Ve: Solo agencias de "Mayorista España"             │
│  ❌ NO ve: Agencias de "Mayorista México"               │
└──────────────────────────────────────────────────────────┘
```

---

### 🏪 Vista ADMIN (Agencia)
```
┌──────────────────────────────────────────────────────────┐
│       📊 DASHBOARD TRAVEL DREAMS MADRID                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  💰 Revenue Agencia: $85,000                            │
│  📈 Conversión Agencia: 65%                             │
│  🎯 Objetivo: $100,000 (85% completado)                 │
│                                                          │
│  👥 MI EQUIPO:                                           │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 👤 Juan Pérez    │  │ 👤 María García  │            │
│  │ • 25 leads       │  │ • 30 leads       │            │
│  │ • 18 conv. (72%) │  │ • 20 conv. (67%) │            │
│  │ • $32k revenue   │  │ • $35k revenue   │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                          │
│  📊 MÉTRICAS AGENCIA:                                   │
│  • Total leads: 75                                      │
│  • Leads nuevos hoy: 5                                  │
│  • Cotizaciones enviadas: 12                            │
│  • Conversaciones activas: 18                           │
│                                                          │
│  ⚠️ ALERTAS AGENCIA:                                    │
│  • 8 leads de Juan con seguimiento pendiente           │
│  • María tiene 3 deadlines esta semana                 │
└──────────────────────────────────────────────────────────┘
        ↓ Accede a
┌──────────────────────────────────────────────────────────┐
│  📋 GESTIÓN USUARIOS (Agencia Madrid)                    │
│  ✅ Crea: SELLER (solo en Travel Dreams Madrid)         │
│  ❌ NO crea: OWNER, SUPERADMIN, ADMIN                   │
│  ✅ Edita: SELLERS de su agencia                        │
│  ✅ Ve: Solo SELLERS de Travel Dreams Madrid            │
│  ❌ NO ve: SELLERS de Sun & Beach BCN                   │
└──────────────────────────────────────────────────────────┘
```

---

### 👤 Vista SELLER (Personal)
```
┌──────────────────────────────────────────────────────────┐
│           📊 MI DASHBOARD - Juan Pérez                   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  💰 Mis Ingresos: $32,000                               │
│  📈 Mi Conversión: 72%                                  │
│  🎯 Mi Objetivo: $40,000 (80% completado)               │
│                                                          │
│  📋 MIS LEADS (25 totales):                             │
│  ┌─────────────────────────────────────────┐           │
│  │  🆕 Nuevos: 3                            │           │
│  │  💬 Cotizados: 8                         │           │
│  │  🤝 Negociando: 6                        │           │
│  │  ✅ Ganados: 18                          │           │
│  │  ❌ Perdidos: 7                          │           │
│  └─────────────────────────────────────────┘           │
│                                                          │
│  ⚠️ MIS SEGUIMIENTOS URGENTES:                          │
│  🔴 María González → Cancún (2 días)                   │
│  🟠 Roberto Sánchez → Madrid (hoy)                     │
│  🟡 Ana Martínez → Barcelona (cotización pendiente)    │
│                                                          │
│  📅 ESTA SEMANA:                                        │
│  • Lunes: 3 seguimientos programados                    │
│  • Miércoles: 2 presentaciones                         │
│  • Viernes: 1 cierre previsto ($5k)                    │
│                                                          │
│  💬 Conversaciones Activas: 8                           │
│     ├─ WhatsApp: 5                                      │
│     └─ Web: 3                                           │
└──────────────────────────────────────────────────────────┘
        ↓ Accede a
┌──────────────────────────────────────────────────────────┐
│  📋 GESTIÓN LIMITADA                                     │
│  ❌ NO crea usuarios                                     │
│  ❌ NO edita usuarios (excepto su perfil)               │
│  ✅ Ve: Solo sí mismo                                   │
│  ✅ Gestiona: Solo SUS leads asignados (25)             │
│  ❌ NO ve: Leads de María García ni otros sellers       │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 Tabla de Permisos Detallada

### Gestión de Usuarios

| Acción | OWNER | SUPERADMIN | ADMIN | SELLER |
|--------|:-----:|:----------:|:-----:|:------:|
| Ver usuarios | Todos | Solo su tenant | Solo sellers de su agencia | Solo sí mismo |
| Crear OWNER | ✅ | ❌ | ❌ | ❌ |
| Crear SUPERADMIN | ✅ | ✅ (tenant) | ❌ | ❌ |
| Crear ADMIN | ✅ | ✅ (tenant) | ❌ | ❌ |
| Crear SELLER | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |
| Editar OWNER | ✅ | ❌ | ❌ | ❌ |
| Editar otros roles | ✅ | ✅ (tenant) | ⚠️ (sellers) | ❌ |
| Eliminar usuarios | ✅ (hard) | ❌ | ❌ | ❌ |
| Resetear password | ✅ | ✅ (tenant) | ❌ | ❌ |

### Gestión de Agencias

| Acción | OWNER | SUPERADMIN | ADMIN | SELLER |
|--------|:-----:|:----------:|:-----:|:------:|
| Ver agencias | Todas | Solo su tenant | Solo su agencia | Solo su agencia |
| Crear agencia | ✅ | ✅ (tenant) | ❌ | ❌ |
| Editar agencia | ✅ | ✅ (tenant) | ⚠️ (branding) | ❌ |
| Eliminar agencia | ✅ (hard) | ❌ | ❌ | ❌ |
| Configurar integraciones | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ (solo vista) |

### Gestión de Leads

| Acción | OWNER | SUPERADMIN | ADMIN | SELLER |
|--------|:-----:|:----------:|:-----:|:------:|
| Ver leads | Todos | Solo su tenant | Solo su agencia | Solo asignados |
| Crear lead | ✅ | ✅ (tenant) | ✅ (agencia) | ✅ (auto-asigna) |
| Editar lead | ✅ | ✅ (tenant) | ✅ (agencia) | ✅ (solo suyos) |
| Asignar lead | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |
| Reasignar lead | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |
| Eliminar lead | ✅ | ✅ (tenant) | ⚠️ (agencia) | ❌ |
| Transferir lead | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |

### Acceso al Dashboard

| Vista | OWNER | SUPERADMIN | ADMIN | SELLER |
|-------|:-----:|:----------:|:-----:|:------:|
| Métricas globales | ✅ | ❌ | ❌ | ❌ |
| Métricas tenant | ✅ | ✅ | ❌ | ❌ |
| Métricas agencia | ✅ | ✅ (todas) | ✅ (suya) | ❌ |
| Performance equipo | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |
| Métricas personales | ✅ | ✅ | ✅ | ✅ |
| Comparativa agencias | ✅ | ✅ (tenant) | ❌ | ❌ |
| Leads urgentes equipo | ✅ | ✅ (tenant) | ✅ (agencia) | ❌ |
| Leads urgentes propios | ✅ | ✅ | ✅ | ✅ |

---

## 📍 Flujo de Creación de Usuarios

### Escenario: ADMIN crea un SELLER

```
1. ADMIN (admin@traveldreamsmadrid.com) inicia sesión
   └─ RLS verifica: role = 'ADMIN'
   └─ Carga: agency_id = 'agency-mad-001'

2. ADMIN abre página "Usuarios" (/users)
   └─ useUsers hook se activa
   └─ Llama: get_allowed_roles_for_creation()
   └─ Retorna: ['SELLER']

3. ADMIN hace clic en "Crear Usuario"
   └─ Formulario muestra:
      • Email: [input]
      • Password: [input]
      • Rol: [select] → Solo opción: SELLER
      • Agencia: Travel Dreams Madrid (bloqueado/readonly)

4. ADMIN completa formulario:
   └─ Email: nuevo.vendedor@traveldreamsmadrid.com
   └─ Password: *********
   └─ Rol: SELLER (único permitido)

5. Submit → useUsers.createUser()
   └─ Llama Edge Function: create-user
   └─ Edge Function valida:
      ✅ can_create_user_with_role('SELLER') → true
      ✅ Rol actual = 'ADMIN'
      ✅ Agency del nuevo user = agency del ADMIN

6. Edge Function crea usuario:
   └─ auth.users (tabla auth de Supabase)
      • id: [uuid generado]
      • email: nuevo.vendedor@...
      • encrypted_password: [hash]

   └─ public.users (tabla pública)
      • id: [mismo uuid]
      • email: nuevo.vendedor@...
      • role: 'SELLER'
      • agency_id: 'agency-mad-001'
      • tenant_id: 'tenant-esp-001'

7. RLS valida INSERT:
   └─ users_insert_policy ejecuta:
      ✅ can_create_user_with_role('SELLER') → true
      ✅ ADMIN role check → true
      ✅ agency_id match → true
      → INSERT permitido ✅

8. Frontend actualiza:
   └─ useUsers.loadUsers() refresca lista
   └─ Nuevo SELLER aparece en la tabla
   └─ Toast: "Usuario creado correctamente"
```

---

## 🚫 Restricciones Aplicadas por RLS

### Intentos Bloqueados

#### 1. SELLER intenta ver leads de otro SELLER
```sql
-- Query ejecutado:
SELECT * FROM leads WHERE agency_id = 'agency-mad-001';

-- RLS policy aplicada (leads_select_policy):
WHERE assigned_user_id = auth.uid() -- Solo sus leads

-- Resultado:
❌ Solo ve SUS 25 leads, no los 30 de María
```

#### 2. ADMIN intenta crear ADMIN
```sql
-- Insert ejecutado:
INSERT INTO users (email, role, agency_id)
VALUES ('nuevo@agency.com', 'ADMIN', 'agency-mad-001');

-- RLS policy aplicada (users_insert_policy):
WHERE can_create_user_with_role('ADMIN')
  AND role_actual = 'ADMIN'

-- Función can_create_user_with_role retorna:
❌ false (ADMIN solo puede crear SELLER)

-- Resultado:
❌ INSERT bloqueado por RLS
Error: "new row violates row-level security policy"
```

#### 3. SELLER intenta ver configuración de usuarios
```sql
-- Query ejecutado:
SELECT * FROM users_with_details;

-- RLS policy aplicada (users_select_policy):
WHERE id = auth.uid() -- Solo sí mismo

-- Resultado:
✅ Ve solo su registro
❌ NO ve a Juan, María, ni ADMIN
```

#### 4. SUPERADMIN intenta gestionar agencia de otro tenant
```sql
-- Update ejecutado:
UPDATE agencies
SET name = 'Nuevo Nombre'
WHERE id = 'agency-cun-001'; -- Agencia de Mayorista México

-- RLS policy aplicada (agencies_update_policy):
WHERE can_manage_agency('agency-cun-001')
  AND tenant_id_agencia = tenant_id_usuario

-- Función can_manage_agency retorna:
❌ false (agencia de otro tenant)

-- Resultado:
❌ UPDATE bloqueado
0 rows affected
```

---

## 🎯 Resumen Visual de Alcances

```
┌────────────────────────────────────────────────────────────┐
│                      ALCANCES POR ROL                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  👑 OWNER                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🌍 TODO EL SISTEMA                                  │  │
│  │  ├─ Tenant España + Tenant México + Tenant N         │  │
│  │  ├─ Todas las agencias                               │  │
│  │  ├─ Todos los usuarios                               │  │
│  │  └─ Todos los leads                                  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  🔧 SUPERADMIN (Mayorista España)                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🏢 TENANT: Mayorista España                         │  │
│  │  ├─ Agencia: Travel Dreams Madrid                    │  │
│  │  ├─ Agencia: Sun & Beach BCN                         │  │
│  │  ├─ Usuarios de ambas agencias                       │  │
│  │  └─ Leads de ambas agencias                          │  │
│  │                                                       │  │
│  │  ❌ NO VE:                                            │  │
│  │  └─ Nada de Mayorista México                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  👔 ADMIN (Travel Dreams Madrid)                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🏪 AGENCIA: Travel Dreams Madrid                    │  │
│  │  ├─ SELLER: Juan (25 leads)                          │  │
│  │  ├─ SELLER: María (30 leads)                         │  │
│  │  └─ Leads totales: 55                                │  │
│  │                                                       │  │
│  │  ❌ NO VE:                                            │  │
│  │  ├─ Sun & Beach BCN                                  │  │
│  │  └─ Agencias de otro tenant                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  👤 SELLER (Juan Pérez)                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  📋 MIS LEADS ASIGNADOS: 25                          │  │
│  │  ├─ María González → Cancún                          │  │
│  │  ├─ Roberto Sánchez → Madrid                         │  │
│  │  ├─ Ana Martínez → Barcelona                         │  │
│  │  └─ ... 22 leads más                                 │  │
│  │                                                       │  │
│  │  ❌ NO VE:                                            │  │
│  │  ├─ Leads de María García (30 leads)                 │  │
│  │  ├─ Métricas del ADMIN                               │  │
│  │  └─ Dashboard de agencia                             │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 📝 Checklist de Verificación por Rol

### ✅ Como OWNER puedo:
- [ ] Ver y gestionar TODOS los tenants
- [ ] Ver y gestionar TODAS las agencias
- [ ] Crear usuarios de CUALQUIER rol
- [ ] Ver métricas globales cross-tenant
- [ ] Eliminar (hard delete) usuarios y agencias
- [ ] Configurar integraciones globales
- [ ] Ver dashboard con comparativa cross-tenant

### ✅ Como SUPERADMIN puedo:
- [ ] Ver solo MI tenant y sus agencias
- [ ] Crear SUPERADMIN, ADMIN, SELLER en mi tenant
- [ ] Ver métricas agregadas del tenant
- [ ] Gestionar agencias de mi tenant
- [ ] Ver performance de todas mis agencias
- [ ] Configurar integraciones del tenant

### ❌ Como SUPERADMIN NO puedo:
- [ ] Ver tenants de otros mayoristas
- [ ] Crear usuarios OWNER
- [ ] Eliminar agencias (hard delete)
- [ ] Ver métricas globales

### ✅ Como ADMIN puedo:
- [ ] Ver solo MI agencia
- [ ] Crear SELLERS en mi agencia
- [ ] Ver métricas de mi agencia
- [ ] Ver performance de mi equipo
- [ ] Asignar/reasignar leads en mi agencia
- [ ] Editar configuración de branding

### ❌ Como ADMIN NO puedo:
- [ ] Ver otras agencias del tenant
- [ ] Crear ADMIN o SUPERADMIN
- [ ] Eliminar usuarios
- [ ] Configurar integraciones (solo branding)

### ✅ Como SELLER puedo:
- [ ] Ver solo MIS leads asignados
- [ ] Ver mis métricas personales
- [ ] Crear leads (auto-asignados a mí)
- [ ] Editar mis leads
- [ ] Ver conversaciones de mis leads
- [ ] Generar cotizaciones de mis leads

### ❌ Como SELLER NO puedo:
- [ ] Ver leads de otros sellers
- [ ] Asignar/reasignar leads
- [ ] Ver métricas de agencia
- [ ] Crear usuarios
- [ ] Configurar integraciones

---

**Última actualización:** 5 de Octubre 2025
**Sistema:** WholeSale Connect AI v2.0
