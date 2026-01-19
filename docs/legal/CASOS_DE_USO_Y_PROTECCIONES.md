# Casos de Uso Problemáticos y Protecciones para Vibook

Este documento identifica casos de uso específicos que pueden ocurrir y cómo proteger a Vibook mediante términos, condiciones y prácticas operativas.

## 1. CASOS DE USO RELACIONADOS CON INFORMACIÓN DE TERCEROS

### 1.1. Error en Precios de Proveedores

**Caso de Uso:**
- Un cliente recibe una cotización de $500 por un vuelo
- El precio real del proveedor (EUROVIPS/Starling) es $800
- El cliente insiste en el precio cotizado
- La agencia demanda a Vibook por la diferencia

**Protección:**
- **Términos:** Establecer claramente que Vibook es intermediario tecnológico y no responsable por información de terceros
- **Prácticas:**
  - Mostrar disclaimer en cada cotización: "Precios estimados sujetos a confirmación con proveedor"
  - Incluir timestamp de última actualización en cotizaciones
  - Alertar a usuarios sobre verificación necesaria antes de confirmar reservas
  - Implementar sistema de validación de precios antes de generar PDFs

**Texto Recomendado en Términos:**
```
Vibook actúa únicamente como intermediario tecnológico. Los precios mostrados 
son estimaciones basadas en información proporcionada por proveedores externos 
y están sujetos a confirmación. Vibook no garantiza la exactitud de precios 
y no se hace responsable por diferencias entre precios cotizados y finales.
```

### 1.2. Cambio de Disponibilidad después de Cotización

**Caso de Uso:**
- Un cliente recibe cotización de hotel disponible
- Al intentar confirmar, el hotel ya no está disponible
- El cliente pierde tiempo y dinero buscando alternativas
- La agencia culpa a Vibook por información desactualizada

**Protección:**
- **Términos:** Establecer que disponibilidad es en tiempo real y puede cambiar
- **Prácticas:**
  - Mostrar claramente que la disponibilidad es "en el momento de la búsqueda"
  - Implementar sistema de verificación antes de enviar PDFs
  - Alertar sobre necesidad de reconfirmar disponibilidad
  - Incluir disclaimer en PDFs sobre validación necesaria

**Texto Recomendado:**
```
La disponibilidad de servicios mostrada es en tiempo real al momento de la 
búsqueda y puede cambiar sin previo aviso. Se recomienda verificar disponibilidad 
directamente con el proveedor antes de confirmar cualquier reserva.
```

### 1.3. API de Proveedor No Disponible

**Caso de Uso:**
- La API de EUROVIPS está caída durante 24 horas
- Las agencias no pueden realizar búsquedas
- Las agencias pierden clientes y demandan a Vibook por pérdida de ingresos

**Protección:**
- **Términos:** Establecer que Vibook no garantiza disponibilidad de APIs de terceros
- **Prácticas:**
  - Implementar sistema de monitoreo de APIs
  - Notificar a usuarios sobre problemas con APIs
  - Implementar sistema de caché inteligente
  - Mostrar estado de integraciones en dashboard

**Texto Recomendado:**
```
Vibook depende de APIs de proveedores externos. No garantizamos la disponibilidad 
continua de estas APIs y no nos hacemos responsables por interrupciones en 
servicios de terceros o pérdidas derivadas de estas interrupciones.
```

### 1.4. Información Incorrecta de Proveedor

**Caso de Uso:**
- Un proveedor envía información incorrecta sobre un hotel (fotos, descripción, servicios)
- El cliente llega al hotel y no coincide con lo cotizado
- El cliente demanda a la agencia, que demanda a Vibook

**Protección:**
- **Términos:** Establecer que Vibook no valida ni garantiza información de proveedores
- **Prácticas:**
  - Mostrar claramente que la información proviene de proveedores
  - Incluir disclaimer sobre verificación necesaria
  - Implementar sistema de reporte de errores
  - Permitir a agencias reportar información incorrecta

**Texto Recomendado:**
```
La información sobre servicios (descripciones, fotos, servicios incluidos) 
proviene directamente de proveedores externos. Vibook no valida ni garantiza 
la exactitud de esta información. Se recomienda verificar directamente con 
el proveedor antes de confirmar reservas.
```

## 2. CASOS DE USO RELACIONADOS CON PDFs Y COTIZACIONES

### 2.1. Error en Cálculo de Precios en PDF

**Caso de Uso:**
- El sistema genera un PDF con precio incorrecto (error de cálculo)
- El cliente acepta la cotización
- La agencia debe honrar el precio incorrecto
- La agencia demanda a Vibook por el error

**Protección:**
- **Términos:** Establecer que PDFs son estimaciones y deben validarse
- **Prácticas:**
  - Incluir disclaimer en cada PDF: "Esta cotización es una estimación y debe ser validada"
  - Implementar validación de cálculos antes de generar PDFs
  - Permitir revisión manual antes de enviar
  - Implementar sistema de auditoría de cálculos

**Texto Recomendado en PDFs:**
```
IMPORTANTE: Esta cotización es una estimación basada en información disponible 
al momento de generación. Los precios y condiciones están sujetos a confirmación 
y pueden cambiar. Se recomienda verificar todos los detalles antes de confirmar 
cualquier reserva.
```

### 2.2. PDF con Información Desactualizada

**Caso de Uso:**
- Un PDF generado hace 3 días muestra precio de $500
- El precio actual es $700
- El cliente insiste en el precio del PDF
- La agencia demanda a Vibook

**Protección:**
- **Términos:** Establecer que PDFs tienen fecha de validez limitada
- **Prácticas:**
  - Incluir timestamp de generación en cada PDF
  - Mostrar claramente fecha de validez (ej: "Válido por 24 horas")
  - Implementar sistema de renovación de cotizaciones
  - Alertar sobre cotizaciones expiradas

**Texto Recomendado:**
```
Esta cotización fue generada el [FECHA] y es válida por [PERÍODO]. 
Los precios están sujetos a cambios sin previo aviso. Se recomienda 
solicitar una nueva cotización antes de confirmar reservas.
```

### 2.3. Error en Generación de PDF (Datos Faltantes o Incorrectos)

**Caso de Uso:**
- El sistema genera un PDF con información de vuelo incorrecta
- El cliente acepta la cotización
- El vuelo no existe o la información es incorrecta
- La agencia demanda a Vibook por el error

**Protección:**
- **Términos:** Establecer que PDFs deben revisarse antes de enviar
- **Prácticas:**
  - Implementar validación de datos antes de generar PDFs
  - Permitir preview antes de generar PDF final
  - Implementar sistema de verificación de datos
  - Alertar sobre datos faltantes o inconsistentes

**Texto Recomendado:**
```
La agencia es responsable de revisar y validar todas las cotizaciones antes 
de enviarlas a clientes. Vibook no se hace responsable por errores en PDFs 
que no fueron revisados por la agencia antes de su envío.
```

## 3. CASOS DE USO RELACIONADOS CON WHATSAPP Y MENSAJERÍA

### 3.1. Mensaje No Enviado o Perdido

**Caso de Uso:**
- Un cliente envía un mensaje importante por WhatsApp
- El mensaje no llega a la agencia
- El cliente pierde una oportunidad de viaje
- El cliente demanda a la agencia, que demanda a Vibook

**Protección:**
- **Términos:** Establecer que Vibook no garantiza entrega de mensajes
- **Prácticas:**
  - Implementar sistema de confirmación de entrega
  - Monitorear estado de mensajes
  - Alertar sobre problemas con WhatsApp API
  - Implementar sistema de reintentos

**Texto Recomendado:**
```
Vibook integra WhatsApp Business API pero no garantiza la entrega de mensajes. 
Problemas con la API de WhatsApp, conectividad o configuración pueden afectar 
la entrega de mensajes. Vibook no se hace responsable por mensajes no entregados 
o perdidos.
```

### 3.2. Mensaje Enviado a Cliente Incorrecto

**Caso de Uso:**
- El sistema envía un mensaje de cotización a un cliente incorrecto
- El cliente recibe información confidencial de otro cliente
- El cliente demanda por violación de privacidad
- La agencia demanda a Vibook

**Protección:**
- **Términos:** Establecer que la agencia es responsable de validar destinatarios
- **Prácticas:**
  - Implementar confirmación antes de enviar mensajes
  - Mostrar preview del mensaje y destinatario
  - Implementar sistema de verificación de destinatarios
  - Logs de auditoría de mensajes enviados

**Texto Recomendado:**
```
La agencia es responsable de validar que los mensajes se envíen a los 
destinatarios correctos. Vibook proporciona herramientas de verificación pero 
no garantiza la exactitud de destinatarios. La agencia debe revisar antes de enviar.
```

### 3.3. Almacenamiento de Conversaciones sin Consentimiento

**Caso de Uso:**
- Vibook almacena conversaciones de WhatsApp
- Un cliente no dio consentimiento para almacenamiento
- El cliente demanda por violación de privacidad
- La agencia demanda a Vibook

**Protección:**
- **Términos:** Establecer que la agencia es responsable de obtener consentimientos
- **Prácticas:**
  - Documentar que la agencia debe obtener consentimientos
  - Implementar sistema de gestión de consentimientos
  - Permitir eliminación de conversaciones
  - Implementar políticas de retención de datos

**Texto Recomendado:**
```
La agencia es responsable de obtener todos los consentimientos necesarios de 
sus clientes según las leyes aplicables (GDPR, LFPDPPP, etc.). Vibook almacena 
conversaciones para proporcionar el servicio pero la responsabilidad de cumplir 
con regulaciones de privacidad recae en la agencia.
```

## 4. CASOS DE USO RELACIONADOS CON INTELIGENCIA ARTIFICIAL

### 4.1. Recomendación Incorrecta de IA

**Caso de Uso:**
- La IA recomienda un hotel inadecuado para un cliente
- El cliente llega al hotel y no cumple con sus expectativas
- El cliente demanda a la agencia, que demanda a Vibook

**Protección:**
- **Términos:** Establecer que IA es herramienta de asistencia, no reemplazo de juicio humano
- **Prácticas:**
  - Mostrar claramente que las recomendaciones son de IA
  - Requerir revisión humana antes de enviar a clientes
  - Implementar sistema de feedback para mejorar IA
  - Alertar sobre necesidad de validación humana

**Texto Recomendado:**
```
Las recomendaciones generadas por inteligencia artificial son herramientas 
de asistencia y no deben usarse sin revisión humana. La agencia es responsable 
de validar todas las recomendaciones antes de enviarlas a clientes. Vibook 
no se hace responsable por decisiones basadas en recomendaciones de IA sin 
validación humana.
```

### 4.2. Error en Interpretación de Solicitud de Cliente

**Caso de Uso:**
- Un cliente solicita un "hotel familiar" pero la IA interpreta mal
- La IA recomienda hoteles no adecuados para familias
- El cliente insatisfecho demanda a la agencia

**Protección:**
- **Términos:** Establecer limitaciones de IA
- **Prácticas:**
  - Mostrar claramente interpretaciones de IA
  - Permitir corrección manual de interpretaciones
  - Implementar sistema de feedback
  - Alertar sobre necesidad de validación humana

**Texto Recomendado:**
```
La inteligencia artificial puede tener limitaciones en interpretar solicitudes 
complejas o ambiguas. La agencia es responsable de validar que las 
interpretaciones de la IA sean correctas antes de proceder con cotizaciones.
```

## 5. CASOS DE USO RELACIONADOS CON DISPONIBILIDAD DEL SERVICIO

### 5.1. Caída del Servicio durante Horario Pico

**Caso de Uso:**
- El servicio está caído durante 4 horas en horario de mayor demanda
- Las agencias pierden clientes y oportunidades de venta
- Las agencias demandan a Vibook por pérdida de ingresos

**Protección:**
- **Términos:** Establecer que no se garantiza disponibilidad del 100%
- **Prácticas:**
  - Implementar monitoreo continuo
  - Notificar sobre mantenimiento programado
  - Implementar sistema de redundancia
  - Documentar SLA (Service Level Agreement) si aplica

**Texto Recomendado:**
```
Vibook se esfuerza por mantener el servicio disponible pero no garantiza 
disponibilidad del 100%. Puede haber interrupciones por mantenimiento, 
actualizaciones o causas fuera de nuestro control. Vibook no se hace 
responsable por pérdidas derivadas de interrupciones del servicio.
```

### 5.2. Pérdida de Datos durante Actualización

**Caso de Uso:**
- Durante una actualización del sistema, se pierden datos de conversaciones
- Las agencias pierden leads importantes
- Las agencias demandan a Vibook

**Protección:**
- **Términos:** Establecer que se recomienda hacer backups
- **Prácticas:**
  - Implementar sistema de backups automáticos
  - Notificar sobre mantenimiento que puede afectar datos
  - Permitir exportación de datos
  - Implementar sistema de recuperación de datos

**Texto Recomendado:**
```
Vibook implementa sistemas de backup pero recomienda que las agencias mantengan 
sus propios backups de datos críticos. Vibook no se hace responsable por pérdida 
de datos que no fueron respaldados por la agencia.
```

## 6. CASOS DE USO RELACIONADOS CON SEGURIDAD

### 6.1. Brecha de Seguridad y Robo de Datos

**Caso de Uso:**
- Un atacante accede a datos de clientes de agencias
- Los datos se filtran o se utilizan para fraudes
- Los clientes demandan a las agencias, que demandan a Vibook

**Protección:**
- **Términos:** Establecer medidas de seguridad implementadas y limitación de responsabilidad
- **Prácticas:**
  - Implementar medidas de seguridad robustas
  - Encriptación de datos sensibles
  - Monitoreo de seguridad continuo
  - Notificación rápida de brechas
  - Seguro de ciberseguridad (recomendado)

**Texto Recomendado:**
```
Vibook implementa medidas de seguridad técnicas y organizativas robustas 
pero ningún sistema es 100% seguro. Vibook no garantiza seguridad absoluta 
y no se hace responsable por brechas de seguridad que ocurran a pesar de 
medidas razonables de seguridad.
```

### 6.2. Acceso No Autorizado a Cuenta de Agencia

**Caso de Uso:**
- Un empleado anterior de una agencia accede a la cuenta
- El empleado modifica o elimina datos
- La agencia demanda a Vibook por falta de seguridad

**Protección:**
- **Términos:** Establecer que la agencia es responsable de gestionar accesos
- **Prácticas:**
  - Implementar sistema de gestión de usuarios
  - Permitir revocación rápida de accesos
  - Implementar autenticación de dos factores
  - Logs de auditoría de accesos

**Texto Recomendado:**
```
La agencia es responsable de gestionar accesos de usuarios y revocar accesos 
de empleados anteriores. Vibook proporciona herramientas de gestión pero la 
responsabilidad de seguridad de acceso recae en la agencia.
```

## 7. CASOS DE USO RELACIONADOS CON INTEGRACIONES

### 7.1. Cambio en API de Proveedor sin Aviso

**Caso de Uso:**
- Un proveedor cambia su API sin aviso previo
- Las integraciones dejan de funcionar
- Las agencias no pueden realizar búsquedas
- Las agencias demandan a Vibook

**Protección:**
- **Términos:** Establecer que Vibook no controla cambios de APIs de terceros
- **Prácticas:**
  - Monitorear cambios en APIs
  - Notificar sobre problemas con integraciones
  - Implementar sistema de versionado de APIs
  - Trabajar con proveedores para avisos de cambios

**Texto Recomendado:**
```
Vibook no controla cambios en APIs de proveedores externos. Si un proveedor 
cambia su API, las integraciones pueden dejar de funcionar temporalmente. 
Vibook trabajará para restaurar funcionalidad pero no se hace responsable 
por interrupciones causadas por cambios de terceros.
```

### 7.2. Credenciales de Integración Comprometidas

**Caso de Uso:**
- Las credenciales de integración de una agencia se comprometen
- Un atacante realiza búsquedas fraudulentas
- El proveedor cobra a la agencia por uso fraudulento
- La agencia demanda a Vibook

**Protección:**
- **Términos:** Establecer que la agencia es responsable de proteger credenciales
- **Prácticas:**
  - Encriptar credenciales almacenadas
  - Implementar rotación de credenciales
  - Monitorear uso anormal de integraciones
  - Alertar sobre actividad sospechosa

**Texto Recomendado:**
```
La agencia es responsable de proteger sus credenciales de integración. 
Vibook encripta credenciales almacenadas pero la agencia debe mantener 
seguras sus credenciales y notificar inmediatamente cualquier uso no autorizado.
```

## 8. RECOMENDACIONES GENERALES

### 8.1. Implementación de Disclaimers

- **En cada cotización PDF:** Incluir disclaimer sobre validez y necesidad de confirmación
- **En dashboard:** Mostrar alertas sobre verificación necesaria
- **En cada búsqueda:** Mostrar que resultados son estimaciones
- **En integraciones:** Mostrar estado y limitaciones de APIs

### 8.2. Sistema de Logs y Auditoría

- Registrar todas las acciones importantes
- Mantener logs de búsquedas y cotizaciones
- Registrar accesos y modificaciones
- Implementar sistema de trazabilidad

### 8.3. Comunicación Proactiva

- Notificar sobre problemas conocidos
- Alertar sobre cambios importantes
- Comunicar sobre mantenimiento
- Proporcionar actualizaciones regulares

### 8.4. Seguro de Responsabilidad Civil

- Considerar seguro de responsabilidad civil profesional
- Seguro de ciberseguridad
- Seguro de errores y omisiones (E&O)

### 8.5. Documentación Clara

- Documentar todas las limitaciones
- Proporcionar guías de uso
- Documentar casos de uso y limitaciones
- Mantener documentación actualizada

---

**NOTA:** Este documento identifica casos de uso problemáticos comunes. Se recomienda revisión legal profesional para adaptar estos casos a la jurisdicción específica y situación legal de Vibook.










