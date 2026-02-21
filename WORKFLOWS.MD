WORKFLOW CRÍTICO #1
Construcción automática de paquete (desde cero)
Una agencia entra al mayorista y:

pide destino
fechas
pasajeros
preferencias
Emilia debe:

Consultar vuelos
Consultar hoteles
Consultar traslados
Combinar coherentemente
Validar fechas cruzadas
Validar disponibilidad
Calcular precio total
Generar paquete descargable


Puntos críticos para que sea seguro:

 Validación cruzada de fechas (check-in vs llegada vuelo)
 Validación de disponibilidad antes de mostrar total
 Timestamp visible
 Fuente clara de cada componente
 Control de error si un componente falla
Si arma paquete incoherente → pierde credibilidad instantánea.

 WORKFLOW CRÍTICO #2
Re-cotización automática desde PDF (esto es diferencial real)
La agencia:
• dropea PDF de otra cotización
• Emilia lo parsea
• extrae:
rutas
fechas
hoteles
categorías
régimen
• busca equivalentes
• devuelve nueva propuesta optimizada

Puntos cruciales de seguridad:

 Parsing robusto (evitar errores de interpretación)
 Confirmación visual de datos detectados
 No asumir datos ambiguos
 Mostrar diferencias vs original
 Control de equivalencias (hotel similar ≠ hotel igual)
Si el parsing es impreciso → se vuelve peligroso.
Pero si es sólido, esto es una máquina de conversión.

 WORKFLOW CRÍTICO #3
Normalización de precios y márgenes
Cuando Emilia arma o re-arma:
Debe:

sumar correctamente impuestos
aplicar markup configurado
respetar reglas del mayorista
mostrar precio final coherente


Seguridad financiera:

 Validación automática de margen mínimo
 No permitir precio negativo o mal calculado
 Confirmación visual de desglose
 Consistencia entre total y suma de componentes
Un error acá mata confianza.

 WORKFLOW CRÍTICO #4
Generación de documento descargable coherente
El PDF es parte del producto.
Debe:

ser claro
estructurado
sin contradicciones
con condiciones bien definidas
con disclaimer de disponibilidad


Seguridad clave:

 Condiciones visibles
 No mostrar confirmación si no existe
 Información alineada con lo cotizado
 Diseño consistente (no improvisado)
El PDF es la cara visible de la tecnología.

 Donde está el verdadero valor estratégico
No está en:

“armar paquete en segundos” (eso otros pueden hacerlo)
“tener IA”
Está en esto:
Emilia convierte información desordenada en paquete vendible sin intervención manual.