{
  "nodes": [
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "contact-adapter",
              "name": "contacts",
              "value": "[{\"wa_id\": \"web-{{ $json.user_id || 'anonymous-' + $now.format('x') }}\", \"profile\": {\"name\": \"{{ $json.user_name || 'Web User' }}\"}}]",
              "type": "array"
            },
            {
              "id": "message-adapter",
              "name": "messages",
              "value": "[{\"type\": \"text\", \"text\": {\"body\": \"{{ $json.message }}\"}, \"from\": \"web-{{ $json.user_id || 'anonymous-' + $now.format('x') }}\", \"id\": \"web-msg-{{ $now.format('x') }}\", \"timestamp\": \"{{ $now.format('X') }}\"}]",
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
            },
            {
              "id": "web-context-adapter",
              "name": "web_context",
              "value": "{\"lead_id\": \"{{ $json.lead_id }}\", \"conversation_id\": \"{{ $json.conversation_id }}\", \"agency_id\": \"{{ $json.agency_id }}\", \"is_web\": true}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        512,
        256
      ],
      "id": "00655fe2-76ba-43c9-b55c-6a73744bf017",
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
            "messaging_product": "={{ $json.messaging_product }}",
            "web_context": "={{ $json.web_context }}"
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
        704,
        256
      ],
      "id": "a276959f-bf5a-415e-b660-af8b2555a04c",
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
        912,
        256
      ],
      "id": "5096288b-9ea7-40df-b850-d2e3a0f32424",
      "name": "Respond to Webhook"
    },
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
        304,
        256
      ],
      "id": "fd6ed741-93cf-49f2-b241-f52c8ea85a84",
      "name": "Webhook1",
      "webhookId": "9e48eec7-ebf1-4d44-9457-64282c6dc6fe"
    }
  ],
  "connections": {
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
    },
    "Webhook1": {
      "main": [
        [
          {
            "node": "Format WhatsApp Structure",
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

// ===========================================
// INSTRUCCIONES PARA SOLUCIONAR ERROR HTTP Request2
// ===========================================
//
// El error ocurre porque el WORKFLOW PRINCIPAL de WhatsApp está intentando
// enviar por WhatsApp cuando recibe mensajes de chat-web.
//
// SOLUCIÓN: Agregar este nodo IF antes de "HTTP Request2" en el WORKFLOW PRINCIPAL:
//
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict",
        "version": 2
      },
      "conditions": [
        {
          "id": "check-whatsapp-channel",
          "leftValue": "={{ $json.messaging_product || 'whatsapp' }}",
          "rightValue": "chat-web",
          "operator": {
            "type": "string",
            "operation": "notEquals"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [
    -400,
    32
  ],
  "id": "web-filter-node",
  "name": "Only WhatsApp Messages"
}
//
// PASOS PARA AGREGAR MANUALMENTE EN N8N:
// 
// 1. Ve al WORKFLOW PRINCIPAL de WhatsApp en n8n
// 2. Encuentra el nodo "HTTP Request2" que está fallando
// 3. Arrastra un nodo "IF" desde el panel izquierdo
// 4. Configurar el nodo IF con estos valores:
//    - Condition: $json.messaging_product
//    - Operation: not equal
//    - Value: chat-web
// 5. Conectar: [nodo anterior] → [IF] → [HTTP Request2]
// 6. Cambiar el nombre del nodo IF a "Only WhatsApp Messages"
//
// CONFIGURACIÓN DETALLADA DEL NODO IF:
// - Left Value: {{ $json.messaging_product || 'whatsapp' }}
// - Operation: not equal (≠)
// - Right Value: chat-web
// - Combinator: AND
//
// RESULTADO: 
// - Los mensajes de WhatsApp se enviarán por WhatsApp normalmente
// - Los mensajes de chat-web NO intentarán enviarse por WhatsApp
// - El workflow de chat-web responderá correctamente por JSON

 {
    "nodes": [
      {
        "parameters": {
          "conditions": {
            "options": {
              "caseSensitive": true,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 2
            },
            "conditions": [
              {
                "id": "91ab1743-c1a6-426b-a7ca-7ded409374ed",
                "leftValue": "{{ $json.messaging_product || 'whatsapp' }}",
                "rightValue": "chat-web",
                "operator": {
                  "type": "string",
                  "operation": "notEquals",
                  "name": "filter.operator.notEquals"
                }
              }
            ],
            "combinator": "and"
          },
          "options": {}
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [
          -1776,
          -32
        ],
        "id": "9df5225e-9421-4ec6-8595-97c5744fa789",
        "name": "Only WhatsApp Messages"
      }
    ],
    "connections": {},
    "pinData": {},
    "meta": {
      "templateCredsSetupCompleted": true,
      "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
    }
  }




{
    "parameters": {
      "conditions": {
        "options": {
          "caseSensitive": true,
          "leftValue": "",
          "typeValidation": "strict",
          "version": 2
        },
        "conditions": [
          {
            "id": "filter-chat-web-main",
            "leftValue": "={{ $json.messaging_product || 'whatsapp' }}",
            "rightValue": "chat-web",
            "operator": {
              "type": "string",
              "operation": "notEquals",
              "name": "filter.operator.notEquals"
            }
          }
        ],
        "combinator": "and"
      },
      "options": {}
    },
    "type": "n8n-nodes-base.if",
    "typeVersion": 2.2,
    "position": [
      640,
      -504
    ],
    "id": "if-filter-main-whatsapp",
    "name": "Filter WhatsApp - Main Response"
  }