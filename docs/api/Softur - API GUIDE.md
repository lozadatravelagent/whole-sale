# Guía Completa - API SOFTUR WebService Bridge XML

## Índice
1. [Información General](#información-general)
2. [Flujo Completo de Reserva](#flujo-completo-de-reserva)
3. [Request 1: searchHotelFares](#request-1-searchhotelFares)
4. [Request 2: makeBudget](#request-2-makebudget)
5. [Request 3: convertToBooking](#request-3-converttobooking)
6. [Tipos de Pasajeros](#tipos-de-pasajeros)
7. [Códigos de Ciudad](#códigos-de-ciudad)
8. [Notas Importantes](#notas-importantes)
9. [Ejemplos de Casos Reales](#ejemplos-de-casos-reales)

---

## Información General

### Endpoints
- **Test**: `https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx`
- **Producción**: (Solicitar a SOFTUR)

### Credenciales de Test
- **Usuario**: TESTEO
- **Clave**: TESTEO

### Headers Comunes
Todos los requests requieren estos headers HTTP:
```
Content-Type: text/xml; charset=utf-8
SOAPAction: [nombre_del_método]
```

---

## Flujo Completo de Reserva

El proceso de reserva consta de 3 pasos obligatorios:

```
1. searchHotelFares → Buscar hoteles disponibles y obtener FareId
2. makeBudget       → Crear presupuesto con el FareId
3. convertToBooking → Convertir presupuesto en reserva con datos de pasajeros
```

---

## Request 1: searchHotelFares

### Descripción
Busca hoteles disponibles según criterios de búsqueda (ciudad, fechas, ocupación).

### Request XML

```xml
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <searchHotelFaresRQ1 xmlns="http://www.softur.com.ar/wsbridge/budget.wsdl">
      <cityLocation code="CUN" xmlns="" />
      <dateFrom xmlns="">2025-11-05</dateFrom>
      <dateTo xmlns="">2025-11-30</dateTo>
      <name xmlns="">SANDOS</name>
      <pos xmlns="">
        <id>LOZADAWS</id>
        <clave>.LOZAWS23.</clave>
      </pos>
      <currency xmlns="">USD</currency>
      <OtherBroker xmlns="">true</OtherBroker>
      <FareTypeSelectionList xmlns="http://www.softur.com.ar/wsbridge/budget.xsd">
        <FareTypeSelection OccupancyId="1">1</FareTypeSelection>
        <Ocuppancy OccupancyId="1">
          <Occupants type="ADT" />
          <Occupants type="ADT" />
        </Ocuppancy>
      </FareTypeSelectionList>
    </searchHotelFaresRQ1>
  </soap:Body>
</soap:Envelope>
```

### Headers
```
Content-Type: text/xml; charset=utf-8
SOAPAction: searchHotelFares
```

### Parámetros

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `cityLocation code` | String | Código IATA de ciudad | CUN, AUA, BUE |
| `dateFrom` | Date | Fecha check-in | 2025-11-05 |
| `dateTo` | Date | Fecha check-out | 2025-11-30 |
| `name` | String | Nombre del hotel (opcional) | SANDOS, RIU |
| `currency` | String | Código ISO de moneda | USD, EUR, ARS |
| `OtherBroker` | Boolean | Buscar en brokers externos | true/false |
| `Occupants type` | String | Tipo de pasajero | ADT, CHD, INFOA |

### Response Esperado

```xml
<ArrayOfHotelFare1>
  <HotelFares UniqueId="AP|6880-56773" BackOfficeCode="6880">
    <Name>SANDOS CANCUN ALL INCLUSIVE</Name>
    <FareList currency="USD">
      <Fare type="SGL" FareIdBroker="AP|6880-56773|1|SUI.VL-3|03b3748a-bb24-4dc4-ba97-7c107072bd3c|D">
        <Base>12086.29</Base>
        <Tax type="GRAVADO">507.62</Tax>
      </Fare>
    </FareList>
  </HotelFares>
</ArrayOfHotelFare1>
```

### Datos Importantes del Response
- **UniqueId**: FareId corto (usar en makeBudget)
- **FareIdBroker**: FareId completo con detalles de habitación (usar en makeBudget)
- **Base + Tax**: Total del precio

---

## Request 2: makeBudget

### Descripción
Crea un presupuesto con las tarifas seleccionadas del searchHotelFares.

### Request XML

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" 
xmlns:bud="http://www.softur.com.ar/wsbridge/budget.wsdl" 
xmlns:bud1="http://www.softur.com.ar/wsbridge/budget.xsd">
   <soapenv:Header/>
   <soapenv:Body>
      <bud:BudgetType1>
         <pos>
            <id>LOZADAWS</id>
            <clave>.LOZAWS23.</clave>
         </pos>
         <rq>
            <bud1:HotelBudget ItemId="001">
               <bud1:FareId>AP|6880-56773</bud1:FareId>
               <bud1:InDate>2025-11-05</bud1:InDate>
               <bud1:OutDate>2025-11-30</bud1:OutDate>
               <bud1:SubTotalAmount>0</bud1:SubTotalAmount>
               <bud1:FareTypeSelectionList>
                  <bud1:FareTypeSelection FareIdBroker="AP|6880-56773|1|SUI.VL-3|03b3748a-bb24-4dc4-ba97-7c107072bd3c|D" OccupancyId="1">1</bud1:FareTypeSelection>
                  <bud1:Ocuppancy OccupancyId="1">
                     <bud1:Occupants type="ADT"/>
                     <bud1:Occupants type="ADT"/>
                  </bud1:Ocuppancy>
               </bud1:FareTypeSelectionList>
            </bud1:HotelBudget>
            <bud1:Summary CreationDate="2025-10-09T12:00:00.000Z" StartDate="2025-11-05" User="LOZADAWS" Reference="Mi Referencia" Status="0" Agent="20350" Currency="USD"/>
            <bud1:ExtraInfoList>
               <bud1:ExtendedData type="PRESUPU">
                  <bud1:Name>cod_agcia</bud1:Name>
                  <bud1:Value>20350</bud1:Value>
               </bud1:ExtendedData>
               <bud1:ExtendedData type="PRESUPU">
                  <bud1:Name>cod_vdor</bud1:Name>
                  <bud1:Value>1537</bud1:Value>
               </bud1:ExtendedData>
               <bud1:ExtendedData type="PRESUPU">
                  <bud1:Name>idcontacto</bud1:Name>
                  <bud1:Value>22773</bud1:Value>
               </bud1:ExtendedData>
            </bud1:ExtraInfoList>
         </rq>
      </bud:BudgetType1>
   </soapenv:Body>
</soapenv:Envelope>
```

### Headers
```
Content-Type: text/xml; charset=utf-8
SOAPAction: makeBudget
```

### Parámetros

| Campo | Tipo | Descripción | Valor |
|-------|------|-------------|-------|
| `FareId` | String | ID corto del hotel | AP\|6880-56773 |
| `FareIdBroker` | String | ID completo de tarifa | Del searchHotelFares |
| `SubTotalAmount` | Decimal | Monto total | 0 (calcula automático) |
| `OccupancyId` | Int | ID de ocupación | 1, 2, 3... |
| `ItemId` | String | ID del item | 001, 002, 003... |
| `Reference` | String | Referencia libre | Texto descriptivo |
| `Agent` | String | Código de agencia | 20350 |
| `type` | String | Tipo de info extra | PRESUPU |

### Response Esperado

```xml
<BudgetType2>
  <resultado>
    <codigo>0</codigo>
    <texto/>
  </resultado>
  <rs UniqueId="40681217">
    <HotelBudget ItemId="001">
      <FareId>EV40423822</FareId>
      <SubTotalAmount>12086.29</SubTotalAmount>
    </HotelBudget>
  </rs>
</BudgetType2>
```

### Datos Importantes del Response
- **UniqueId**: ID del presupuesto (usar en convertToBooking)
- **codigo=0**: Éxito
- **SubTotalAmount**: Monto calculado por el sistema

---

## Request 3: convertToBooking

### Descripción
Convierte el presupuesto en una reserva confirmada, agregando los datos de los pasajeros.

### Request XML

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:bud="http://www.softur.com.ar/wsbridge/budget.wsdl" xmlns:book="http://www.softur.com.ar/wsbridge/booking.xsd" xmlns:bud1="http://www.softur.com.ar/wsbridge/budget.xsd">
   <soapenv:Header/>
   <soapenv:Body>
      <bud:CvtBookingRQ>
         <pos>
            <id>LOZADAWS</id>
            <clave>.LOZAWS23.</clave>
         </pos>
         <rq>
            <idBudget>40681217</idBudget>
            <paxList>
               <pax>
                  <book:ServiceRef>
                     <book:ItemBooking OccupancyId="1" RoomId="1">001</book:ItemBooking>
                  </book:ServiceRef>
                  <book:Id>1</book:Id>
                  <book:LastName>MARTINEZ</book:LastName>
                  <book:FirstName>CARLOS</book:FirstName>
                  <book:Address>-</book:Address>
                  <book:Nationality>ARG</book:Nationality>
                  <book:DocType>PAS</book:DocType>
                  <book:DocNumber>AAA123456</book:DocNumber>
                  <book:Sex>M</book:Sex>
                  <book:BirthDate>1980-05-15</book:BirthDate>
                  <book:PassportExpiration>2028-12-31</book:PassportExpiration>
                  <book:DateFrom>2025-10-08</book:DateFrom>
                  <book:PassengerType>ADT</book:PassengerType>
                  <book:Attributes>
                     <book:Code>TEPA</book:Code>
                     <book:Value>+54 9 1122334455</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>EMAI</book:Code>
                     <book:Value>test@test.com</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>LANG</book:Code>
                     <book:Value>ES</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>DNIA</book:Code>
                     <book:Value>AAA123456</book:Value>
                  </book:Attributes>
               </pax>
               <pax>
                  <book:ServiceRef>
                     <book:ItemBooking OccupancyId="1" RoomId="1">001</book:ItemBooking>
                  </book:ServiceRef>
                  <book:Id>2</book:Id>
                  <book:LastName>MARTINEZ</book:LastName>
                  <book:FirstName>LAURA</book:FirstName>
                  <book:Address>-</book:Address>
                  <book:Nationality>ARG</book:Nationality>
                  <book:DocType>PAS</book:DocType>
                  <book:DocNumber>BBB654321</book:DocNumber>
                  <book:Sex>F</book:Sex>
                  <book:BirthDate>1983-08-22</book:BirthDate>
                  <book:PassportExpiration>2028-12-31</book:PassportExpiration>
                  <book:DateFrom>2025-10-08</book:DateFrom>
                  <book:PassengerType>ADT</book:PassengerType>
                  <book:Attributes>
                     <book:Code>TEPA</book:Code>
                     <book:Value>+54 9 1122334455</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>EMAI</book:Code>
                     <book:Value>test@test.com</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>LANG</book:Code>
                     <book:Value>ES</book:Value>
                  </book:Attributes>
                  <book:Attributes>
                     <book:Code>DNIA</book:Code>
                     <book:Value>BBB654321</book:Value>
                  </book:Attributes>
               </pax>
            </paxList>
            <ExtraInfoList>
               <bud1:ExtendedData type="RESERVA">
                  <bud1:Name>cod_agcia</bud1:Name>
                  <bud1:Value>20350</bud1:Value>
               </bud1:ExtendedData>
               <bud1:ExtendedData type="RESERVA">
                  <bud1:Name>cod_vdor</bud1:Name>
                  <bud1:Value>1537</bud1:Value>
               </bud1:ExtendedData>
               <bud1:ExtendedData type="RESERVA">
                  <bud1:Name>idcontacto</bud1:Name>
                  <bud1:Value>22773</bud1:Value>
               </bud1:ExtendedData>
            </ExtraInfoList>
         </rq>
      </bud:CvtBookingRQ>
   </soapenv:Body>
</soapenv:Envelope>
```

### Headers
```
Content-Type: text/xml; charset=utf-8
SOAPAction: convertToBooking
```

### Parámetros

| Campo | Tipo | Descripción | Valor |
|-------|------|-------------|-------|
| `idBudget` | String | ID del presupuesto | Del makeBudget |
| `book:Id` | Int | ID secuencial pasajero | 1, 2, 3... |
| `ItemBooking` | String | ID del item | 001, 002, 003... |
| `OccupancyId` | Int | ID de ocupación | 1, 2, 3... |
| `RoomId` | Int | Número de habitación | 1, 2, 3... |
| `LastName` | String | Apellido | MARTINEZ |
| `FirstName` | String | Nombre | CARLOS |
| `Sex` | String | Sexo | M / F |
| `DocType` | String | Tipo de documento | PAS, DNI |
| `PassengerType` | String | Tipo de pasajero | ADT, CHD, INF |
| `Nationality` | String | Código ISO país | ARG, USA, ESP |

### Attributes (Códigos)

| Código | Descripción | Ejemplo |
|--------|-------------|---------|
| TEPA | Teléfono particular | +54 9 1122334455 |
| EMAI | Email | test@test.com |
| LANG | Idioma | ES, EN, PT |
| DNIA | Documento | AAA123456 |

### Response Esperado

```xml
<CvtBookingRS>
  <resultado>
    <codigo>0</codigo>
    <texto/>
  </resultado>
  <rs UniqueId="45225905"/>
</CvtBookingRS>
```

### Datos Importantes del Response
- **UniqueId**: ID de la reserva confirmada
- **codigo=0**: Reserva exitosa

---

## Tipos de Pasajeros

| Código | Descripción | Edad |
|--------|-------------|------|
| **ADT** | Adulto | > 12 años |
| **CHD** | Niño (child) | 2-11 años |
| **CNN** | Child non-infant | 2-11 años |
| **INF** | Infante sin asiento | < 2 años |
| **INFOA** | Infante con asiento | < 2 años |

### Ejemplo con Menores

```xml
<bud1:Occupants type="ADT"/>
<bud1:Occupants type="ADT"/>
<bud1:Occupants type="CHD" Age="5"/>
<bud1:Occupants type="INFOA" Age="1"/>
```

---

## Códigos de Ciudad

### Principales Destinos

| Código | Ciudad | País |
|--------|--------|------|
| **CUN** | Cancún | México |
| **AUA** | Aruba | Aruba |
| **BUE** | Buenos Aires | Argentina |
| **MIA** | Miami | USA |
| **MEX** | Ciudad de México | México |
| **MAD** | Madrid | España |
| **ROM** | Roma | Italia |
| **PCM** | Playa del Carmen | México |
| **PDC** | Playa del Carmen | México |

Para obtener el listado completo, usar el método `getCountryList`.

---

## Notas Importantes

### ⚠️ Puntos Críticos

1. **Namespaces**: 
   - En `makeBudget` usar: `bud1:` (budget.xsd)
   - En `convertToBooking` usar: `book:` (booking.xsd) ← **CRÍTICO**

2. **ExtraInfoList type**:
   - En `makeBudget`: `type="PRESUPU"`
   - En `convertToBooking`: `type="RESERVA"` ← **CRÍTICO**

3. **FareId vs FareIdBroker**:
   - `FareId`: Versión corta (ej: AP|6880-56773)
   - `FareIdBroker`: Versión completa con detalles de habitación

4. **SubTotalAmount**: Siempre usar `0` en makeBudget, el sistema calcula automáticamente

5. **OtherBroker**:
   - `true`: Busca en brokers externos (GTA, Hotelbeds, etc.)
   - `false`: Solo busca en backoffice propio

6. **Cantidad de Pasajeros**: Debe coincidir exactamente con la ocupación del presupuesto

### 🔍 Búsqueda por Nombre de Hotel

Según la documentación, el campo `name` permite:
- **Búsqueda por cadena**: "Iberostar" trae todos los hoteles de esa cadena
- **Búsqueda parcial**: "Ocean" trae hoteles que contengan esa palabra
- **Vacío**: Trae todos los hoteles del destino

### 📅 Formato de Fechas

Todas las fechas deben estar en formato ISO: `YYYY-MM-DD`

Ejemplos:
- `2025-11-05`
- `2025-12-31`

---

## Ejemplos de Casos Reales

### Caso 1: Familia con Niños

**Búsqueda**: 2 adultos + 1 niño (5 años) + 1 infante (1 año)

```xml
<Ocuppancy OccupancyId="1">
  <Occupants type="ADT" />
  <Occupants type="ADT" />
  <Occupants type="CHD" Age="5"/>
  <Occupants type="INFOA" Age="1"/>
</Ocuppancy>
```

### Caso 2: Múltiples Habitaciones

**Búsqueda**: 1 habitación doble + 1 habitación triple

```xml
<FareTypeSelection OccupancyId="1">1</FareTypeSelection>
<FareTypeSelection OccupancyId="2">1</FareTypeSelection>
<Ocuppancy OccupancyId="1">
  <Occupants type="ADT" />
  <Occupants type="ADT" />
</Ocuppancy>
<Ocuppancy OccupancyId="2">
  <Occupants type="ADT" />
  <Occupants type="ADT" />
  <Occupants type="ADT" />
</Ocuppancy>
```

En este caso, crear **dos items separados** en el makeBudget:
- ItemId="001" para la habitación doble
- ItemId="002" para la habitación triple

### Caso 3: Solo Backoffice (Sin Brokers)

```xml
<OtherBroker xmlns="">false</OtherBroker>
```

### Caso 4: Buscar Cadena Específica

```xml
<name xmlns="">RIU</name>
```

Traerá todos los hoteles RIU en el destino seleccionado.

---

## Códigos de Error Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| 0 | Éxito | - |
| 666 | No se encontró nominación de pasajero | Verificar namespace `book:` en convertToBooking |
| 500 | Error de servidor | Verificar estructura XML |
| - | GetHotelAvail es null | No hay disponibilidad para ese hotel/fecha |

---

## Flujo de Trabajo Recomendado

```
1. searchHotelFares
   ├─ Obtener: FareId y FareIdBroker
   └─ Guardar: Base + Tax para mostrar precio
   
2. makeBudget
   ├─ Usar: FareId (corto) y FareIdBroker (completo)
   ├─ Obtener: UniqueId del presupuesto
   └─ Guardar: SubTotalAmount calculado
   
3. convertToBooking
   ├─ Usar: UniqueId del presupuesto
   ├─ Agregar: Datos completos de pasajeros
   ├─ Obtener: UniqueId de la reserva
   └─ ¡Reserva confirmada!
```

---

## Contacto Soporte

Para solicitar credenciales de producción o resolver dudas técnicas:

**SOFTUR S.A.**
- Sitio web: www.softur.com.ar
- Documentación: Solicitar a soporte

---

## Changelog

- **v1.0** (2025-10-09): Documentación inicial con ejemplos completos
- Incluye casos reales de certificación exitosa en ambiente de test

---

**Desarrollado con ❤️ para la integración con SOFTUR WebService Bridge XML**