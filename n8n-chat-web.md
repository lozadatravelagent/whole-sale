{
  "nodes": [
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
        1888,
        784
      ],
      "id": "befd15fc-c1a6-4534-8ee6-e227ae068282",
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
        -960,
        208
      ],
      "id": "03239af9-9dda-4406-af54-22b6abfdf255",
      "name": "Webhook1",
      "webhookId": "9e48eec7-ebf1-4d44-9457-64282c6dc6fe"
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
                    "id": "95b04ea1-9944-4fc3-96b2-dd9f28bbc704",
                    "leftValue": "={{ ['reservar','reserva','book','booking'].includes((($json.data?.messages?.[0]?.text?.body ?? $json.messages?.[0]?.text?.body ?? $json.body?.message ?? '').toString().trim().toLowerCase())) }}",
                    "rightValue": "interactive",
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
                    "id": "0d26e850-d9e8-493e-9659-7fb6dc79d3a6",
                    "leftValue": "={{ ['hola'].includes((($json.data?.messages?.[0]?.text?.body ?? $json.messages?.[0]?.text?.body ?? $json.body?.message ?? '').toString().trim().toLowerCase())) }}",
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
                    "id": "16a2f0fd-6f7f-44a6-a876-1a4b19bda5c5",
                    "leftValue": "={{ /\\bquiero(?:\\s+un)?\\s+vuelo\\b/i.test(\n  (\n    $json.data?.messages?.[0]?.text?.body ??\n    $json.messages?.[0]?.text?.body ??\n    $json.body?.message ??\n    ''\n  ).toString()\n   .normalize('NFD').replace(/[\\u0300-\\u036f]/g,'')  // sin acentos\n   .trim()\n) }}",
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
        -704,
        208
      ],
      "id": "1211407b-8ea2-4a00-8e4b-395bc4bdaf34",
      "name": "Switch"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "uOePjgAkKnlBcBgJ",
          "mode": "list",
          "cachedResultName": "Intent Seter"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "method": "get",
            "sender": "={{ $json.contacts[0].wa_id }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Intent",
              "displayName": "Intent",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string",
              "removed": true
            },
            {
              "id": "method",
              "displayName": "method",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "sender",
              "displayName": "sender",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string",
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
        -480,
        784
      ],
      "id": "beca0b6b-c892-4657-bcbb-b1efc010504d",
      "name": "Get Intent"
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
                    "id": "76fe2ee4-206e-4e92-97ac-7bf9ce0f1127",
                    "leftValue": "={{ $json.data.intent }}",
                    "rightValue": "Booking",
                    "operator": {
                      "type": "string",
                      "operation": "equals",
                      "name": "filter.operator.equals"
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
                    "leftValue": "={{ $json.data.intent }}",
                    "rightValue": "priceUpdate",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "c5239feb-2af2-40c8-a46d-95a512859346"
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
                    "id": "2dc9e586-9f29-406a-9b89-069228f92f6b",
                    "leftValue": "={{ $json.data.intent }}",
                    "rightValue": "neutral",
                    "operator": {
                      "type": "string",
                      "operation": "equals",
                      "name": "filter.operator.equals"
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
                    "id": "1033c1b3-36f8-4556-b3e7-d220434a6125",
                    "leftValue": "={{ $json.data.intent }}",
                    "rightValue": "neutral",
                    "operator": {
                      "type": "string",
                      "operation": "equals",
                      "name": "filter.operator.equals"
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
        48,
        736
      ],
      "id": "e8eb1b73-c360-4066-913d-993fd29b243b",
      "name": "Switch1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "e57d73b4-1d79-4775-8ed5-719a7322eef1",
              "name": "text",
              "value": "={{ $('Switch').item.json.messages[0].text.body }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        400,
        592
      ],
      "id": "755f99d0-4f70-483d-a5ff-e8d83e92cc95",
      "name": "Set Prompt3"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "e57d73b4-1d79-4775-8ed5-719a7322eef1",
              "name": "text",
              "value": "={{ $('Switch').item.json.messages[0].text.body }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        400,
        784
      ],
      "id": "ca4ce430-92b7-44d3-93b0-d92e0301531e",
      "name": "Set Prompt5"
    },
    {
      "parameters": {
        "content": "Routes based on intent: Booking extraction, Price update, or Options menu",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        0,
        656
      ],
      "typeVersion": 1,
      "id": "a90cd534-485b-4d0e-aff8-f0c5266b5201",
      "name": "Intent Routing Note"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "web-response-output",
              "name": "output",
              "value": "Hola! ¿Qué te gustaría hacer? Puedo ayudarte a **Reservar** o **Actualizar el precio** de un viaje.",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        480,
        1232
      ],
      "id": "1a649328-674c-413e-acb5-b67698877beb",
      "name": "Set Web Response1"
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
              "id": "91ab1743-c1a6-426b-a7ca-7ded409374ed",
              "leftValue": "={{ $json.data.messaging_product || 'whatsapp' }}",
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
        224,
        1232
      ],
      "id": "495f18ba-2b7c-47a5-aed1-33435e4ddfd7",
      "name": "Only WhatsApp Messages"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.text }}",
        "options": {
          "systemMessage": "=You are a travel booking assistant. When a user sends a natural language message describing travel plans (in Spanish or mixed language), your job is to:\n\nIdentify the booking type:\n\n\"Vuelo\" if it's only about flights\n\"Hotel\" if it's only about hotels\n\"Ambos\" if it includes both\n\nExtract relevant booking information based on the type.\n\n✈️ Flight Fields (if Vuelo or Ambos):\n\norigin: City or airport of departure IATA Code\nflight_destination: City or airport of arrival IATA Code\ndeparture_date: Departure date (YYYY-MM-DD)\nreturn_date: Return date, or leave blank/null if one-way\nadults: Number of adults (default: 1 if not specified)\nchildren: Number of children (default: 0)\nchildren_ages: Ages of children, if any (e.g., [5, 7])\nstopovers: false if “vuelo directo” or “sin escalas”, otherwise true\nluggage: true if any mention of “carry on”, “valija”, or “equipaje”\npreferred_airlines: List of any mentioned airlines (empty if none)\nDeparture_Time_Range: e.g. [6, 12] Departures between 6 AM and 12 PM\nReturn_Time_Range: e.g. [14, 20] Returns between 2 PM and 8 PM\ntravel_assistance: Costo total de la asistencia al viajero, si se menciona (valor numérico, ej. 50)\ntransfers: Costo total de los traslados, si se menciona (valor numérico, ej. 50)\nlayover_hours: Extrae las horas de escala si se mencionan (e.g., \"escala de 2 horas\" -> 2)\nmax_layover_hours: Máximo de horas de escala aceptables si se especifica\nmin_layover_hours: Mínimo de horas de escala aceptables si se especifica\n\n🏨 Hotel Fields (if Hotel or Ambos):\n\nhotel_destination: City or region\ncheckin_date: Date of arrival (YYYY-MM-DD)\ncheckout_date: Date of departure (YYYY-MM-DD)\nadults: Number of adults (default: 1 if not mentioned)\nchildren: Number of children (default: 0)\nchildren_ages: Ages of children, if any\nroom_only: true si se menciona solo habitación\nrefundable: true si se menciona cancelación gratuita o reembolsable\nhalf_board: true si se menciona media pensión\nbreakfast_included: true si se menciona desayuno incluido\nall_inclusive: true si se menciona todo incluido\ntravel_assistance: Costo total de la asistencia al viajero, si se menciona (valor numérico, ej. 50)\ntransfers: Costo total de los traslados, si se menciona (valor numérico, ej. 50)\npreferred_hotel_name: Nombre específico del hotel si se menciona (e.g., \"Hotel Marriott\", \"Hilton\", etc.)\nhotel_chain: Cadena hotelera si se especifica\nhotel_stars: Número de estrellas del hotel si se menciona\n\n\n✅ Behavior:\nParse the user’s message to extract relevant fields.\n\nAutomatically save the extracted structured data to a Google Sheet (via Apps Script or Sheets API).\n\nDo not return or show the extracted data to the user.\n\n✅ If booking data is extracted and saved successfully then respond with:\n\"Perfecto, estoy buscando vuelos u hoteles para usted en este momento.\"\n\n👋 If the input is a greeting or casual message with no booking data then respond with: \"Hola, ¿está buscando vuelo, hotel o ambos?\"\n\n✅ If they reply with Vuelo, Hotel, or Ambos, say:\n\"Perfecto. Por favor, envíeme todos los detalles de la reserva en un solo mensaje.\"\n\nEven if the user input is partial, do your best to fill in known fields and leave others blank or null.\n\nYou must Always respond in Spanish\n\nStandardize and save:\nCity names for Flights: Always Save just the IATA Code in case of Flight Booking\nCity names for Hotels: Keep original name as mentioned by user\nDates: YYYY-MM-DD, future only (Todays Date: {{ $now.format('yyyy-MM-dd') }})\nBooleans: true/false\nChildren ages: comma-separated\npreferred_airlines: comma-separated (\"airline\",\"airline2\")\nTime Ranges: comma-separated integers Only No Decimal Values\nLayover hours: numeric values (can be decimal for partial hours)"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.9,
      "position": [
        1104,
        512
      ],
      "id": "e4005da9-bb7b-42c7-87b0-41128a038873",
      "name": "AI Agent"
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "gpt-4.1",
          "mode": "list",
          "cachedResultName": "gpt-4.1"
        },
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.2,
      "position": [
        1024,
        752
      ],
      "id": "0f3398f5-9fd2-4374-aeff-9ca242dcb1ff",
      "name": "OpenAI Chat Model",
      "credentials": {
        "openAiApi": {
          "id": "wOHaMLW8yduV0Uay",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {},
      "type": "@n8n/n8n-nodes-langchain.toolThink",
      "typeVersion": 1,
      "position": [
        1152,
        752
      ],
      "id": "39c04dcb-ec99-43bd-a1ba-a103edc22321",
      "name": "Think"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.text }}",
        "options": {
          "systemMessage": "=You receive a message from the user.\nYour task is to:\n\nExtract the PDF link from the message (e.g., any URL ending in .pdf or a file-sharing link containing a PDF like https://drive.google.com/file/d/1OeaMts3bdz7Hp7dX0PVJYN0VXDx8RQ1a/view?usp=drivesdk).\n\nExtract up to two numeric values that represent new prices (these are flight prices).\n\nIf only one price is found, apply it to Flight 1 only.\n\nIf two prices are found, apply them to Flight 1 and Flight 2, in order OR accroding to message instructions.\n\nCall the tool update_pdf(pdf_link, flight1_price, flight2_price):\n\nflight2_price can be null if the second price is not provided.\n\nOutput nothing else. Just call the tool with the appropriate arguments.\n\nDo not respond yet. Wait for the tool to return a result.\n\nOnce the tool returns a result:\n\nIf the tool returns a new PDF link (successful update), respond in Spanish with:\n\"✅ El documento ha sido actualizado correctamente. Aquí está su enlace: [new_link]\"\n\nIf the tool returns nothing or fails, respond with:\n\"❌ Ha ocurrido un error al actualizar el documento. Inténtelo de nuevo más tarde o revise el enlace y los precios.\"\n\n📌 If tool is not yet called (based on input condition), use these logic-specific responses in Spanish:\n📎 If a PDF link and new price(s) are extracted successfully, respond with:\n\"Perfecto, estoy actualizando los precios en su documento.\"\n\n💰 If a price is mentioned but no PDF link is provided, respond with:\n\"¿Podría enviarme el enlace del PDF donde desea actualizar el precio?\"\n\n📄 If a PDF link is provided but no price is mentioned, respond with:\n\"He recibido el PDF. ¿Qué precio le gustaría actualizar?\"\n\n❓ If neither PDF nor price is detected, respond with:\n\"Por favor, envíeme el enlace del PDF y el nuevo precio para continuar.\"\n\n"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.9,
      "position": [
        1104,
        1136
      ],
      "id": "6185fa6b-c81b-4f98-9031-80cde5bde646",
      "name": "AI Agent1"
    },
    {
      "parameters": {
        "description": "call this tool to update prices",
        "workflowId": {
          "__rl": true,
          "value": "6QyjdAQXEFCNUwHT",
          "mode": "list",
          "cachedResultName": "Update Price"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "pdf_link": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('pdf_link', ``, 'string') }}",
            "priceOne": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('priceOne', ``, 'string') }}",
            "priceTwo": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('priceTwo', ``, 'string') }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "pdf_link",
              "displayName": "pdf_link",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string",
              "removed": false
            },
            {
              "id": "priceOne",
              "displayName": "priceOne",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string",
              "removed": false
            },
            {
              "id": "priceTwo",
              "displayName": "priceTwo",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string",
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        }
      },
      "type": "@n8n/n8n-nodes-langchain.toolWorkflow",
      "typeVersion": 2.2,
      "position": [
        1392,
        1360
      ],
      "id": "ed1f9b1c-2b6c-4b15-be5b-5846009a745d",
      "name": "Call n8n Workflow Tool"
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "gpt-4.1",
          "mode": "list",
          "cachedResultName": "gpt-4.1"
        },
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.2,
      "position": [
        1088,
        1360
      ],
      "id": "7dbc7815-ae5c-4dd2-a186-b07bc9fdc4d6",
      "name": "OpenAI Chat Model1",
      "credentials": {
        "openAiApi": {
          "id": "wOHaMLW8yduV0Uay",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {},
      "type": "@n8n/n8n-nodes-langchain.toolThink",
      "typeVersion": 1,
      "position": [
        1248,
        1360
      ],
      "id": "f9b9f4cb-8d70-4d87-a1ca-a6fd2b162e48",
      "name": "Think1"
    },
    {
      "parameters": {
        "descriptionType": "manual",
        "toolDescription": "=Purpose:\nCall this tool (only when user just want Flight) to add a new row of Flight data to a Google Sheet. (Do not Use this If travel type is Ambos)\n\nWhen to use:\nAfter collecting and confirming all required information from the user for a Vuelo.",
        "operation": "append",
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
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=0"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Name": "={{ $json.body?.user_name || 'Test User' }}",
            "Phone": "={{ $json.body?.phone || '+540000000000' }}\n",
            "Contact_Id": "={{ $json.body?.user_id || $json.body?.conversation_id || 'test-contact-001' }}\n",
            "Travel_Type": "=Vuelo",
            "Origin": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Origin', `Origin city or airport code e.g. Madrid | MAD`, 'string') }}",
            "Departure_date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Departure_date', `Flight departure Date e.g. 2025-08-18`, 'string') }}",
            "Return_date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Return_date', `Flight return Date e.g. 2025-08-18`, 'string') }}",
            "Num_Adults": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Adults', ``, 'string') }}",
            "Num_Children": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Children', ``, 'string') }}",
            "Childrens_Ages": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Childrens_Ages', `ages seperated by comma e.g. 10,12`, 'string') }}",
            "Stopovers": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Stopovers', `True | False`, 'string') }}",
            "Luggage": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Luggage', `True | False`, 'string') }}",
            "Airlines": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Airlines', `airlines name seperated by comma e.g. \"airline\",\"airline2\"`, 'string') }}",
            "Departure_Time_Range": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Departure_Time_Range', `6, 10 (Departures between 6 AM and 12 PM)`, 'string') }}",
            "Return_Time_Range": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Return_Time_Range', `14, 20 (Returns between 2 PM and 8 PM)`, 'string') }}",
            "Flight_Destination": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Flight_Destination', ``, 'string') }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}",
            "Travel_Assistance": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Travel_Assistance', ``, 'string') }}",
            "Transfers": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Transfers', ``, 'string') }}",
            "Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('layover_hours', 'Horas de escala', 'string') }}",
            "Max_Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('max_layover_hours', 'Máximo horas de escala', 'string') }}",
            "Min_Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('min_layover_hours', 'Mínimo horas de escala', 'string') }}"
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
              "id": "Flight_Destination",
              "displayName": "Flight_Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Return_date",
              "displayName": "Return_date",
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
            },
            {
              "id": "Departure_Time_Range",
              "displayName": "Departure_Time_Range",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Return_Time_Range",
              "displayName": "Return_Time_Range",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Travel_Assistance",
              "displayName": "Travel_Assistance",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Transfers",
              "displayName": "Transfers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Layover_Hours",
              "displayName": "Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Max_Layover_Hours",
              "displayName": "Max_Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Min_Layover_Hours",
              "displayName": "Min_Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTool",
      "typeVersion": 4.5,
      "position": [
        1264,
        752
      ],
      "id": "7b629e9d-476e-4d2d-8b23-9806cccbd766",
      "name": "Add Flights",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "descriptionType": "manual",
        "toolDescription": "=Purpose:\nCall this tool to add a new row of Flight and Hotel combined data to a Google Sheet.\n\nWhen to use:\nAfter collecting and confirming all required information from the user for a Both Flight and Hotel.",
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
          "value": 1667133298,
          "mode": "list",
          "cachedResultName": "Ambos",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=1667133298"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Name": "={{ $json.body?.user_name || 'Test User' }}",
            "Phone": "={{ $json.body?.phone || '+540000000000' }}",
            "Contact_Id": "={{ $json.body?.user_id || $json.body?.conversation_id || 'test-contact-001' }}",
            "Travel_Type": "=Ambos",
            "Num_Adults": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Adults', ``, 'string') }}",
            "Num_Children": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Children', ``, 'string') }}",
            "Childrens_Ages": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Childrens_Ages', `ages seperated by comma e.g. 10,12`, 'string') }}",
            "Check_In_Date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Check_In_Date', ``, 'string') }}",
            "Check_Out_Date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Check_Out_Date', ``, 'string') }}",
            "Origin": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Origin', ``, 'string') }}",
            "Flight_Destination": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Flight_Destination', `Flight Destination`, 'string') }}",
            "Departure_date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Departure_date', ``, 'string') }}",
            "Return_date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Return_date', ``, 'string') }}",
            "Stopovers": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Stopovers', ``, 'string') }}",
            "Luggage": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Luggage', ``, 'string') }}",
            "Airlines": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Airlines', ``, 'string') }}",
            "Hotel_Destination": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Hotel_Destination', `Hotel Destination`, 'string') }}",
            "Departure_Time_Range": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Departure_Time_Range', `6, 10 (Departures between 6 AM and 12 PM)`, 'string') }}",
            "Return_Time_Range": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Return_Time_Range', `14, 20 (Returns between 2 PM and 8 PM)`, 'string') }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}\n",
            "Room_Only": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Room_Only', ``, 'string') }}",
            "Refundable": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Refundable', ``, 'string') }}",
            "Half_Board": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Half_Board', ``, 'string') }}",
            "Breakfast_Included": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Breakfast_Included', ``, 'string') }}",
            "Travel_Assistance": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Travel_Assistance', ``, 'string') }}",
            "All_Inclusive": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('All_Inclusive', ``, 'string') }}",
            "Transfers": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Transfers', ``, 'string') }}",
            "Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('layover_hours', 'Horas de escala', 'string') }}",
            "Max_Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('max_layover_hours', 'Máximo horas de escala', 'string') }}",
            "Min_Layover_Hours": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('min_layover_hours', 'Mínimo horas de escala', 'string') }}",
            "Preferred_Hotel": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Preferred_Hotel', ``, 'string') }}"
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
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Flight_Destination",
              "displayName": "Flight_Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Departure_date",
              "displayName": "Departure_date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Return_date",
              "displayName": "Return_date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
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
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Luggage",
              "displayName": "Luggage",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Airlines",
              "displayName": "Airlines",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Departure_Time_Range",
              "displayName": "Departure_Time_Range",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Return_Time_Range",
              "displayName": "Return_Time_Range",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Hotel_Destination",
              "displayName": "Hotel_Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Room_Only",
              "displayName": "Room_Only",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Refundable",
              "displayName": "Refundable",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Half_Board",
              "displayName": "Half_Board",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Breakfast_Included",
              "displayName": "Breakfast_Included",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "All_Inclusive",
              "displayName": "All_Inclusive",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Travel_Assistance",
              "displayName": "Travel_Assistance",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Transfers",
              "displayName": "Transfers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Layover_Hours",
              "displayName": "Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Max_Layover_Hours",
              "displayName": "Max_Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Min_Layover_Hours",
              "displayName": "Min_Layover_Hours",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Preferred_Hotel",
              "displayName": "Preferred_Hotel",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTool",
      "typeVersion": 4.5,
      "position": [
        1552,
        752
      ],
      "id": "c0f9f7c2-fc91-4283-9412-d033574eb355",
      "name": "Add Both",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "uOePjgAkKnlBcBgJ",
          "mode": "list",
          "cachedResultName": "Intent Seter"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Intent": "neutral",
            "method": "set",
            "sender": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Intent",
              "displayName": "Intent",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "method",
              "displayName": "method",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "sender",
              "displayName": "sender",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
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
        2112,
        784
      ],
      "id": "88af1572-78b3-4f10-9473-32a3e53e3169",
      "name": "Set Neutral"
    },
    {
      "parameters": {
        "descriptionType": "manual",
        "toolDescription": "=Purpose:\nCall this tool (Only when user wants just Hotel Booking ) to add a new row of Hotel data to a Google Sheet. (Do not call if the travel type is Ambos)\n\nWhen to use:\nAfter collecting and confirming all required information from the user for a Hotel.",
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
          "value": 522833453,
          "mode": "list",
          "cachedResultName": "Hotels",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=522833453"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Name": "={{ $json.body?.user_name || 'Test User' }}",
            "Phone": "={{ $json.body?.phone || '+540000000000' }}",
            "Contact_Id": "={{ $json.body?.user_id || $json.body?.conversation_id || 'test-contact-001' }}",
            "Travel_Type": "=Hotel",
            "Num_Adults": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Adults', ``, 'string') }}",
            "Num_Children": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Num_Children', ``, 'string') }}",
            "Childrens_Ages": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Childrens_Ages', `ages seperated by comma e.g. 10,12`, 'string') }}",
            "Check_In_Date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Check_In_Date', ``, 'string') }}",
            "Check_Out_Date": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Check_Out_Date', ``, 'string') }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}",
            "Hotel_Destination": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Hotel_Destination', ``, 'string') }}",
            "Room_Only": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Room_Only', ``, 'string') }}",
            "Refundable": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Refundable', ``, 'string') }}",
            "Half_Board": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Half_Board', ``, 'string') }}",
            "Breakfast_Included": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Breakfast_Included', ``, 'string') }}",
            "All_Inclusive": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('All_Inclusive', ``, 'string') }}",
            "Travel_Assistance": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Travel_Assistance', ``, 'string') }}",
            "Transfers": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Transfers', ``, 'string') }}",
            "Preferred_Hotel": "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('Preferred_Hotel', ``, 'string') }}"
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
              "id": "Hotel_Destination",
              "displayName": "Hotel_Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Room_Only",
              "displayName": "Room_Only",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Refundable",
              "displayName": "Refundable",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Half_Board",
              "displayName": "Half_Board",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Breakfast_Included",
              "displayName": "Breakfast_Included",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "All_Inclusive",
              "displayName": "All_Inclusive",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Travel_Assistance",
              "displayName": "Travel_Assistance",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Transfers",
              "displayName": "Transfers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Preferred_Hotel",
              "displayName": "Preferred_Hotel",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            }
          ],
          "attemptToConvertTypes": false,
          "convertFieldsToString": false
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTool",
      "typeVersion": 4.5,
      "position": [
        1408,
        752
      ],
      "id": "c737817d-fb4e-4651-afb0-8f9d2e66b7e6",
      "name": "Add Hotels",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
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
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.id.isNumeric() }}",
                    "rightValue": "",
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    },
                    "id": "8d486200-8362-4add-880e-97e50a4b844e"
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
                    "id": "f77715e9-8b3a-4837-9644-abeca8c5141d",
                    "leftValue": "={{ $json.body.message }}",
                    "rightValue": "Reservar",
                    "operator": {
                      "type": "string",
                      "operation": "equals",
                      "name": "filter.operator.equals"
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
                    "id": "7dfdc7f4-3600-4af0-9315-adeac200ba9c",
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.id }}",
                    "rightValue": "priceUpdate",
                    "operator": {
                      "type": "string",
                      "operation": "equals",
                      "name": "filter.operator.equals"
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
        -192,
        -144
      ],
      "id": "90e8b4b4-f01b-47d0-a18c-d80451834a06",
      "name": "Switch2"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "uOePjgAkKnlBcBgJ",
          "mode": "list",
          "cachedResultName": "Intent Seter"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Intent": "=Booking",
            "method": "set",
            "sender": "={{ $json.contacts[0].wa_id }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Intent",
              "displayName": "Intent",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "method",
              "displayName": "method",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "sender",
              "displayName": "sender",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
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
        80,
        -128
      ],
      "id": "7a6c971a-2111-4aee-bed2-b1c9715ed7cc",
      "name": "Set Booking"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "uOePjgAkKnlBcBgJ",
          "mode": "list",
          "cachedResultName": "Intent Seter"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Intent": "=priceUpdate",
            "method": "set",
            "sender": "={{ $json.contacts[0].wa_id }}"
          },
          "matchingColumns": [],
          "schema": [
            {
              "id": "Intent",
              "displayName": "Intent",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "method",
              "displayName": "method",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
            },
            {
              "id": "sender",
              "displayName": "sender",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "string"
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
        80,
        272
      ],
      "id": "dff6fd22-51eb-48b8-8ddf-39a3ac114831",
      "name": "Set Price Update"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "copy-original-data",
              "name": "data",
              "value": "={{ $('Switch').item.json }}",
              "type": "object"
            },
            {
              "id": "add-intent",
              "name": "data.intent",
              "value": "={{ $json.intent }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -176,
        800
      ],
      "id": "327ee27c-eccc-405e-9c93-af7aa7dacf74",
      "name": "Combine Data"
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
        704,
        1232
      ],
      "id": "17316d61-cc5f-4de7-a875-ef6d30fa767c",
      "name": "Respond to Webhook1"
    },
    {
      "parameters": {
        "content": "BOOKING AI: Extracts travel data and saves to Google Sheets with AI agent",
        "height": 440,
        "width": 680
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        976,
        448
      ],
      "typeVersion": 1,
      "id": "33df61dd-6e68-48c3-b3d2-e51e74559164",
      "name": "Booking AI Note"
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
        640,
        -112
      ],
      "id": "9118567d-ae4e-4ffc-8cd3-6a574c6efd63",
      "name": "Respond to Webhook2"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "web-response-output",
              "name": "output",
              "value": "Por favor, envíeme todos los detalles de la reserva en un solo mensaje",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        352,
        -128
      ],
      "id": "bb96c613-b87d-460a-8bcd-bc1fbd0bebbf",
      "name": "Set Web Response"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "web-response-output",
              "name": "output",
              "value": "Por favor, envíeme el enlace del PDF y el nuevo precio para continuar en un solo mensaje.",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        336,
        272
      ],
      "id": "391e9886-a90d-4342-b7c9-d44bdc360025",
      "name": "Set Web Response2"
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
        576,
        272
      ],
      "id": "a0a19ebf-a16c-4e24-a0ac-b1e864360bef",
      "name": "Respond to Webhook3"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "e57d73b4-1d79-4775-8ed5-719a7322eef1",
              "name": "text",
              "value": "={{ ($json.data?.messages?.[0]?.text?.body\n    ?? $json.messages?.[0]?.text?.body\n    ?? $json.body?.message\n    ?? ''\n).toString().trim() }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -176,
        432
      ],
      "id": "43816f19-00e0-4d30-a307-f6ef0817c47a",
      "name": "Set Prompt"
    }
  ],
  "connections": {
    "Respond to Webhook": {
      "main": [
        []
      ]
    },
    "Webhook1": {
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
    "Switch": {
      "main": [
        [
          {
            "node": "Switch2",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Get Intent",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Set Prompt",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Intent": {
      "main": [
        [
          {
            "node": "Combine Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch1": {
      "main": [
        [
          {
            "node": "Set Prompt3",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Set Prompt5",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Set Web Response1",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Only WhatsApp Messages",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Prompt3": {
      "main": [
        [
          {
            "node": "AI Agent",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Prompt5": {
      "main": [
        [
          {
            "node": "AI Agent1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Web Response1": {
      "main": [
        [
          {
            "node": "Respond to Webhook1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Only WhatsApp Messages": {
      "main": [
        [],
        [
          {
            "node": "Set Web Response1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "AI Agent": {
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
    "OpenAI Chat Model": {
      "ai_languageModel": [
        [
          {
            "node": "AI Agent",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Think": {
      "ai_tool": [
        [
          {
            "node": "AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "AI Agent1": {
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
    "Call n8n Workflow Tool": {
      "ai_tool": [
        [
          {
            "node": "AI Agent1",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "OpenAI Chat Model1": {
      "ai_languageModel": [
        [
          {
            "node": "AI Agent1",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Think1": {
      "ai_tool": [
        [
          {
            "node": "AI Agent1",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "Add Flights": {
      "ai_tool": [
        [
          {
            "node": "AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "Add Both": {
      "ai_tool": [
        [
          {
            "node": "AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "Add Hotels": {
      "ai_tool": [
        [
          {
            "node": "AI Agent",
            "type": "ai_tool",
            "index": 0
          }
        ]
      ]
    },
    "Switch2": {
      "main": [
        [],
        [
          {
            "node": "Set Booking",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Set Price Update",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Booking": {
      "main": [
        [
          {
            "node": "Set Web Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Price Update": {
      "main": [
        [
          {
            "node": "Set Web Response2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Combine Data": {
      "main": [
        [
          {
            "node": "Switch1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Web Response": {
      "main": [
        [
          {
            "node": "Respond to Webhook2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Set Web Response2": {
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
    "Set Prompt": {
      "main": [
        [
          {
            "node": "AI Agent",
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