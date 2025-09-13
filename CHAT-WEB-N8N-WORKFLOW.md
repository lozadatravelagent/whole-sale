# Workflow n8n para Chat Web - Execute Main Workflow

## Configuración del Workflow

Este workflow **reutiliza tu agente existente de WhatsApp** llamando al workflow principal. Copia y pega este JSON completo en n8n:

```json
{
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "agent",
        "responseMode": "responseNode",
        "options": {}
      },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [
        0,
        0
      ],
      "id": "5a89d732-7d12-4f88-9199-1ba3482564d3",
      "name": "Webhook",
      "webhookId": "9e48eec7-ebf1-4d44-9457-64282c6dc6fe"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "contact-adapter",
              "name": "contacts",
              "value": "[{\"wa_id\": \"chat-web-user\", \"profile\": {\"name\": \"Web User\"}}]",
              "type": "array"
            },
            {
              "id": "message-adapter", 
              "name": "messages",
              "value": "[{\"type\": \"text\", \"text\": {\"body\": \"{{ $json.message }}\"}, \"from\": \"chat-web-user\", \"id\": \"web-msg-{{ $now.format('x') }}\", \"timestamp\": \"{{ $now.format('X') }}\"}]",
              "type": "array"
            },
            {
              "id": "field-adapter",
              "name": "field",
              "value": "messages",
              "type": "string"
            },
            {
              "id": "messaging-product-adapter",
              "name": "messaging_product",
              "value": "chat-web",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        200,
        0
      ],
      "id": "format-whatsapp-structure",
      "name": "Format WhatsApp Structure"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "r7VnDvkzOdpdjW35",
          "mode": "list",
          "cachedResultName": "Main Workflow"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "contacts": "={{ $json.contacts }}",
            "messages": "={{ $json.messages }}",
            "field": "={{ $json.field }}",
            "messaging_product": "={{ $json.messaging_product }}"
          },
          "matchingColumns": [],
          "schema": [],
          "attemptToConvertTypes": false,
          "convertFieldsToString": true
        },
        "options": {}
      },
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.2,
      "position": [
        400,
        0
      ],
      "id": "execute-main-workflow",
      "name": "Execute Main Workflow"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": {
          "response": "={{ $json.output || $json.message || 'Lo siento, no pude procesar tu mensaje.' }}"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [
        600,
        0
      ],
      "id": "webhook-response",
      "name": "Respond to Webhook"
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Format WhatsApp Structure",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Format WhatsApp Structure": {
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
  },
  "pinData": {},
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}
```

## Instrucciones de Configuración

### 1. Importar el Workflow
1. Ve a n8n
2. Crea un nuevo workflow
3. Copia el JSON completo de arriba
4. Pega en la vista de código/JSON de n8n
5. Guarda el workflow

### 2. Configurar Execute Main Workflow
- **Workflow ID**: Verifica que sea `r7VnDvkzOdpdjW35` (tu workflow principal de WhatsApp)
- **Si el ID es diferente**: Cambia el valor en el nodo "Execute Main Workflow"

### 3. Activar el Workflow
- Activa el workflow para que el webhook esté disponible
- La URL será: `https://tu-n8n-instance.com/webhook/agent`

### 4. Actualizar .env
```env
N8N_WEBHOOK_URL="https://tu-n8n-instance.com/webhook/agent"
```

### 5. Deploy Supabase Function
```bash
supabase functions deploy travel-chat
```

## Cómo Funciona

Este workflow convierte los mensajes del chat web al formato que espera tu workflow principal de WhatsApp:

### **Transformación de datos:**
```json
// Input del chat web:
{
  "message": "Hola, quiero viajar a París",
  "conversationId": "test-123",
  "source": "wholesale-connect-chat"
}

// Se transforma a formato WhatsApp:
{
  "contacts": [{"wa_id": "chat-web-user", "profile": {"name": "Web User"}}],
  "messages": [{
    "type": "text", 
    "text": {"body": "Hola, quiero viajar a París"},
    "from": "chat-web-user"
  }],
  "messaging_product": "chat-web"
}
```

## Flujo del Workflow

```
[Chat Web] → [Webhook] → [Format WhatsApp Structure] → [Execute Main Workflow] → [Respond]
                                                              ↓
                                                    [Tu AI Agent completo]
                                                    [+ todas las funciones]  
```

## Ventajas de esta solución

✅ **Reutiliza tu agente existente** - Mismo comportamiento que WhatsApp
✅ **Sin duplicación** - Un solo agente para mantener  
✅ **Consistente** - Mismas respuestas en ambos canales
✅ **Fácil mantenimiento** - Cambios solo en un lugar

## Testing

Probar con curl:
```bash
curl -X POST "https://tu-n8n-instance.com/webhook/agent" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, quiero viajar a París",
    "conversationId": "test-123",
    "timestamp": "2024-09-05T20:00:00.000Z",
    "source": "wholesale-connect-chat"
  }'
```

Respuesta esperada:
```json
{
  "response": "¡Hola! París es una excelente elección para viajar..."
}
```

---

¡Ahora tu chat web usará exactamente el mismo agente inteligente que tu WhatsApp!