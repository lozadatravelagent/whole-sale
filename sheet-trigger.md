{
  "nodes": [
    {
      "parameters": {
        "pollTimes": {
          "item": [
            {
              "mode": "everyMinute"
            }
          ]
        },
        "documentId": {
          "__rl": true,
          "value": "1IOk3kNc94oB-_31aBjXv02tBxsycWIVxRhvM9ufOlX0",
          "mode": "list",
          "cachedResultName": "Web Travel Booking Data",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1IOk3kNc94oB-_31aBjXv02tBxsycWIVxRhvM9ufOlX0/edit?usp=drivesdk"
        },
        "sheetName": {
          "__rl": true,
          "value": "gid=0",
          "mode": "list",
          "cachedResultName": "Flights",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1IOk3kNc94oB-_31aBjXv02tBxsycWIVxRhvM9ufOlX0/edit#gid=0"
        },
        "event": "rowAdded",
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTrigger",
      "typeVersion": 1,
      "position": [
        -1088,
        352
      ],
      "id": "0e1bf492-8e20-4397-9320-5fe17970bf13",
      "name": "Google Sheets Trigger",
      "credentials": {
        "googleSheetsTriggerOAuth2Api": {
          "id": "fzq91dEUthfg7HcC",
          "name": "Google Sheets Trigger account"
        }
      }
    },
    {
      "parameters": {
        "keep": "lastItems"
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        -864,
        352
      ],
      "id": "622d87c2-edda-4744-9567-d5351ef3542d",
      "name": "Booking Data"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "UwCau8Gf9rt8RElC",
          "mode": "list",
          "cachedResultName": "Flight Scrapper + API"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "BookingData": "={{ $('Booking Data').all().toJsonString().parseJson().first() }}"
          },
          "matchingColumns": [
            "BookingData"
          ],
          "schema": [
            {
              "id": "BookingData",
              "displayName": "BookingData",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "object",
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": true
        },
        "options": {}
      },
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.2,
      "position": [
        -640,
        352
      ],
      "id": "e85696d1-dd22-4669-826e-15a35941326a",
      "name": "Execute Workflow1",
      "executeOnce": true,
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "=\"{{ $('Booking Data').item.json.Contact_Id }}\"",
        "textBody": "=❌ No se encontraron vuelos.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        32,
        448
      ],
      "id": "10f7bb4f-644a-4778-90b5-d8dc50cc6383",
      "name": "WhatsApp Business Cloud1",
      "webhookId": "ea7c9701-6ad1-4144-b5b1-cb6bbc368517",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "YfuisHzlYACNZG7J",
          "mode": "list",
          "cachedResultName": "Send Options - VIA WEB"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Flights": "={{ $json.Flights }}",
            "Booking Data": "={{ $('Booking Data').item.json }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Flights",
              "displayName": "Flights",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "array"
            },
            {
              "id": "Hotels",
              "displayName": "Hotels",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "array",
              "removed": true
            },
            {
              "id": "Booking Data",
              "displayName": "Booking Data",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "object"
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": true
        },
        "options": {}
      },
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.2,
      "position": [
        48,
        128
      ],
      "id": "9805b10a-8146-48a3-b88b-8893967c6b2e",
      "name": "Execute Workflow2"
    },
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
              "id": "31f9a23d-576a-40c2-aa5c-bc7b7886793e",
              "leftValue": "={{ $json.Flights }}",
              "rightValue": "",
              "operator": {
                "type": "array",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "e984e99f-6f3f-42ff-bf8f-9f65fe0e449c",
              "leftValue": "={{ $json.Flights[0] }}",
              "rightValue": "",
              "operator": {
                "type": "object",
                "operation": "notEmpty",
                "singleValue": true
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
        -192,
        352
      ],
      "id": "1e82ced9-fc4f-4a7d-95e4-5a74c7d16d71",
      "name": "If2"
    },
    {
      "parameters": {
        "operation": "append",
        "documentId": {
          "__rl": true,
          "value": "1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q",
          "mode": "list",
          "cachedResultName": "Travel Booking Data",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit?usp=drivesdk"
        },
        "sheetName": {
          "__rl": true,
          "value": 777548340,
          "mode": "list",
          "cachedResultName": "Error",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=777548340"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Name": "={{ $('Booking Data').item.json.Name }}",
            "Phone": "={{ $('Booking Data').item.json.Phone }}",
            "Contact_Id": "={{ $('Booking Data').item.json.Contact_Id }}",
            "Travel_Type": "={{ $('Booking Data').item.json.Travel_Type }}",
            "Origin": "={{ $('Booking Data').item.json.Origin }}",
            "Destination": "={{ $('Booking Data').item.json.Destination }}",
            "Departure_date": "={{ $('Booking Data').item.json.Departure_date }}",
            "Check_In_Date": "={{ $('Booking Data').item.json.Check_In_Date }}",
            "Return_date": "={{ $('Booking Data').item.json.Return_date }}",
            "Check_Out_Date": "={{ $('Booking Data').item.json.Check_Out_Date }}",
            "Num_Adults": "={{ $('Booking Data').item.json.Num_Adults }}",
            "Num_Children": "={{ $('Booking Data').item.json.Num_Children }}",
            "Childrens_Ages": "={{ $('Booking Data').item.json.Childrens_Ages }}",
            "Stopovers": "={{ $('Booking Data').item.json.Stopovers }}",
            "Luggage": "={{ $('Booking Data').item.json.Luggage }}",
            "Airlines": "={{ $('Booking Data').item.json.Airlines }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Name",
              "displayName": "Name",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Phone",
              "displayName": "Phone",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Contact_Id",
              "displayName": "Contact_Id",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Time_Stamp",
              "displayName": "Time_Stamp",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Travel_Type",
              "displayName": "Travel_Type",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Origin",
              "displayName": "Origin",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Destination",
              "displayName": "Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Departure_date",
              "displayName": "Departure_date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Return_date",
              "displayName": "Return_date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Num_Adults",
              "displayName": "Num_Adults",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Num_Children",
              "displayName": "Num_Children",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Childrens_Ages",
              "displayName": "Childrens_Ages",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Stopovers",
              "displayName": "Stopovers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Luggage",
              "displayName": "Luggage",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            },
            {
              "id": "Airlines",
              "displayName": "Airlines",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        256,
        448
      ],
      "id": "f1252d25-a577-4108-82ec-744ed7f4068d",
      "name": "Google Sheets2",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "operation": "delete",
        "documentId": {
          "__rl": true,
          "value": "1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q",
          "mode": "list",
          "cachedResultName": "Travel Booking Data",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit?usp=drivesdk"
        },
        "sheetName": {
          "__rl": true,
          "value": "gid=0",
          "mode": "list",
          "cachedResultName": "All",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=0"
        },
        "startIndex": 3
      },
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        480,
        448
      ],
      "id": "4abafd25-0d47-459a-a439-d8df5aed6d77",
      "name": "Google Sheets3",
      "executeOnce": true,
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "content": "Conserva solo la última entrada de reserva para su procesamiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -896,
        208
      ],
      "typeVersion": 1,
      "id": "55cfbb0e-c32b-4ea4-a249-f99f761aae13",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Llama al workflow “Flight Scrapper API” para buscar vuelos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -672,
        208
      ],
      "typeVersion": 1,
      "id": "9bee2a7f-137a-441e-aa99-b16b208cf61c",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Verifica si se encontraron vuelos y están disponibles.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -224,
        208
      ],
      "typeVersion": 1,
      "id": "99d19617-170e-4a5d-98af-8137856fe7d3",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Envía las opciones de vuelo al cliente vía el workflow “Send Options”.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        0,
        0
      ],
      "typeVersion": 1,
      "id": "72cca4eb-95d2-407f-9883-71fbc38bac8a",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Envía un mensaje de “no se encontraron vuelos” vía WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        0,
        304
      ],
      "typeVersion": 1,
      "id": "ecfad78d-8555-4c77-ae5b-a2db59a2e0b9",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "content": "Registra la solicitud de reserva fallida en la hoja de errores de Google Sheets para seguimiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        224,
        304
      ],
      "typeVersion": 1,
      "id": "f2498129-7aa8-4f8a-97a9-11777a5d50fe",
      "name": "Sticky Note6"
    },
    {
      "parameters": {
        "content": "Elimina la reserva procesada de la hoja principal para evitar reprocesarla.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        448,
        304
      ],
      "typeVersion": 1,
      "id": "1929f11d-ed02-4df8-903e-2207b7a52cdc",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "jsCode": "// --- 1. OBTENER DATOS Y PREFERENCIAS ---\n// Resultados del scraper (el JSON grande que me mostraste)\nconst flightResults = $input.first().json; \n// Preferencias del usuario desde la hoja de Google Sheets\nconst bookingData = $('Booking Data').first().json; \n\n// Extraemos las preferencias de la reserva. Si no existen, usamos valores por defecto.\nconst minLayover = (bookingData.Min_Layover_Hours !== undefined && bookingData.Min_Layover_Hours !== '') ? parseFloat(bookingData.Min_Layover_Hours) : null;\nconst maxLayover = (bookingData.Max_Layover_Hours !== undefined && bookingData.Max_Layover_Hours !== '') ? parseFloat(bookingData.Max_Layover_Hours) : null;\n// Esta es la bandera para vuelos directos. Será 'false' si el usuario pidió \"directo\".\nconst requiresDirectFlight = bookingData.Stopovers === false;\n\nconst allFlights = flightResults.Flights || [];\n\n// --- 2. FUNCIÓN AUXILIAR PARA CALCULAR HORAS ---\nfunction parseDurationToHours(durationStr) {\n  if (typeof durationStr !== 'string' || !durationStr) return 0;\n  let totalHours = 0;\n  const hoursMatch = durationStr.match(/(\\d+)\\s*h/);\n  const minutesMatch = durationStr.match(/(\\d+)\\s*m/);\n  if (hoursMatch) totalHours += parseInt(hoursMatch[1], 10);\n  if (minutesMatch) totalHours += parseInt(minutesMatch[1], 10) / 60;\n  return totalHours;\n}\n\n// --- 3. LÓGICA DE FILTRADO PRINCIPAL ---\nconst filteredFlights = allFlights.filter(flight => {\n  // Si un vuelo no tiene la estructura esperada, lo descartamos.\n  if (!flight || !flight.legs || flight.legs.length === 0) {\n    return false;\n  }\n\n  // Un vuelo es válido solo si CADA UNO de sus tramos (ida, vuelta) pasa los filtros.\n  return flight.legs.every(leg => {\n    const hasLayovers = leg.layovers && leg.layovers.length > 0;\n\n    // --- FILTRO A: VUELO DIRECTO ---\n    if (requiresDirectFlight) {\n      // Si se pide directo, el tramo solo es válido si NO tiene escalas.\n      return !hasLayovers;\n    }\n    \n    // --- FILTRO B: HORAS DE ESCALA ---\n    // Si no se especificaron horas de escala, el tramo es válido.\n    if (minLayover === null && maxLayover === null) {\n      return true; \n    }\n\n    // Validación de consistencia de datos de Ícaro:\n    // Si el texto dice que hay escalas pero la lista `layovers` está vacía, es un dato inválido. Descartar.\n    if (leg.flight_type && leg.flight_type.toLowerCase().includes('escala') && !hasLayovers) {\n      return false;\n    }\n\n    // Calcular la duración total de las escalas para este tramo.\n    const totalLayoverHours = !hasLayovers ? 0 : leg.layovers.reduce((total, layover) => {\n      return total + parseDurationToHours(layover.waiting_time);\n    }, 0);\n\n    // Comprobar si la duración total está dentro del rango solicitado.\n    const minConditionMet = (minLayover !== null) ? totalLayoverHours >= minLayover : true;\n    const maxConditionMet = (maxLayover !== null) ? totalLayoverHours <= maxLayover : true;\n\n    return minConditionMet && maxConditionMet;\n  });\n});\n\n// --- 4. DEVOLVER EL RESULTADO FINAL FILTRADO ---\nreturn [{\n  json: {\n    ...flightResults,\n    Flights: filteredFlights\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -416,
        352
      ],
      "id": "53e3d643-a6cd-46fc-a4b4-ef761504e05d",
      "name": "Code"
    }
  ],
  "connections": {
    "Google Sheets Trigger": {
      "main": [
        [
          {
            "node": "Booking Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Booking Data": {
      "main": [
        [
          {
            "node": "Execute Workflow1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Execute Workflow1": {
      "main": [
        [
          {
            "node": "Code",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "WhatsApp Business Cloud1": {
      "main": [
        [
          {
            "node": "Google Sheets2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If2": {
      "main": [
        [
          {
            "node": "Execute Workflow2",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "WhatsApp Business Cloud1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets2": {
      "main": [
        [
          {
            "node": "Google Sheets3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code": {
      "main": [
        [
          {
            "node": "If2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "Google Sheets Trigger": [
      {
        "Name": "Gere",
        "Phone": 5493417417442,
        "Contact_Id": 5493417417442,
        "Time_Stamp": "2025-08-24 20:49",
        "Travel_Type": "Vuelo",
        "Origin": "EZE",
        "Flight_Destination": "CUN",
        "Departure_date": "2025-09-20",
        "Return_date": "2025-09-30",
        "Num_Adults": 2,
        "Num_Children": "",
        "Childrens_Ages": "",
        "Stopovers": true,
        "Luggage": true,
        "Airlines": "",
        "Departure_Time_Range": "",
        "Return_Time_Range": "",
        "Travel_Assistance": "",
        "Transfers": "",
        "Layover_Hours": "",
        "Max_Layover_Hours": "",
        "Min_Layover_Hours": ""
      }
    ]
  },
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}