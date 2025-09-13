{
  "nodes": [
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "Flights",
              "type": "array"
            },
            {
              "name": "Hotels",
              "type": "array"
            },
            {
              "name": "Booking Data",
              "type": "object"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -544,
        624
      ],
      "id": "a6e2d0fd-14bf-4f98-8db9-8e3b0ed8b67b",
      "name": "Trigger"
    },
    {
      "parameters": {
        "jsCode": "\n  return items.map((item, index) => {\n    const vuelo = item.json;\n    const legs = vuelo.legs;\n    const airline = vuelo.airline.name;\n    const price = `${vuelo.price.amount} ${vuelo.price.currency}`;\n\n    const titulo = `✈️ ${airline}`;\n\n    // Construir descripción estilo lista con emojis\n    const detalles = legs.map((pierna, index) => {\n      const tramo = index === 0 ? `🛫 Ida (${$('Trigger').first().json['Booking Data'].Departure_date})` : `🛬 Regreso (${$('Trigger').first().json['Booking Data'].Return_date})`;\n      const salida = `📍 *Origen*: ${pierna.departure.city_name} (${pierna.departure.city_code})`;\n      const horaSalida = `🕒 *Salida*: ${pierna.departure.time}`;\n      const llegada = `🎯 *Destino*: ${pierna.arrival.city_name} (${pierna.arrival.city_code})`;\n      const horaLlegada = `🕓 *Llegada*: ${pierna.arrival.time}`;\n      const duracion = `⏱️ *Duración*: ${pierna.duration}`;\n\n      let escalaTexto = \"\";\n      if (pierna.layovers?.length) {\n        const escala = pierna.layovers[0];\n        escalaTexto = `🛑 Escala en ${escala.destination_city} (${escala.destination_code}) durante ${escala.waiting_time}`;\n      }\n\n      return `${tramo}\\n${salida}\\n${horaSalida}\\n${llegada}\\n${horaLlegada}\\n${duracion}${escalaTexto ? `\\n${escalaTexto}` : \"\"}`;\n    });\n\n    const descripcion =\n      `${detalles.join(\"\\n\\n\")}\\n\\n💰 Precio: ${price}`;\n\n    return {\n      id: `${index}`,\n      title: titulo,\n      description: descripcion\n    };\n  });\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        704,
        608
      ],
      "id": "90575c3d-eb5c-4b97-bdd2-b136b84d316a",
      "name": "Code1"
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "a83ed270-b76d-4afc-bf41-731cb9567c88",
                    "leftValue": "={{ $('Trigger').item.json['Booking Data'].Travel_Type === \"Hotel\" }}",
                    "rightValue": "Hotel",
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ],
                "combinator": "and"
              }
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Trigger').item.json['Booking Data'].Travel_Type === \"Vuelo\"}}",
                    "rightValue": "=",
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    },
                    "id": "a88d1e6f-1b21-49ca-bc5d-095235953153"
                  }
                ],
                "combinator": "and"
              }
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 2
                },
                "conditions": [
                  {
                    "id": "86322460-b0d1-42b3-bd1b-4849f5901b2e",
                    "leftValue": "={{ $('Trigger').item.json['Booking Data'].Travel_Type === \"Ambos\"}}",
                    "rightValue": "",
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ],
                "combinator": "and"
              }
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [
        -336,
        608
      ],
      "id": "a0656188-2e59-4674-9a27-ead919dc9c68",
      "name": "Switch"
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
              "id": "7ff4f208-d767-43a7-862d-de1b1a1f54ab",
              "leftValue": "={{ $json.airline }}",
              "rightValue": "",
              "operator": {
                "type": "object",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "471a1768-6522-415e-b5b3-cfd08d0c1afa",
              "leftValue": "={{ $json.legs }}",
              "rightValue": "",
              "operator": {
                "type": "array",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "b62f23ee-5481-4ba7-baf2-7411f4bfb3c0",
              "leftValue": "={{ $json.price }}",
              "rightValue": "",
              "operator": {
                "type": "object",
                "operation": "exists",
                "singleValue": true
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.filter",
      "typeVersion": 2.2,
      "position": [
        480,
        608
      ],
      "id": "a07dc2eb-770a-45af-b1e9-b6d990bcf9f0",
      "name": "Filter"
    },
    {
      "parameters": {
        "content": "Recibe vuelos/hoteles y datos de reserva del flujo de trabajo llamante.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -576,
        464
      ],
      "typeVersion": 1,
      "id": "a0c42444-2776-43e0-a650-caa5dca6bbf7",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Enruta el flujo de trabajo según el tipo de viaje: Hotel o Vuelo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -384,
        464
      ],
      "typeVersion": 1,
      "id": "dc2ce375-c76b-465f-bc71-520701e8144f",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Filtra los vuelos para asegurar que existan todos los campos requeridos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        448,
        464
      ],
      "typeVersion": 1,
      "id": "fb7ea912-d40d-49f4-8687-a42135c228d7",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "content": "Da formato a los datos de los vuelos en un mensaje interactivo para WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        672,
        464
      ],
      "typeVersion": 1,
      "id": "a4e7291b-4597-448c-8e18-12cc90079155",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "content": "Envía las opciones de vuelo al cliente vía WhatsApp con botones de selección.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        880,
        464
      ],
      "typeVersion": 1,
      "id": "5991b9c1-9de1-4666-9b0c-3025f0ebbaf2",
      "name": "Sticky Note9"
    },
    {
      "parameters": {
        "fieldToSplitOut": "Flights",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        48,
        608
      ],
      "id": "f97c35cb-d71d-4635-b50f-9eeb71e0c1a6",
      "name": "Split Out1"
    },
    {
      "parameters": {
        "maxItems": 5
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        240,
        608
      ],
      "id": "e8e901c2-0fd8-4fbd-96f6-346cbab1bc07",
      "name": "Limit1"
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ \n  { results: $items().map(i => i.json) } \n}}",
        "options": {}
      },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [
        912,
        608
      ],
      "id": "c7a39a10-1871-4974-a3fc-400ac8c1c559",
      "name": "Respond to Webhook3"
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Switch",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code1": {
      "main": [
        [
          {
            "node": "Respond to Webhook3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch": {
      "main": [
        [],
        [
          {
            "node": "Split Out1",
            "type": "main",
            "index": 0
          }
        ],
        []
      ]
    },
    "Filter": {
      "main": [
        [
          {
            "node": "Code1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split Out1": {
      "main": [
        [
          {
            "node": "Limit1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Limit1": {
      "main": [
        [
          {
            "node": "Filter",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Respond to Webhook3": {
      "main": [
        []
      ]
    }
  },
  "pinData": {
    "Trigger": [
      {
        "Flights": [
          {
            "airline": {
              "code": "IB",
              "name": "Icaro Flight - Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "13:00"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "05:40"
                },
                "duration": "11h 40m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "08:45"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "16:20"
                },
                "duration": "12h 35m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.143,80",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "IB",
              "name": "Icaro Flight - Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "21:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "14:40"
                },
                "duration": "11h 50m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "08:45"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "16:20"
                },
                "duration": "12h 35m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.143,80",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "IB",
              "name": "Icaro Flight - Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "13:00"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "05:40"
                },
                "duration": "11h 40m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "08:45"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "16:20"
                },
                "duration": "12h 35m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.253",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "IB",
              "name": "Icaro Flight - Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "13:00"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "05:40"
                },
                "duration": "11h 40m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "08:45"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "16:20"
                },
                "duration": "12h 35m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.253",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "IB",
              "name": "Icaro Flight - Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "21:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "14:40"
                },
                "duration": "11h 50m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "08:45"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "16:20"
                },
                "duration": "12h 35m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.253",
              "currency": "USD"
            },
            "source": "icaro"
          }
        ],
        "Hotels": null,
        "Booking Data": {
          "Name": "Tomas",
          "Phone": 5492954602920,
          "Contact_Id": 5492954602920,
          "Time_Stamp": "2025-09-03 9:37",
          "Travel_Type": "Vuelo",
          "Origin": "EZE",
          "Flight_Destination": "MAD",
          "Departure_date": "2025-10-10",
          "Return_date": "2025-10-17",
          "Num_Adults": 2,
          "Num_Children": "",
          "Childrens_Ages": "",
          "Stopovers": "",
          "Luggage": "",
          "Airlines": "",
          "Departure_Time_Range": "",
          "Return_Time_Range": "",
          "Travel_Assistance": "",
          "Transfers": "",
          "Layover_Hours": "",
          "Max_Layover_Hours": "",
          "Min_Layover_Hours": ""
        }
      }
    ]
  },
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

{
    "parameters": {
      "url": "https://tu-proyecto.supabase.co/functions/v1/add-message",
      "authentication": "predefinedCredentialType",
      "nodeCredentialType": "supabaseApi",
      "sendHeaders": true,
      "headerParameters": {
        "parameters": [
          {
            "name": "Content-Type",
            "value": "application/json"
          },
          {
            "name": "Authorization",
            "value": "Bearer {{ $credentials.supabaseApi.serviceKey }}"
          }
        ]
      },
      "sendBody": true,
      "bodyParameters": {
        "parameters": []
      },
      "jsonBody": "={{ \n{\n  \"conversationId\": $('Trigger').first().json['Booking Data'].conversation_id || null,\n  \"role\": \"assistant\",\n
  \"content\": {\n    \"text\": \"✈️ ¡Encontré \" + $items().length + \" opciones de vuelos para ti!\\n\\n\" + \n           $items().map((item, index) =>     
  \n             `**${index + 1}. ${item.json.title}**\\n` +\n             item.json.description.replace(/\\\\n/g, '\\n') + \n
  \"\\n\\n---\\n\"\n           ).join('') +\n           \"\\n💡 *Selecciona la opción que más te guste y te ayudo con la reserva.*\"\n  },\n  \"meta\":       
  {\n    \"flight_results\": true,\n    \"flight_count\": $items().length\n  }\n} }}"
    },
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [
      800,
      608
    ],
    "id": "flight-message-sender",
    "name": "Send Flight Options to Chat"
}