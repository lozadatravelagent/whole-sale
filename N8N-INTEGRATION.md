# Integración con n8n para Chat del CRM

## Configuración completa para conectar el chat con n8n

### 1. Configuración de Variables de Entorno

En el archivo `.env`:
```env
N8N_WEBHOOK_URL="https://your-n8n-instance.com/webhook/chat-agent"
```

### 2. Estructura del Payload que recibe n8n

El webhook de n8n recibirá este JSON:
```json
{
  "message": "Mensaje del usuario",
  "conversationId": "uuid-de-la-conversación",
  "timestamp": "2024-09-05T20:00:00.000Z",
  "source": "wholesale-connect-chat"
}
```

### 3. Configuración del Workflow en n8n

Tienes dos opciones para integrar con tu workflow existente:

#### Opción A: Agregar Webhook HTTP al workflow existente

1. **Agregar nodo Webhook HTTP** al inicio de tu workflow:
   - **URL**: `/webhook/chat-agent`
   - **Method**: POST
   - **Response Mode**: Wait for Webhook Response
   - **Response Code**: 200

2. **Conectar ambos triggers** a un nodo **Merge** o **Switch**:
   ```
   WhatsApp Trigger ──┐
                      ├── Merge/Switch ── Tu workflow principal
   Webhook HTTP ──────┘
   ```

#### Opción B: Crear workflow separado para Chat Web

Crear un workflow dedicado solo para el chat web del CRM que luego ejecute tu workflow principal.

#### Estructura esperada de respuesta de n8n
Tu workflow debe responder con un JSON en este formato:
```json
{
  "response": "Respuesta del agente de n8n",
  "message": "Respuesta alternativa (fallback)"
}
```

### 4. Ejemplo de Workflow en n8n

#### Para múltiples fuentes (WhatsApp + Chat Web):

```
WhatsApp Trigger ──┐
                   ├── Switch (detectar fuente) ── Procesar mensaje ── Responder
Webhook HTTP ──────┘
```

#### Nodo Switch para detectar fuente:
- **Si viene de WhatsApp**: `{{ $json.messaging_product === 'whatsapp' }}`
- **Si viene de Chat Web**: `{{ $json.source === 'wholesale-connect-chat' }}`

#### Estructura de respuesta:
```json
{
  "response": "{{ $json.agent_response }}"
}
```

#### Ejemplo completo:
```
1. [Webhook HTTP] + [WhatsApp Trigger]
   ↓
2. [Switch - Detectar fuente]
   ↓
3. [Procesar mensaje con tu agente]
   ↓ 
4. [Respond to Webhook] (solo para Chat Web)
   [Send WhatsApp Message] (solo para WhatsApp)
```

### 5. Testing

#### Probar manualmente el webhook:
```bash
curl -X POST "https://your-n8n-instance.com/webhook/chat-agent" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, necesito ayuda con mi viaje",
    "conversationId": "test-123",
    "timestamp": "2024-09-05T20:00:00.000Z",
    "source": "wholesale-connect-chat"
  }'
```

#### Respuesta esperada:
```json
{
  "response": "¡Hola! Te ayudo con tu viaje. ¿A dónde planeas ir?"
}
```

### 6. Despliegue

#### Para desarrollo local:
```bash
supabase functions serve
```

#### Para producción:
```bash
supabase functions deploy travel-chat
```

⚠️ **Importante**: Asegúrate de configurar la variable `N8N_WEBHOOK_URL` en el dashboard de Supabase en Settings > Edge Functions > Environment Variables.

### 7. Manejo de Errores

Si n8n no responde o falla, la función devuelve:
```json
{
  "message": "Lo siento, no pude procesar tu mensaje."
}
```

### 8. Logs para Debugging

Los logs estarán disponibles en:
- Supabase Dashboard > Edge Functions > Logs
- n8n Executions log

---

## Flujo Completo

1. **Usuario** escribe mensaje → **Frontend React**
2. **Frontend** → `supabase.functions.invoke('travel-chat')`
3. **Supabase Edge Function** → POST a webhook n8n
4. **n8n Workflow** procesa con agente → responde JSON
5. **Edge Function** recibe respuesta → devuelve al frontend  
6. **Frontend** muestra respuesta en el chat

El chat seguirá funcionando igual desde la perspectiva del usuario, pero ahora usará tu agente de n8n en lugar de OpenAI directamente.