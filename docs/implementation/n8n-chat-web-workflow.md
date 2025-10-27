# Snippet n8n – Rama `chat-web`

Copia **solo** el bloque JSON y pégalo en la vista de código de n8n ("Import Nodes") o en un editor de texto cuando tengas el workflow abierto.  Esto añadirá:

1. Un nodo **IF** que verifica si `messaging_product` es `whatsapp`.
2. Un nodo **Set** que genera la respuesta para web cuando `messaging_product` **no** es `whatsapp`.

Ajusta los UUID o nombres de nodos según tus necesidades.

```json
{
  "nodes": [
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.messaging_product }}",
              "value2": "whatsapp",
              "operation": "equal"
            }
          ]
        }
      },
      "id": "if-chat-web-check",
      "name": "IF messaging_product",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.1,
      "position": [
        0,
        0
      ]
    },
    {
      "parameters": {
        "values": {
          "string": [
            {
              "name": "response",
              "value": "={\n  \"type\": \"options\",\n  \"text\": \"¿Qué te gustaría hacer?\\n\\n1️⃣ Reservar\\n2️⃣ Actualizar precio\",\n  \"buttons\": [\n    { \"id\": \"Booking\", \"title\": \"Reservar\" },\n    { \"id\": \"priceUpdate\", \"title\": \"Actualizar precio\" }\n  ]\n}"
            }
          ]
        },
        "options": {
          "dotNotation": true
        },
        "keepOnlySet": false
      },
      "id": "set-chat-web-response",
      "name": "Send Options (chat-web)",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.1,
      "position": [
        300,
        200
      ]
    }
  ],
  "connections": {
    "IF messaging_product": {
      "main": [
        [
          {
            "node": "HTTP Request2",   // rama verdadera (WhatsApp)
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Send Options (chat-web)",   // rama falsa (chat web)
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

**Uso**
1. Coloca el nodo **IF** antes de cualquier llamada a WhatsApp.
2. Conecta la salida **verdadera** (`true`) al nodo existente "HTTP Request2".
3. Conecta la salida **falsa** (`false`) al nodo **Set** que acabas de crear.
4. Desde **Set**, sigue al nodo que responde al Webhook (o termina el workflow).
