# Workflow n8n para Chat Web - Configuración Completa

## Estructura del Workflow

```
[Webhook] → [Execute Main Workflow] → [Respond to Webhook]
```

## Configuración de Nodos

### 1. Webhook (Trigger)
```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "agent",
    "responseMode": "responseNode",
    "options": {}
  },
  "type": "n8n-nodes-base.webhook",
  "name": "Webhook"
}
```
- **URL resultante**: `https://tu-n8n.com/webhook/agent`
- **Método**: POST
- **Response Mode**: Response Node (importante para devolver respuesta al chat)

### 2. Execute Main Workflow
```json
{
  "parameters": {
    "workflowId": "r7VnDvkzOdpdjW35",
    "workflowInputs": {
      "mappingMode": "defineBelow",
      "value": {
        "message": "={{ $json.message }}",
        "source": "chat-web",
        "conversationId": "={{ $json.conversationId }}",
        "timestamp": "={{ $json.timestamp }}",
        "from": "web-chat-user"
      }
    }
  },
  "type": "n8n-nodes-base.executeWorkflow",
  "name": "Execute Main Workflow"
}
```
- **Workflow ID**: Tu workflow principal existente
- **Input mapping**: Convierte el payload del chat web al formato que espera tu agente

### 3. Respond to Webhook
```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": {
      "response": "={{ $json.response || $json.message || 'Lo siento, no pude procesar tu mensaje.' }}"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.respondToWebhook",
  "name": "Respond to Webhook"
}
```
- **Response Type**: JSON
- **Body**: Extrae la respuesta de tu agente principal

## Conexiones entre Nodos

```json
{
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Execute Main Workflow",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Execute Main Workflow": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Payload que recibe el Webhook

```json
{
  "message": "Mensaje del usuario",
  "conversationId": "uuid-conversacion",
  "timestamp": "2024-09-05T20:00:00.000Z",
  "source": "wholesale-connect-chat"
}
```

## Transformación de datos

### Input al workflow principal:
```json
{
  "message": "Mensaje del usuario",
  "source": "chat-web",
  "conversationId": "uuid-conversacion", 
  "from": "web-chat-user"
}
```

### Output esperado del workflow principal:
```json
{
  "response": "Respuesta del agente",
  "message": "Mensaje alternativo" // fallback
}
```

## Testing del Workflow

### 1. Test manual con curl:
```bash
curl -X POST "https://tu-n8n.com/webhook/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, quiero viajar a París en marzo",
    "conversationId": "test-conv-123",
    "timestamp": "2024-09-05T20:00:00.000Z",
    "source": "wholesale-connect-chat"
  }'
```

### 2. Respuesta esperada:
```json
{
  "response": "¡Hola! París en marzo es una excelente elección..."
}
```

### 3. Testing desde el chat:
- Ir a tu aplicación CRM
- Crear nuevo chat
- Escribir mensaje
- Verificar que aparece la respuesta del agente

## Configuración en tu aplicación

### Actualizar .env:
```env
N8N_WEBHOOK_URL="https://tu-n8n-instance.com/webhook/agent"
```

### Deploy de la función de Supabase:
```bash
supabase functions deploy travel-chat
```

## Troubleshooting

### Si no llegan mensajes:
1. Verificar que la URL del webhook sea correcta
2. Comprobar logs en n8n: Executions > Ver ejecución fallida
3. Verificar variables de entorno en Supabase

### Si no se ejecuta el workflow principal:
1. Verificar que el Workflow ID sea correcto
2. Comprobar el mapping de inputs
3. Verificar permisos del workflow

### Si no responde al chat:
1. Verificar que "responseMode": "responseNode" esté configurado
2. Comprobar que el nodo "Respond to Webhook" esté conectado
3. Verificar el formato del response body

---

¡Con esta configuración tu chat web enviará mensajes a n8n y recibirás respuestas de tu agente directamente en el frontend!