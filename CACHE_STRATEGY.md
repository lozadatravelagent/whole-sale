# 🚀 Estrategia de Caché Inteligente - Precios en Tiempo Real

## 📊 Problema Actual

- ❌ Cache TTL fijo de 24 horas
- ❌ Precios desactualizados
- ❌ Disponibilidad cambia pero usuarios ven datos viejos
- ❌ No competitivo vs agencias con datos frescos

## ✅ Solución: Sistema de 3 Niveles

### Nivel 1: Cache Ultra-Corto (2 minutos) - "Deduplicación"
**Objetivo:** Evitar búsquedas duplicadas inmediatas

```
Usuario A: "Vuelo Buenos Aires Madrid 15 dic"  → API EUROVIPS
Usuario B (30 segundos después): misma búsqueda → CACHE (2 min)
Usuario C (5 minutos después): misma búsqueda  → API EUROVIPS (cache expiró)
```

**TTL:** 2 minutos
**Beneficio:** Reduce llamadas API en búsquedas masivas sin sacrificar frescura

### Nivel 2: Cache Medio (30 minutos) - "Búsquedas Populares"
**Objetivo:** Cachear rutas populares con refresh inteligente

```
Ruta popular (ej: EZE-MAD):
- Primera búsqueda: API
- Siguientes 30 min: CACHE
- Después de 30 min: API + actualiza cache
```

**TTL:** 30 minutos para rutas populares (más de 3 búsquedas/día)
**Beneficio:** Balance entre velocidad y frescura

### Nivel 3: Cache Largo (4 horas) - "Datos Estáticos"
**Objetivo:** Cachear datos que casi no cambian

```
Datos casi estáticos:
- Lista de países (getCountryList)
- Lista de aerolíneas (getAirlineList)
- Códigos de aeropuertos
```

**TTL:** 4 horas
**Beneficio:** Reduce carga innecesaria en datos estables

---

## 🔧 Implementación Propuesta

### Opción A: TTL Dinámico (RECOMENDADO)

```typescript
function getSmartTTL(searchType: string, params: any, hitCount: number): number {
  switch (searchType) {
    case 'searchFlights':
    case 'searchHotels':
      // Búsquedas recientes: cache corto
      if (hitCount === 0) return 2; // 2 minutos (primera vez)
      if (hitCount < 3) return 15;  // 15 minutos (búsquedas normales)
      return 30; // 30 minutos (ruta popular)

    case 'searchPackages':
    case 'searchServices':
      return 60; // 1 hora (cambian menos)

    case 'getCountryList':
    case 'getAirlineList':
      return 240; // 4 horas (datos estáticos)

    default:
      return 30; // Default: 30 minutos
  }
}
```

### Opción B: Cache con "Soft Expiration" (MÁS AVANZADO)

```typescript
// Sistema de doble timestamp:
{
  soft_expires_at: now + 2 minutos,  // Después de esto, refrescar en background
  hard_expires_at: now + 30 minutos  // Después de esto, forzar API
}

// Flujo:
1. Usuario busca → si cache < soft_expires → devolver cache
2. Si cache > soft_expires pero < hard_expires:
   - Devolver cache (respuesta rápida)
   - Disparar refresh en background (async)
3. Si cache > hard_expires → forzar API (esperar)
```

**Ventaja:** Usuarios SIEMPRE tienen respuesta rápida + datos se refrescan automáticamente

---

## 📈 Recomendación Final: OPCIÓN B (Cache con Background Refresh)

### Por qué Opción B:

✅ **Mejor UX:** Respuestas instantáneas siempre
✅ **Datos frescos:** Se actualizan en background
✅ **Competitivo:** Precios actualizados cada 2-5 minutos
✅ **Eficiente:** Reduce carga API sin sacrificar frescura

### Configuración sugerida:

```typescript
SEARCH_CACHE_CONFIG = {
  flights: {
    soft_ttl: 2,    // 2 minutos → trigger background refresh
    hard_ttl: 30,   // 30 minutos → forzar API
  },
  hotels: {
    soft_ttl: 5,    // 5 minutos
    hard_ttl: 60,   // 1 hora
  },
  packages: {
    soft_ttl: 15,   // 15 minutos
    hard_ttl: 120,  // 2 horas
  },
  static: {
    soft_ttl: 60,   // 1 hora
    hard_ttl: 480,  // 8 horas (países, aerolíneas)
  }
}
```

---

## 🎯 Métricas a Implementar

1. **Cache Hit Rate por Tipo:**
   - Flights: objetivo 40-60% (balance frescura/velocidad)
   - Hotels: objetivo 50-70%
   - Static: objetivo 95%+

2. **Data Freshness:**
   - Average age of served cache
   - % de búsquedas servidas con datos < 5 minutos

3. **API Cost Savings:**
   - Llamadas evitadas vs llamadas reales
   - Costo ahorrado por mes

---

## ⚠️ Consideraciones Importantes

### 1. Invalidación Manual
Agregar endpoint para invalidar cache por ruta:
```
POST /invalidate-cache
{ "route": "EZE-MAD", "reason": "price_changed" }
```

### 2. Cache per Tenant
Diferentes agencias pueden tener:
- Tarifas negociadas diferentes
- Acceso a inventario exclusivo

**Solución:** Incluir `tenant_id` en cache_key

### 3. Notificaciones de Precio
Si precio cambia >10% durante background refresh:
- Notificar al usuario
- Mostrar badge "Precio actualizado"

---

## 🚀 Próximos Pasos

1. ✅ Implementar soft/hard TTL en cache.ts
2. ✅ Agregar background refresh worker
3. ✅ Actualizar eurovips-soap para usar nuevo sistema
4. ✅ Agregar métricas de cache freshness
5. ✅ Dashboard de monitoreo de cache

¿Quieres que implemente la Opción B (Cache con Background Refresh)?
