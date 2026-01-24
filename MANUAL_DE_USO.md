# Manual de Usuario - Búsquedas de Viajes con IA


## ✈️ Búsqueda de Vuelos

### Información Necesaria

Para buscar vuelos, la IA necesita:
- **Origen**: Ciudad de salida (código IATA o nombre)
- **Destino**: Ciudad de llegada
- **Fecha de ida**: Cuándo viajas
- **Fecha de vuelta**: Si es ida y vuelta (opcional para solo ida)
- **Pasajeros**: Adultos y niños (por defecto asume 1 adulto si no especificas)

### Ejemplos de Prompts Correctos

#### ✅ Ejemplo 1: Vuelo Ida y Vuelta Básico
```
Usuario: "Quiero un vuelo de Madrid a Nueva York del 1 al 8 de junio"
```

**Respuesta esperada de la IA:**
```
🔍 Analizando tu solicitud de vuelos...

✈️ Buscando vuelos: MAD → JFK
📅 Salida: 2026-06-01
📅 Regreso: 2026-06-08
👥 1 adulto

[La IA mostrará tarjetas con opciones de vuelo incluyendo:]
- Aerolínea
- Horarios de salida y llegada
- Duración total del vuelo
- Cantidad de escalas
- Precio por pasajero
- Tipo de equipaje incluido
```

#### ✅ Ejemplo 2: Vuelo con Múltiples Pasajeros
```
Usuario: "Quiero un vuelo de Buenos Aires a Madrid del 15 de marzo para 2 adultos y 1 niño"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos: EZE → MAD
📅 Salida: 2026-03-15
👥 2 adultos, 1 niño

[Opciones de vuelo para 3 pasajeros total]
```

#### ✅ Ejemplo 3: Solo Ida
```
Usuario: "Quiero un vuelo de Barcelona a Londres el 20 de noviembre"
```

**Respuesta esperada:**
```
✈️ Vuelo solo ida: BCN → LHR
📅 Salida: 2025-11-20
👥 1 adulto

[Opciones de vuelo solo ida]
```

#### ✅ Ejemplo 4: Con Preferencia de Escalas
```
Usuario: "Quiero un vuelo de México a París del 10 al 20 de diciembre, con una escala"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos con máximo 1 escala
📍 MEX → CDG
📅 10/12 - 20/12
👥 1 adulto

[Vuelos filtrados con 0 o 1 escala solamente]
```

#### ✅ Ejemplo 5: Vuelos Directos
```
Usuario: "Quiero un vuelo directo de Miami a Cancún del 5 al 12 de febrero"
```

**Respuesta esperada:**
```
✈️ Buscando solo vuelos DIRECTOS
📍 MIA → CUN
📅 05/02 - 12/02
👥 1 adulto

[Solo opciones de vuelo sin escalas]
```

#### ✅ Ejemplo 6: Con Límite de Tiempo en Escalas
```
Usuario: "Quiero un vuelo de Madrid a Tokyo del 1 al 15 de agosto con escalas de no más de 5 horas"
```

**Respuesta esperada:**
```
✈️ Buscando vuelos con escalas ≤ 5 horas
📍 MAD → TYO
📅 01/08 - 15/08
👥 1 adulto

[El sistema hace búsqueda expandida y filtra por duración de escala]
```

### Formatos de Fecha Aceptados

La IA entiende múltiples formatos de fecha:

**✅ Fechas relativas:**
- "en marzo" → Primera semana de marzo del año que corresponda
- "primera semana de julio" → Julio 1-7
- "próximo mes" → Mes siguiente

**✅ Fechas específicas:**
- "15 de diciembre" → 15/12/[año inteligente]
- "del 15 al 20 de diciembre" → Check-in: 15/12, Check-out: 20/12
- "15/12/2025" → Formato numérico
- "2025-12-15" → Formato ISO

**🧠 Lógica Inteligente de Años:**
La IA usa el año correcto automáticamente:
- Si el mes **YA PASÓ** este año → usa el **año siguiente**
- Si el mes **AÚN NO llega** este año → usa el **año actual**

### Preferencias de Vuelo que la IA Entiende

#### Escalas (Stops):
La IA reconoce estas preferencias:

- **"directo", "sin escalas", "non-stop"** → Solo vuelos directos
- **"con una escala", "1 escala"** → Máximo 1 parada
- **"con dos escalas"** → Máximo 2 paradas
- **"con escalas"** → Cualquier cantidad de escalas (genérico)
- **Sin mencionar escalas** → Muestra todas las opciones (directos y con escalas)

#### Duración de Escalas:
Si especificas tiempo máximo de escala:
```
"con escalas de no más de 3 horas"
"escalas cortas de máximo 4 horas"
```

La IA:
1. Hace una búsqueda amplia
2. Calcula el tiempo real de cada escala
3. Filtra solo las opciones que cumplan el criterio

#### Equipaje (Opcional):
**⚠️ IMPORTANTE:** Solo menciona equipaje si tienes una preferencia específica

- **"con equipaje en bodega", "con valija", "equipaje facturado"** → Busca opciones con equipaje despachado
- **"solo equipaje de mano", "carry on"** → Solo equipaje de cabina
- **No mencionar equipaje** → La IA NO filtrará por equipaje

#### Aerolínea Preferida (Opcional):
**⚠️ IMPORTANTE:** Solo menciona aerolínea si tienes preferencia

```
"vuelos con Iberia"
"prefiero American Airlines"
"en Aeromexico"
```

Si NO mencionas aerolínea, la IA buscará en todas las disponibles.



**💡 No es obligatorio usar códigos:** La IA entiende nombres de ciudades y los convierte automáticamente.

### Cómo Iterar la Búsqueda de Vuelos

Una vez que recibas resultados, puedes refinar:

```
✅ "quiero el mismo vuelo directo"

✅ "Con una escala máximo"

✅ "Con una escala de tres horas máximo"

```

**⚠️ LIMITACIÓN ACTUAL:** La iteración con contexto previo puede no funcionar perfectamente. Si la IA "olvida" tu búsqueda anterior, repite la solicitud completa con los cambios.

---

## 🏨 Búsqueda de Hoteles

### Información Necesaria

Para buscar hoteles, la IA necesita:
- **Destino**: Ciudad o zona donde buscar
- **Fecha de check-in**: Cuándo llegas
- **Fecha de check-out**: Cuándo te vas
- **Huéspedes**: Adultos y niños (por defecto asume 1 adulto si no especificas)

### Ejemplos de Prompts Correctos

#### ✅ Ejemplo 1: Hotel Básico
```
Usuario: "Quiero un hotel en Cancún del 15 al 22 de julio"
```

**Respuesta esperada de la IA:**
```
🏨 Buscando hoteles en Cancún

📅 Check-in: 15/07/2026
📅 Check-out: 22/07/2026
🌙 7 noches
👥 1 adulto

[La IA mostrará tarjetas con opciones de hotel incluyendo:]
- Nombre del hotel
- Categoría (estrellas)
- Tipo de habitación
- Régimen alimenticio
- Precio total y por noche
```

#### ✅ Ejemplo 2: Hotel con Tipo de Habitación
```
Usuario: "Quiero un hotel en Punta Cana del 1 al 8 de marzo para 2 adultos, habitación doble"
```

**Respuesta esperada:**
```
🏨 Buscando hoteles en Punta Cana

📅 01/03 - 08/03/2026
🌙 7 noches
👥 2 adultos
🛏️ Habitación doble (DBL)

[Opciones de hotel con habitaciones dobles]
```

#### ✅ Ejemplo 3: Hotel All Inclusive
```
Usuario: "Quiero un hotel all inclusive en Riviera Maya del 20 al 27 de diciembre"
```

**Respuesta esperada:**
```
🏨 Buscando hoteles ALL INCLUSIVE

📍 Riviera Maya
📅 20/12 - 27/12
🌙 7 noches
👥 1 adulto
🍽️ Todo incluido

[Solo hoteles con régimen all inclusive]
```

#### ✅ Ejemplo 4: Hotel con Cadena Específica
```
Usuario: "Quiero un hotel RIU en Cancún del 5 al 12 de agosto"
```

**Respuesta esperada:**
```
🏨 Buscando hoteles de la cadena RIU

📍 Cancún
📅 05/08 - 12/08
🌙 7 noches
👥 1 adulto

[Solo hoteles de la cadena RIU]
```

#### ✅ Ejemplo 5: Hotel para Familia
```
Usuario: "Quiero un hotel en Playa del Carmen del 10 al 17 de abril para 2 adultos y 2 niños"
```

**Respuesta esperada:**
```
🏨 Buscando hoteles familiares

📍 Playa del Carmen
📅 10/04 - 17/04
🌙 7 noches
👥 2 adultos, 2 niños

[Opciones de hotel con capacidad para 4 personas]
```

### Tipos de Habitación que la IA Entiende

| Código | Nombre | Capacidad |
|--------|--------|-----------|
| SGL | Single / Individual | 1 persona |
| DBL | Doble | 2 personas |
| TPL | Triple | 3 personas |
| QUA | Cuádruple | 4 personas |

**Ejemplos de cómo pedirlo:**
```
"habitación individual" → SGL
"habitación doble" → DBL
"habitación triple" → TPL
"habitación para 4" → QUA
"para 2 adultos y 1 niño" → TPL (automático)
```

### Regímenes Alimenticios

La IA reconoce estas preferencias de comida:

| Régimen | Palabras clave |
|---------|----------------|
| **All Inclusive** | "todo incluido", "all inclusive", "AI", "TI" |
| **Media Pensión** | "media pensión", "half board", "desayuno y cena" |
| **Solo Desayuno** | "con desayuno", "breakfast", "BB" |
| **Solo Habitación** | "sin comidas", "room only", "solo alojamiento" |

**Ejemplos:**
```
✅ "hotel all inclusive en Cancún"
✅ "hotel con desayuno en Madrid"
✅ "hotel media pensión en Roma"
✅ "hotel solo alojamiento en Barcelona"
```

### Cadenas Hoteleras Reconocidas

La IA reconoce las principales cadenas hoteleras:

- **RIU** - Riu Palace, Riu Playacar, etc.
- **Barceló** - Barceló Maya, Barceló Bávaro, etc.
- **Iberostar** - Iberostar Selection, Iberostar Grand, etc.
- **Meliá** - Meliá, Paradisus, Gran Meliá
- **Hard Rock** - Hard Rock Hotel
- **Hyatt** - Hyatt Ziva, Hyatt Zilara
- **Secrets** - Secrets Resorts (solo adultos)
- **Dreams** - Dreams Resorts
- **Sandals** - Sandals (solo adultos, parejas)
- **Palace Resorts** - Moon Palace, Beach Palace
- **Bahia Principe** - Grand Bahia Principe

**Ejemplo:**
```
Usuario: "Quiero un hotel Iberostar en República Dominicana del 1 al 8 de febrero"
```

### Destinos Especiales: Punta Cana

**⚠️ IMPORTANTE:** En Punta Cana, el sistema tiene una lista de hoteles preaprobados para garantizar calidad. Si buscas una cadena específica, se mostrarán los hoteles de esa cadena disponibles.

### Cómo Iterar la Búsqueda de Hoteles

Una vez que recibas resultados, puedes refinar:

```
✅ "Quiero ver solo los all inclusive"

✅ "Muéstrame hoteles de 5 estrellas"

✅ "Prefiero un RIU"

✅ "Quiero habitación triple"

✅ "Algo más barato"

✅ "Solo los que tienen media pensión"
```

---

## 🏝️ Búsqueda de Paquetes (Vuelo + Hotel)

### Información Necesaria

Para paquetes combinados:
- **Origen del vuelo**: Ciudad de salida
- **Destino**: Ciudad/resort
- **Fechas**: Fecha de ida y vuelta (el sistema calcula check-in/check-out automáticamente)
- **Pasajeros**: Adultos y niños (por defecto 1 adulto)

### Ejemplos de Prompts Correctos

#### ✅ Ejemplo 1: Paquete Completo Básico
```
Usuario: "Quiero un vuelo desde Madrid a Cancún del 20 al 27 de diciembre y tambien quiero un hotel mismas fechas"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada: Vuelos + Hoteles

✈️ VUELOS
📍 MAD → CUN
📅 20/12 - 27/12
[Opciones de vuelo]

🏨 HOTELES
📍 Cancún
📅 Check-in: 20/12 | Check-out: 27/12
🌙 7 noches
[Opciones de hotel]
```

#### ✅ Ejemplo 2: Paquete con Preferencias de Vuelo
```
Usuario: "Quiero un vuelo a Miami desde Ciudad de México del 10 al 17 de marzo, vuelos directos y tambien quiero un hotel mismas fechas habitacion doble all inclusive"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada

✈️ VUELOS DIRECTOS
MEX → MIA (10-17 marzo)
[Solo opciones sin escalas]

🏨 HOTELES ALL INCLUSIVE
📍 Miami
📅 7 noches
🛏️ Habitación doble
🍽️ Todo incluido
```

#### ✅ Ejemplo 3: Paquete con Cadena Hotelera
```
Usuario: "Quiero vuelo de Buenos Aires a Punta Cana del 5 al 12 de enero con hotel RIU all inclusive"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada

✈️ VUELOS
📍 EZE → PUJ
📅 05/01 - 12/01
👥 1 adulto

🏨 HOTELES RIU - ALL INCLUSIVE
📍 Punta Cana
🌙 7 noches
[Solo hoteles de cadena RIU con todo incluido]
```

#### ✅ Ejemplo 4: Paquete Familiar
```
Usuario: "Quiero un viaje a Cancún desde Santiago del 15 al 22 de julio para 2 adultos y 2 niños, con vuelo y hotel todo incluido"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada familiar

✈️ VUELOS
📍 SCL → CUN
📅 15/07 - 22/07
👥 2 adultos, 2 niños

🏨 HOTELES ALL INCLUSIVE
📍 Cancún
🌙 7 noches
👥 4 personas
🍽️ Todo incluido
[Opciones con capacidad familiar]
```

#### ✅ Ejemplo 5: Paquete con Escalas Limitadas
```
Usuario: "Quiero vuelo con máximo una escala de Lima a Riviera Maya del 1 al 10 de agosto, con hotel 5 estrellas all inclusive"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada premium

✈️ VUELOS (máx 1 escala)
📍 LIM → CUN
📅 01/08 - 10/08
[Vuelos directos o con 1 escala]

🏨 HOTELES 5⭐ ALL INCLUSIVE
📍 Riviera Maya
🌙 9 noches
[Hoteles de lujo con todo incluido]
```

#### ✅ Ejemplo 6: Paquete Solo Ida con Hotel
```
Usuario: "Quiero un vuelo solo ida de Bogotá a Playa del Carmen el 20 de diciembre y hotel hasta el 27"
```

**Respuesta esperada:**
```
🌟 Búsqueda combinada (vuelo solo ida)

✈️ VUELO SOLO IDA
📍 BOG → CUN
📅 20/12

🏨 HOTELES
📍 Playa del Carmen
📅 Check-in: 20/12 | Check-out: 27/12
🌙 7 noches
```

### Cómo Combinar Preferencias

Puedes mezclar preferencias de vuelo y hotel en el mismo mensaje:

**Preferencias de Vuelo:**
- Directo / con escalas
- Aerolínea específica
- Tiempo máximo de escala
- Equipaje

**Preferencias de Hotel:**
- Cadena hotelera
- Tipo de habitación
- Régimen alimenticio
- Categoría (estrellas)

**Ejemplo combinando todo:**
```
Usuario: "Vuelo directo de Madrid a Cancún del 20 al 27 de marzo con Iberia,
         y hotel RIU all inclusive habitación doble para 2 adultos"
```

### Cómo Iterar Búsquedas de Paquetes

Una vez que recibas resultados, puedes modificar solo una parte:

```
✅ "Quiero el mismo viaje pero con vuelo directo"
→ Mantiene hotel, cambia a vuelos directos

✅ "Cambia el hotel a un Barceló"
→ Mantiene vuelos, busca hoteles Barceló

✅ "Quiero ver hoteles all inclusive"
→ Mantiene vuelos, filtra hoteles AI

✅ "El mismo pero con una escala máximo"
→ Mantiene hotel, filtra vuelos

✅ "Agrega un niño"
→ Rehace búsqueda para 2 adultos + 1 niño
```

**⚠️ IMPORTANTE:**
- No se reservan juntos automáticamente
- Cada vuelo y hotel se cotiza independientemente
- Puedes combinar cualquier vuelo con cualquier hotel de los resultados
- El precio total del paquete es la suma del vuelo elegido + hotel elegido

### Armando tu Paquete

Una vez que tienes los resultados:

1. **Elige tu vuelo** - De las opciones mostradas
2. **Elige tu hotel** - De las opciones mostradas
3. **Suma los precios** - Vuelo + Hotel = Precio total del paquete
4. **Solicita cotización** - La IA puede generar un PDF con tu selección

**Ejemplo de selección:**
```
Usuario: "Me interesa el vuelo de Iberia a $850 y el hotel RIU Palace a $1,200"

IA: "Perfecto, tu paquete quedaría:
     ✈️ Vuelo Iberia: $850
     🏨 RIU Palace (7 noches): $1,200
     💰 Total: $2,050 por persona

     ¿Quieres que genere una cotización en PDF?"
```

---

## 💰 Cambio de Precios en Cotizaciones

### Cómo Funciona

Una vez que tienes una cotización generada, puedes modificar los precios antes de enviarla al cliente. El sistema ajusta automáticamente todos los componentes de forma proporcional.

### Cotización con Un Solo Hotel

Si tu cotización tiene un solo hotel, puedes cambiar el precio total:

```
Usuario: "Cambia el precio a $3,500"

IA: "💰 Precio actualizado

     Precio anterior: $2,900
     Precio nuevo: $3,500

     [PDF actualizado con nuevo precio]"
```

### Cotización con Múltiples Hoteles (Económico y Premium)

Cuando la cotización incluye 2 o más hoteles, el sistema automáticamente genera dos opciones:
- **Opción Económica**: Con el hotel más barato
- **Opción Premium**: Con el hotel más caro

Puedes cambiar cada precio por separado:

#### ✅ Cambiar Precio Económico
```
Usuario: "Cambia el precio económico a $2,800"

IA: "💰 Precio ECONÓMICO actualizado

     Opción Económica: $2,800
     Opción Premium: $3,500 (sin cambios)

     [PDF actualizado]"
```

#### ✅ Cambiar Precio Premium
```
Usuario: "Cambia el precio premium a $4,000"

IA: "💰 Precio PREMIUM actualizado

     Opción Económica: $2,800 (sin cambios)
     Opción Premium: $4,000

     [PDF actualizado]"
```

#### ✅ Cambiar Ambos Precios
```
Usuario: "Cambia el económico a $2,500 y el premium a $3,800"

IA: "💰 Precios actualizados

     Opción Económica: $2,500
     Opción Premium: $3,800

     [PDF actualizado]"
```

### Comandos Reconocidos para Cambiar Precio

El sistema entiende múltiples formas de pedir el cambio:

**Para precio único o económico:**
```
"Cambia el precio a $X"
"Pon el precio en $X"
"El precio debería ser $X"
"Cambia el precio económico a $X"
"El económico a $X"
```

**Para precio premium:**
```
"Cambia el precio premium a $X"
"El premium a $X"
"La opción cara a $X"
```

**Para ambos:**
```
"Económico $X y premium $Y"
"Cambia económico a $X, premium a $Y"
```

### Ejemplo Completo de Flujo

```
Usuario: "Quiero vuelo de Madrid a Cancún del 20 al 27 de marzo con hotel RIU o Barceló all inclusive"

IA: "🌟 Búsqueda combinada

     ✈️ VUELOS: MAD → CUN
     [3 opciones de vuelo]

     🏨 HOTELES ALL INCLUSIVE:
     - RIU Palace: $1,800/persona
     - Barceló Maya: $1,500/persona

     ¿Quieres generar cotización?"

Usuario: "Sí, con el vuelo de Iberia a $900"

IA: "📄 Generando cotización con 2 opciones:

     💎 OPCIÓN PREMIUM (RIU Palace)
     Vuelo + Hotel: $2,700/persona

     💰 OPCIÓN ECONÓMICA (Barceló Maya)
     Vuelo + Hotel: $2,400/persona

     [PDF generado]"

Usuario: "Cambia el económico a $2,600 y el premium a $3,000"

IA: "💰 Precios actualizados:

     💎 OPCIÓN PREMIUM: $3,000/persona
     💰 OPCIÓN ECONÓMICA: $2,600/persona

     [PDF actualizado con nuevos precios]"
```

### Notas Importantes

- **Ajuste proporcional**: Cuando cambias el precio, el sistema ajusta proporcionalmente vuelo y hotel para mantener coherencia
- **Historial**: Puedes cambiar el precio múltiples veces antes de enviar
- **Regenerar PDF**: Cada cambio de precio genera un nuevo PDF actualizado
- **Sin límites**: No hay restricción en cuánto puedes subir o bajar el precio

---

## 💡 Consejos para Mejores Resultados

### ✅ Buenas Prácticas

1. **Sé específico con las fechas**
   - ❌ "En verano"
   - ✅ "Del 15 de julio al 22 de julio"

2. **Indica ida y vuelta claramente (vuelos)**
   - ❌ "Vuelo a Londres el 10 de mayo"
   - ✅ "Vuelo ida y vuelta a Londres del 10 al 17 de mayo"
   - ✅ "Vuelo solo ida a Londres el 10 de mayo"

3. **Indica check-in y check-out claramente (hoteles)**
   - ❌ "Hotel en Cancún en julio"
   - ✅ "Hotel en Cancún del 15 al 22 de julio"

4. **Especifica si quieres paquete completo**
   - ❌ "Quiero ir a Punta Cana"
   - ✅ "Quiero vuelo y hotel en Punta Cana del 1 al 8 de marzo"
   - ✅ "Quiero solo hotel en Punta Cana del 1 al 8 de marzo"

5. **No necesitas especificar pasajeros si viajas solo**
   - Por defecto asume 1 adulto
   - Solo menciona si son 2 o más personas

6. **Preferencias opcionales solo si son importantes**
   - NO menciones aerolínea si no tienes preferencia
   - NO menciones cadena hotelera si te da igual
   - NO menciones régimen alimenticio si aceptas cualquiera
   - Solo agrega restricciones si realmente las necesitas

7. **Usa lenguaje natural**
   - No necesitas hablar formal
   - La IA entiende conversaciones normales

### ❌ Errores Comunes a Evitar

1. **No proporcionar fechas**
   ```
   ❌ "Busca vuelos a Cancún"
   ✅ "Busca vuelos a Cancún del 15 al 20 de diciembre"

   ❌ "Quiero un hotel en Punta Cana"
   ✅ "Quiero un hotel en Punta Cana del 1 al 8 de marzo"
   ```

2. **Ambigüedad en ida/vuelta**
   ```
   ❌ "Vuelo a París el 1 de junio"
   ✅ "Vuelo ida y vuelta a París del 1 al 8 de junio"
   ✅ "Vuelo solo ida a París el 1 de junio"
   ```

3. **Mezclar múltiples búsquedas**
   ```
   ❌ "Busca vuelos a Cancún y a Miami y también a Punta Cana"
   ✅ [Hacer una búsqueda a la vez]
   ```

4. **Agregar restricciones innecesarias**
   ```
   ❌ "Vuelo directo con Iberia con equipaje facturado solo ventana asiento 12A"
   ✅ "Vuelo directo de Madrid a Nueva York del 1 al 8 de junio"
   ```

5. **Pedir paquete sin especificar hotel**
   ```
   ❌ "Quiero viajar a Cancún del 10 al 17"
   ✅ "Quiero vuelo y hotel en Cancún del 10 al 17 de marzo"
   ✅ "Quiero solo vuelo a Cancún del 10 al 17 de marzo"
   ```

6. **No especificar régimen alimenticio cuando importa**
   ```
   ❌ "Hotel en Cancún" (asume cualquier régimen)
   ✅ "Hotel all inclusive en Cancún" (si lo necesitas)
   ```

---

## 🔄 Conversaciones de Ejemplo (Reales)

### Ejemplo 1: Búsqueda de Vuelos Simple

```
Usuario: "Quiero un vuelo de Madrid a Nueva York del 1 al 8 de junio"

IA: "🔍 Analizando tu solicitud de vuelos...

     ✈️ Buscando vuelos: MAD → JFK
     📅 Salida: 2026-06-01
     📅 Regreso: 2026-06-08
     👥 1 adulto

     [Mostrando opciones de vuelo con precios, horarios, escalas]"
```

### Ejemplo 2: Búsqueda con Preferencias de Vuelo

```
Usuario: "Quiero un vuelo directo de Barcelona a Roma del 5 al 10 de mayo para 2 personas"

IA: "✈️ Buscando solo vuelos DIRECTOS

     BCN → FCO
     📅 05/05/2026 - 10/05/2026
     👥 2 adultos

     [Opciones de vuelo directo para 2 pasajeros]"

Usuario: "quiero el mismo vuelo con una escala"

IA: "✈️ Modificando búsqueda: máximo 1 escala

     BCN → FCO
     📅 05/05/2026 - 10/05/2026
     👥 2 adultos

     [Vuelos con 0 o 1 escala]"
```

### Ejemplo 3: Búsqueda de Hotel Simple

```
Usuario: "Quiero un hotel en Playa del Carmen del 10 al 17 de marzo"

IA: "🏨 Buscando hoteles en Playa del Carmen

     📅 Check-in: 10/03/2026
     📅 Check-out: 17/03/2026
     🌙 7 noches
     👥 1 adulto

     [Tarjetas de hotel con nombre, categoría, régimen y precio]"
```

### Ejemplo 4: Hotel con Preferencias

```
Usuario: "Quiero un hotel RIU all inclusive en Cancún del 20 al 27 de diciembre para 2 adultos"

IA: "🏨 Buscando hoteles RIU - ALL INCLUSIVE

     📍 Cancún
     📅 20/12 - 27/12
     🌙 7 noches
     👥 2 adultos
     🍽️ Todo incluido

     [Solo hoteles de cadena RIU con todo incluido]"

Usuario: "Muéstrame también Barceló"

IA: "🏨 Agregando hoteles BARCELÓ

     [Hoteles RIU + Barceló all inclusive en Cancún]"
```

### Ejemplo 5: Paquete Completo (Vuelo + Hotel)

```
Usuario: "Quiero un vuelo de Madrid a Cancún del 20 al 27 de diciembre y tambien quiero un hotel mismas fechas"

IA: "🌟 Búsqueda combinada: Vuelos + Hoteles

     ✈️ VUELOS
     MAD → CUN
     20-27 diciembre 2026
     1 adulto

     [Opciones de vuelo]

     🏨 HOTELES
     Cancún
     Check-in: 20/12 | Check-out: 27/12
     7 noches
     1 adulto

     [Opciones de hotel ordenados por precio]"
```

### Ejemplo 6: Paquete con Preferencias Combinadas

```
Usuario: "Quiero vuelo directo de Buenos Aires a Punta Cana del 5 al 12 de enero
          con hotel Iberostar all inclusive habitación doble para 2 adultos"

IA: "🌟 Búsqueda combinada premium

     ✈️ VUELOS DIRECTOS
     📍 EZE → PUJ
     📅 05/01 - 12/01
     👥 2 adultos
     [Solo vuelos sin escalas]

     🏨 HOTELES IBEROSTAR - ALL INCLUSIVE
     📍 Punta Cana
     🌙 7 noches
     👥 2 adultos
     🛏️ Habitación doble
     🍽️ Todo incluido
     [Hoteles Iberostar disponibles]"

Usuario: "Cambia a vuelos con una escala máximo"

IA: "✈️ Modificando búsqueda de vuelos: máximo 1 escala

     [Vuelos directos + con 1 escala]
     [Hoteles Iberostar se mantienen igual]"
```

### Ejemplo 7: Paquete Familiar

```
Usuario: "Viaje a Riviera Maya desde Lima del 15 al 22 de julio
          para 2 adultos y 2 niños, vuelo y hotel todo incluido"

IA: "🌟 Búsqueda combinada familiar

     ✈️ VUELOS
     📍 LIM → CUN
     📅 15/07 - 22/07
     👥 2 adultos, 2 niños

     🏨 HOTELES ALL INCLUSIVE
     📍 Riviera Maya
     🌙 7 noches
     👥 4 personas (2 adultos + 2 niños)
     🍽️ Todo incluido

     [Vuelos para 4 pasajeros]
     [Hoteles con capacidad familiar]"
```

### Ejemplo 8: Selección y Cotización

```
Usuario: "Me gusta el vuelo de Avianca a $1,100 y el hotel RIU Playacar a $1,800"

IA: "Excelente elección. Tu paquete:

     ✈️ Vuelo Avianca (LIM → CUN): $1,100/persona
     🏨 RIU Playacar 7 noches: $1,800/persona

     💰 TOTAL: $2,900 por persona
     👥 4 personas: $11,600 total

     ¿Quieres que genere una cotización en PDF?"

Usuario: "Sí, genera el PDF"

IA: "📄 Generando cotización...
     [PDF con vuelo + hotel + desglose de precios]"
```

### Ejemplo 9: Solicitud Incompleta

```
Usuario: "Quiero viajar"

IA: "Para buscar tu viaje necesito:

     **Origen:** ¿Desde dónde viajas?
     **Destino:** ¿A dónde quieres ir?
     **Fechas:** ¿Cuándo viajas (ida y vuelta)?
     **Tipo:** ¿Solo vuelo, solo hotel, o paquete completo?"

Usuario: "A Cancún en marzo con hotel"

IA: "Perfecto, Cancún en marzo con vuelo y hotel.

     Necesito confirmar:
     **Origen:** ¿Desde qué ciudad sales?
     **Fechas:** ¿Qué días exactos de marzo?"

Usuario: "Desde Madrid del 10 al 17"

IA: "🌟 Búsqueda combinada: MAD → CUN

     📅 10/03 - 17/03
     🌙 7 noches
     👥 1 adulto

     [Buscando vuelos y hoteles...]"
```

### Ejemplo 10: Iteración de Búsqueda

```
Usuario: "Busca hoteles en Punta Cana del 1 al 8 de febrero"

IA: "🏨 Buscando hoteles en Punta Cana
     [10 opciones de hotel]"

Usuario: "Solo all inclusive"

IA: "🏨 Filtrando solo ALL INCLUSIVE
     [6 opciones de hotel con todo incluido]"

Usuario: "Prefiero RIU o Barceló"

IA: "🏨 Filtrando cadenas RIU y Barceló
     [3 opciones: 2 RIU, 1 Barceló]"

Usuario: "El más barato"

IA: "🏨 Opción más económica:

     Barceló Bávaro Beach ⭐⭐⭐⭐⭐
     📅 7 noches
     🍽️ All Inclusive
     💰 $980 por persona

     ¿Te interesa esta opción?"
```
---

## 🆘 Soporte y Limitaciones

### Si algo no funciona:

0. *Empieza una nueva conversacion, un nuevo chat.*
1. **Reformula tu pregunta** con información más específica
2. **Incluye todas las fechas** en formato claro (dd/mm o "del X al Y de [mes]")
3. **Especifica ida y vuelta** o "solo ida" explícitamente
4. **Repite la búsqueda completa** si la IA pierde el contexto


## 📋 Resumen de Mejores Prácticas

### ✅ HACER:

**Para Vuelos:**
- Incluir origen, destino y fechas siempre
- Especificar "ida y vuelta" o "solo ida"
- Mencionar pasajeros solo si son 2 o más
- Agregar preferencias (escalas, aerolínea) solo si son importantes

**Para Hoteles:**
- Incluir destino, check-in y check-out
- Especificar tipo de habitación si es diferente a individual
- Mencionar régimen alimenticio (all inclusive, etc.) si tienes preferencia
- Indicar cadena hotelera solo si la prefieres

**Para Paquetes (Vuelo + Hotel):**
- Incluir origen, destino y fechas completas
- Especificar "con hotel" o "vuelo y hotel"
- Combinar preferencias de vuelo y hotel en el mismo mensaje
- Iterar por separado (cambiar solo vuelo o solo hotel)

**General:**
- Usar lenguaje natural claro
- Dar fechas exactas o rangos claros
- Una búsqueda a la vez

### ❌ EVITAR:
- Búsquedas sin fechas completas
- Asumir que la IA recuerda búsquedas anteriores (repetir si es necesario)
- Mezclar múltiples destinos en un mensaje
- Agregar demasiadas restricciones innecesarias
- Usar jerga excesivamente técnica
- Pedir vuelo y hotel sin especificar fechas de ambos
