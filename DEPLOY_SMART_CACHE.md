# 🚀 Despliegue de Caché Inteligente - Instrucciones

## ✅ Cambios Implementados

### 1. **Sistema de Caché con Soft/Hard TTL**

#### Configuración de TTLs por tipo de búsqueda:

| Tipo de Búsqueda | Soft TTL | Hard TTL | Descripción |
|------------------|----------|----------|-------------|
| **searchFlights** (Starling) | 2 min | 30 min | Precios actualizados cada 2min en background |
| **searchHotels** (Eurovips) | 5 min | 60 min | Disponibilidad fresca sin esperas |
| **searchPackages** | 15 min | 2 horas | Paquetes cambian menos frecuentemente |
| **Datos estáticos** | 1 hora | 8 horas | Países, aerolíneas, etc. |

#### ¿Cómo funciona?

```
Usuario busca "EZE → MAD, 15 dic":

Caso 1: Cache < 2 min (FRESH)
  → Devolver inmediatamente ✅
  → No hace nada más

Caso 2: Cache 2-30 min (STALE)
  → Devolver cache inmediatamente ✅
  → Disparar refresh en background 🔄
  → Próximo usuario verá datos frescos

Caso 3: Cache > 30 min (EXPIRED)
  → Llamar API y esperar ⏳
  → Guardar nuevo cache
```

### 2. **Archivos Modificados**

- ✅ `supabase/functions/_shared/cache.ts` - Sistema de caché inteligente
- ✅ `supabase/functions/starling-flights/index.ts` - Vuelos con refresh automático
- ✅ `supabase/functions/eurovips-soap/index.ts` - Hoteles con refresh automático

---

## 📋 Pasos para Desplegar

### Paso 1: Ejecutar Migración SQL en Supabase

1. Ve a: https://supabase.com/dashboard/project/ujigyazketblwlzcomve/editor
2. Abre y ejecuta: `MIGRATE_SMART_CACHE.sql`
3. Verifica que muestre: `✅ Smart cache migration completed!`

**Este script:**
- Agrega campos `soft_expires_at` y `hard_expires_at`
- Migra datos existentes
- Actualiza índices para mejor performance

### Paso 2: Desplegar Edge Functions

```bash
# Asegúrate de tener Supabase CLI instalado
npm install -g supabase

# Despliega las funciones actualizadas
supabase functions deploy starling-flights
supabase functions deploy eurovips-soap
```

**O si usas CI/CD**, simplemente pushea los cambios y se desplegarán automáticamente.

### Paso 3: Verificar Funcionamiento

#### Test 1: Cache FRESH
```bash
# Primera búsqueda - debe llamar API
curl -X POST https://ujigyazketblwlzcomve.supabase.co/functions/v1/starling-flights \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"searchFlights","data":{...}}'

# Respuesta debe incluir: "cached": false

# Segunda búsqueda (dentro de 2 min) - debe usar cache
curl ... (mismo request)
# Respuesta debe incluir: "cached": true, status logs: "✅ Cache FRESH"
```

#### Test 2: Cache STALE (Background Refresh)
```bash
# Espera 3 minutos...

# Nueva búsqueda - debe devolver cache + refrescar en background
curl ... (mismo request)
# Logs deben mostrar:
# "⚠️ Cache STALE - will refresh in background"
# "🔄 Triggering background refresh"
```

#### Test 3: Cache EXPIRED
```bash
# Espera 35 minutos...

# Nueva búsqueda - debe llamar API fresh
curl ... (mismo request)
# Logs deben mostrar:
# "❌ Cache HARD EXPIRED"
# Nueva llamada a API
```

---

## 📊 Monitoreo y Métricas

### Ver estado del caché:

```sql
-- Ver estadísticas generales
SELECT
  search_type,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE hard_expires_at > now()) as active,
  COUNT(*) FILTER (WHERE soft_expires_at < now() AND hard_expires_at > now()) as stale,
  AVG(hit_count) as avg_hits,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))/60) as avg_age_minutes
FROM search_cache
GROUP BY search_type
ORDER BY total_entries DESC;

-- Ver cache más usado (popular routes)
SELECT
  search_type,
  params->>'originCode' as origin,
  params->>'destinationCode' as destination,
  params->>'departureDate' as date,
  hit_count,
  EXTRACT(EPOCH FROM (now() - created_at))/60 as age_minutes,
  CASE
    WHEN soft_expires_at > now() THEN 'FRESH'
    WHEN hard_expires_at > now() THEN 'STALE'
    ELSE 'EXPIRED'
  END as status
FROM search_cache
WHERE search_type = 'searchFlights'
ORDER BY hit_count DESC
LIMIT 20;
```

### Logs a Monitorear:

En Supabase Edge Functions logs busca:

- `✅ Cache FRESH` - Cache usado sin refresh
- `⚠️ Cache STALE` - Cache usado + background refresh
- `🔄 Triggering background refresh` - Refresh automático disparado
- `💾 Caching searchFlights with soft TTL: 2min, hard TTL: 30min` - Nuevo cache guardado

---

## 🎯 Resultados Esperados

### Antes (Cache fijo 24h):
- ❌ Usuario ve precios de hace 20 horas
- ❌ Disponibilidad puede no ser real
- ❌ No competitivo vs otras agencias

### Después (Cache inteligente):
- ✅ Usuario ve precios de máximo 2-5 minutos
- ✅ Disponibilidad casi en tiempo real
- ✅ Respuestas instantáneas (cache)
- ✅ Costos API optimizados (background refresh)

### Ejemplo Práctico:

```
9:00 AM - Usuario A busca "EZE → MAD"
          → API Starling: 3 vuelos, $800 USD
          → Cache guardado (soft: 9:02, hard: 9:30)

9:01 AM - Usuario B busca lo mismo
          → Cache FRESH (1min) → Respuesta inmediata $800
          → No llama API

9:03 AM - Usuario C busca lo mismo
          → Cache STALE (3min) → Respuesta inmediata $800
          → Dispara refresh background

9:03 AM - (Background) API Starling actualiza cache
          → Nuevo vuelo agregado: $750 USD
          → Cache actualizado

9:04 AM - Usuario D busca lo mismo
          → Cache FRESH (1min) → Ve el vuelo de $750 USD ✅
          → Datos actualizados sin esperar
```

---

## 🔧 Ajustes Opcionales

### Si necesitas TTLs más agresivos:

Edita `supabase/functions/_shared/cache.ts`:

```typescript
export const CACHE_CONFIG = {
  'searchFlights': {
    soft_ttl_minutes: 1,   // Más agresivo: refresh cada 1 min
    hard_ttl_minutes: 15,  // Expira más rápido
  },
  // ...
};
```

### Si necesitas desactivar cache:

```typescript
// En starling-flights o eurovips-soap
const shouldCache = false; // Desactiva completamente
```

---

## ⚠️ Troubleshooting

### Problema: Background refresh no se ejecuta

**Solución:**
```sql
-- Verificar que la función puede llamarse a sí misma
-- Agregar permiso en Supabase Dashboard:
-- Settings → API → Allow anon calls to functions
```

### Problema: Cache nunca expira

**Solución:**
```sql
-- Ejecutar limpieza manual
SELECT clean_expired_cache();

-- Verificar cron job está configurado
SELECT * FROM pg_cron.job WHERE command LIKE '%clean_expired_cache%';
```

### Problema: Logs muestran errores de background refresh

**Solución:**
- Verificar que `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén en variables de entorno
- Revisar logs de Edge Functions en Supabase Dashboard

---

## ✅ Checklist de Deployment

- [ ] Ejecutar `MIGRATE_SMART_CACHE.sql` en Supabase
- [ ] Verificar migración exitosa (columnas soft/hard_expires_at existen)
- [ ] Desplegar `starling-flights` function
- [ ] Desplegar `eurovips-soap` function
- [ ] Test búsqueda de vuelos (verificar logs FRESH/STALE)
- [ ] Test búsqueda de hoteles (verificar logs FRESH/STALE)
- [ ] Monitorear logs por 1 hora
- [ ] Verificar métricas de cache hit rate
- [ ] Documentar para el equipo

---

**🎉 Una vez completado, tendrás precios en tiempo real con respuestas instantáneas!**
