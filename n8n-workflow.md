*Whatsapp Trigger*

{
  "nodes": [
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
        240,
        -640
      ],
      "id": "baf23e95-bfac-4ca6-abc3-f365fdbec27b",
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
        160,
        -400
      ],
      "id": "0cb05916-e6d3-43ad-8a5f-0473d5038ba3",
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
        288,
        -400
      ],
      "id": "8c3017b7-64a9-411c-a7e2-b62ba58009cc",
      "name": "Think"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('WhatsApp Trigger').item.json.messages[0].from }}",
        "textBody": "={{ $json.output }}",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        1040,
        -368
      ],
      "id": "d2287faf-649b-47af-88c9-bffa2447e6bc",
      "name": "WhatsApp Business Cloud",
      "webhookId": "bccd7aa5-6515-4d31-b90f-3beb407d33cb",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
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
                    "id": "95b04ea1-9944-4fc3-96b2-dd9f28bbc704",
                    "leftValue": "={{ $json.messages[0].type === \"interactive\" && $json.messages[0].interactive.type === \"button_reply\" }}",
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
                    "leftValue": "={{ $json.messages[0].type }}",
                    "rightValue": "text",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "96d9568b-79f8-4163-a534-76880bb89f18"
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
        -1744,
        -1088
      ],
      "id": "f0e8e8f0-b055-4522-a894-b9e5bb20b6fa",
      "name": "Switch"
    },
    {
      "parameters": {
        "operation": "fromJson",
        "options": {}
      },
      "type": "n8n-nodes-base.extractFromFile",
      "typeVersion": 1,
      "position": [
        -320,
        -1840
      ],
      "id": "c4f07554-3366-4aa8-b03c-fd7f76a4e2d7",
      "name": "Extract from File"
    },
    {
      "parameters": {
        "jsCode": "function buildSelectedFlights(flight1, flight2) {\n  const departureDate = $input.first().json.BookingData.Departure_date;\n  const returnDate = $input.first().json.BookingData.Return_date;\n  const adults = $input.first().json.BookingData.Num_Adults || 0;\n  const childrens = $input.first().json.BookingData.Num_Children || 0;\n  const luggage = $input.first().json.BookingData.Luggage || false;\n  const travel_assistance = $input.first().json.BookingData.Travel_Assistance || 0;\n  \n  const transfers = $input.first().json.BookingData.Transfers || 0;\n\n  const hasLayovers = (flight) =>\n    flight.legs.some(leg => Array.isArray(leg.layovers) && leg.layovers.length > 0);\n\n  const enrichFlight = (flight) => ({\n    airline: flight.airline,\n    departure_date: departureDate,\n    return_date: returnDate,\n    luggage: luggage,\n    adults: adults,\n    childrens: childrens,\n    travel_assistance: travel_assistance,\n    transfers: transfers,\n    legs: flight.legs,\n    price: flight.price\n  });\n\n  const f1HasLayovers = hasLayovers(flight1);\n  const f2HasLayovers = hasLayovers(flight2);\n\n  let selectedFlights;\n\n  if (f1HasLayovers && !f2HasLayovers) {\n    selectedFlights = [enrichFlight(flight1), enrichFlight(flight2)];\n  } else if (!f1HasLayovers && f2HasLayovers) {\n    selectedFlights = [enrichFlight(flight2), enrichFlight(flight1)];\n  } else {\n    selectedFlights = [enrichFlight(flight1), enrichFlight(flight2)];\n  }\n\n  return [{\n    json:{\n      payload: {\n        selected_flights: selectedFlights\n      }\n    }}\n  ];\n}\n\n// Get flights from input items\nconst flight1 = $input.first().json.First\nconst flight2 = $input.first().json.Second\n\n// Build and return the structured object properly\nreturn buildSelectedFlights(flight1, flight2);\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1008,
        -1840
      ],
      "id": "baa477a3-e40c-4823-bf7f-30cb4b88fe60",
      "name": "Code"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "e556d0fc-2858-4d6d-b4db-15e453ec9833",
              "name": "First",
              "value": "={{ $('Edit Fields').first().json.FirstSelection }}",
              "type": "object"
            },
            {
              "id": "e4ad0123-ffb1-42ed-96fd-ea0280eb92e0",
              "name": "Second",
              "value": "={{ $('Edit Fields').first().json.SecondSelection }}",
              "type": "object"
            },
            {
              "id": "e96f8e43-caf1-4f22-9d88-84958b0282dd",
              "name": "BookingData",
              "value": "={{ $('Edit Fields').item.json.BookingData }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        784,
        -1840
      ],
      "id": "457411fe-9cd8-40e9-9e08-7276711f2be5",
      "name": "Edit Fields1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.pdfmonkey.io/api/v1/documents",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document\": {\n    \"document_template_id\": \"30B142BF-1DD9-432D-8261-5287556DC9FC\",\n    \"status\": \"pending\",\n    \"payload\": {{ $json.payload.toJsonString() }}\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1232,
        -1840
      ],
      "id": "592759d0-8f16-4366-9cec-38000f1845c6",
      "name": "Create PDF1",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "url": "=https://api.pdfmonkey.io/api/v1/documents/{{ $json.document.id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1472,
        -1840
      ],
      "id": "acde55c3-21c1-45ec-9af6-e4efced240c7",
      "name": "Get PDF",
      "retryOnFail": true,
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "url": "={{ $json.document.download_url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1472,
        -1296
      ],
      "id": "b88c7570-c0c3-4f86-98a0-b86dd7562f89",
      "name": "HTTP Request"
    },
    {
      "parameters": {
        "name": "=Vuelo_{{ $now.format('yyyy-MM-dd') }}",
        "driveId": {
          "__rl": true,
          "mode": "list",
          "value": "My Drive"
        },
        "folderId": {
          "__rl": true,
          "value": "1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN",
          "mode": "list",
          "cachedResultName": "PDF",
          "cachedResultUrl": "https://drive.google.com/drive/folders/1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        1168,
        -1296
      ],
      "id": "ccfc4537-c304-43b4-9221-170e2774bf98",
      "name": "Google Drive",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "operation": "share",
        "fileId": {
          "__rl": true,
          "value": "={{ $json.id }}",
          "mode": "id"
        },
        "permissionsUi": {
          "permissionsValues": {
            "role": "reader",
            "type": "anyone"
          }
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        944,
        -1296
      ],
      "id": "95416dca-de14-4aec-9724-d8f1d26d5584",
      "name": "Google Drive1",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "success",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1472,
        -1664
      ],
      "id": "5f6e26eb-59d8-4aae-97ca-23cd29ff0bd4",
      "name": "If2"
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "failure",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1472,
        -1488
      ],
      "id": "322b78aa-27c2-4fba-8720-e61b9ecafe89",
      "name": "If3"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        128,
        -1840
      ],
      "id": "889349f8-f3e7-4c2c-bcd5-0f3a7122921c",
      "name": "Convert to File"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=Vuelo_{{ $('Switch').item.json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        368,
        -1840
      ],
      "id": "6fbbb021-95d3-46ef-9f53-2482698d96a6",
      "name": "Read/Write Files from Disk1"
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
              "id": "50f60728-2bf1-46ce-8123-a5e9a74e3d9c",
              "leftValue": "={{ $('Edit Fields').item.json.SelectedCount }}",
              "rightValue": 2,
              "operator": {
                "type": "number",
                "operation": "equals"
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
        560,
        -1840
      ],
      "id": "1ab492f7-bb55-41db-8721-c68bdd05cdab",
      "name": "If1"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}\",\n  \"type\": \"text\",\n  \"text\": {\n    \"preview_url\": true,\n    \"body\": \"Como solicitó, aquí tiene el enlace al PDF: {{ $('Google Drive').item.json.webViewLink }}\"\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        720,
        -1296
      ],
      "id": "53d543da-1ae3-4d33-8ece-5ffcd5fe02bb",
      "name": "HTTP Request1",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "listId": "67f4c5ec5c4fe13afd91b77f",
        "name": "=🙋‍♂️ {{ $json.Name }}",
        "description": "=✈️ Travel Type: {{ $json.Travel_Type }}\n🛫 Origin: {{ $json.Origin }}\n🛬 Flight Destination: {{ $json.Flight_Destination }}\n\n📅 Departure Date: {{ $json.Departure_date }}\n📅 Return Date: {{ $json.Return_date || \"-\" }}\n\n👨‍👩‍👧‍👦 Number of Adults: {{ $json.Num_Adults }}\n🧒 Number of Children: {{ $json.Num_Children || 0 }}\n🎈 Children's Ages: {{ $json.Childrens_Ages || \"-\" }}\n\n🛑 Stopovers: {{ $json.Stopovers }}\n🧳 Luggage: {{ $json.Luggage }}\n\n🛡️ Travel Assistance: {{ $json.Travel_Assistance || 0 }}\n🚐 Transfers: {{ $json.Transfers || 0 }}\n\n📄 PDF: {{ $json.Pdf_link }}",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.trello",
      "typeVersion": 1,
      "position": [
        224,
        -1296
      ],
      "id": "4deaa478-52ba-43a2-9188-91751d3068ab",
      "name": "Trello",
      "credentials": {
        "trelloApi": {
          "id": "2txCzzpBpfqLUX0k",
          "name": "Trello account"
        }
      }
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
          "value": 2113820245,
          "mode": "list",
          "cachedResultName": "scrapped",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=2113820245"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Phone": "={{ $('Edit Fields').item.json.BookingData.Phone }}",
            "Contact_Id": "={{ $('Edit Fields').item.json.BookingData.Contact_Id }}",
            "Travel_Type": "={{ $('Edit Fields').item.json.BookingData.Travel_Type }}",
            "Num_Adults": "={{ $('Edit Fields').item.json.BookingData.Num_Adults }}",
            "Num_Children": "={{ $('Edit Fields').item.json.BookingData.Num_Children }}",
            "Pdf_link": "={{ $('Google Drive').item.json.webViewLink }}",
            "Name": "={{ $('Edit Fields').item.json.BookingData.Name }}",
            "Return_date": "={{ $('Edit Fields').item.json.BookingData.Return_date }}",
            "Childrens_Ages": "={{ $('Edit Fields').item.json.BookingData.Childrens_Ages }}",
            "Origin": "={{ $('Edit Fields').item.json.BookingData.Origin }}",
            "Departure_date": "={{ $('Edit Fields').item.json.BookingData.Departure_date }}",
            "Stopovers": "={{ $('Edit Fields').item.json.BookingData.Stopovers || false }}",
            "Luggage": "={{ $('Edit Fields').item.json.BookingData.Luggage || false }}",
            "Payload": "={{ $('Get PDF').item.json.document.payload }}",
            "Flight_Destination": "={{ $('Edit Fields').item.json.BookingData.Flight_Destination }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}",
            "Refundable": "=",
            "Transfers": "={{ $('Edit Fields').item.json.BookingData.Transfers || 0 }}",
            "Travel_Assistance": "="
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
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Hotel_Destination",
              "displayName": "Hotel_Destination",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Room_Only",
              "displayName": "Room_Only",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "removed": true
            },
            {
              "id": "Breakfast_Included",
              "displayName": "Breakfast_Included",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
            },
            {
              "id": "All_Inclusive",
              "displayName": "All_Inclusive",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Pdf_link",
              "displayName": "Pdf_link",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Payload",
              "displayName": "Payload",
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
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        448,
        -1296
      ],
      "id": "71634a42-5277-4717-9de6-4754fb523122",
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
        0,
        -1296
      ],
      "id": "d3684a22-0e4e-4ed2-907a-c2accec9d77c",
      "name": "Google Sheets1",
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
                    "leftValue": "={{ $json.intent }}",
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
                    "leftValue": "={{ $json.intent }}",
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
                    "leftValue": "={{ $json.intent }}",
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
        -528,
        -416
      ],
      "id": "adb8fac2-9912-4017-84bf-61ccdf26c393",
      "name": "Switch1"
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
        -736,
        -416
      ],
      "id": "1ab75887-b69c-4c76-9052-9f8bd6920584",
      "name": "Get Intent"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('Switch').item.json.contacts[0].wa_id }}\",\n  \"type\": \"interactive\",\n  \"interactive\": {\n    \"type\": \"button\",\n    \"header\": {\n      \"type\": \"text\",\n      \"text\": \"Opciones\"\n    },\n    \"body\": {\n      \"text\": \"¿Qué te gustaría hacer?\"\n    },\n    \"action\": {\n      \"buttons\": [\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"Booking\",\n            \"title\": \"Reservar\"\n          }\n        },\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"priceUpdate\",\n            \"title\": \"Actualizar precio\"\n          }\n        }\n      ]\n    }\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -304,
        32
      ],
      "id": "a1d1d0ee-cf8f-40f7-b1ee-a2daca127dd4",
      "name": "HTTP Request2",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
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
        240,
        -16
      ],
      "id": "094fe839-3634-4a77-9e15-aeac515d873f",
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
        528,
        208
      ],
      "id": "2ae76764-7678-4b51-ab33-e4ae8a65dc14",
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
        224,
        208
      ],
      "id": "e1f4f3c0-2ae8-4ac8-add4-3c7dd5159454",
      "name": "OpenAI Chat Model1",
      "credentials": {
        "openAiApi": {
          "id": "wOHaMLW8yduV0Uay",
          "name": "OpenAi account"
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
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.id }}",
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
        -1136,
        -1488
      ],
      "id": "fc5e932d-7fef-4e04-a044-828d6d8a253a",
      "name": "Switch2"
    },
    {
      "parameters": {
        "fileSelector": "=Vuelo_{{ $json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        -544,
        -1840
      ],
      "id": "76843404-f708-434d-9f06-e04ace5ee46b",
      "name": "Read from Disk"
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
        -304,
        -448
      ],
      "id": "e4f15614-d561-4f1d-9f76-0a69dd10a167",
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
        -304,
        -224
      ],
      "id": "ebe68494-3b08-43a4-9faa-728e5db060dd",
      "name": "Set Prompt5"
    },
    {
      "parameters": {},
      "type": "@n8n/n8n-nodes-langchain.toolThink",
      "typeVersion": 1,
      "position": [
        384,
        208
      ],
      "id": "684b37aa-47ce-4c7d-a97d-5ea8dd83d585",
      "name": "Think1"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
        "textBody": "=Por favor, envíeme todos los detalles de la reserva en un solo mensaje.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        -544,
        -1488
      ],
      "id": "29b0c3da-4cc8-4f31-8ad9-c3d00d9267ac",
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
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
        "textBody": "=Por favor, envíeme el enlace del PDF y el nuevo precio para continuar en un solo mensaje.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        -544,
        -1088
      ],
      "id": "ffc2f1da-cb32-4815-b42e-b86671bff978",
      "name": "WhatsApp Business Cloud2",
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
                    "id": "21eebe14-c354-4a91-89d8-3ed57041d7b7",
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.title === \"Elegir vuelo\" || $json.messages[0].interactive.button_reply.title === \"Elegir Hotel\" }}",
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
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.title }}",
                    "rightValue": "Select Hotel",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "15be7c02-dc8a-4932-ab7f-67b1482c7988"
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
                    "id": "6428eae0-15bd-4245-ab5f-065dbff0814a",
                    "leftValue": "={{ $json.messages[0].interactive.button_reply.title }}",
                    "rightValue": "Select Vuelo",
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
        -800,
        -2016
      ],
      "id": "611b56fb-39d8-4419-bd63-7ed82171bde1",
      "name": "Switch3"
    },
    {
      "parameters": {
        "operation": "fromJson",
        "options": {}
      },
      "type": "n8n-nodes-base.extractFromFile",
      "typeVersion": 1,
      "position": [
        -320,
        -2016
      ],
      "id": "697f81ef-ef20-4598-b531-157d20f838e3",
      "name": "Extract from File1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "18ca49c5-2de0-4d28-8b63-97a1e4364e53",
              "name": "Hotels",
              "value": "={{ $json.data[0].Hotels }}",
              "type": "array"
            },
            {
              "id": "8d2b672d-dcde-4810-9e3c-0d717dc30919",
              "name": "SelectedCount",
              "value": "={{ $json.data[0].SelectedCount + 1 }}",
              "type": "number"
            },
            {
              "id": "df473f22-25f5-4755-a103-253a0c100050",
              "name": "FirstSelection",
              "value": "={{ $json.data[0].SelectedCount === 0 ? $json.data[0].Hotels[$('Switch').item.json.messages[0].interactive.button_reply.id] : $json.data[0].FirstSelection }}",
              "type": "string"
            },
            {
              "id": "2c18576a-3f49-4980-b4e1-e21e4d816eb7",
              "name": "SecondSelection",
              "value": "={{ $json.data[0].SelectedCount === 1 ? $json.data[0].Hotels[$('Switch').item.json.messages[0].interactive.button_reply.id] : $json.data[0].SecondSelection }}",
              "type": "string"
            },
            {
              "id": "6a7ea907-433d-487b-8c1a-310f5ec74a82",
              "name": "BookingData",
              "value": "={{ $json.data[0].BookingData }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -96,
        -2016
      ],
      "id": "248ce353-6778-43fc-b46d-f025a6eda93d",
      "name": "Edit Fields2"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        128,
        -2016
      ],
      "id": "17ba9caa-6fde-46e9-98ad-0b6125b17871",
      "name": "Convert to File1"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=Hotel_{{ $('Switch').item.json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        368,
        -2016
      ],
      "id": "74a7a869-dda0-49e3-b797-9c6fcce829e4",
      "name": "Read/Write Files from Disk"
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
              "id": "50f60728-2bf1-46ce-8123-a5e9a74e3d9c",
              "leftValue": "={{ $('Edit Fields2').item.json.SelectedCount }}",
              "rightValue": 2,
              "operator": {
                "type": "number",
                "operation": "equals"
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
        560,
        -2016
      ],
      "id": "5fdc41a1-104a-46b4-b10f-cc23b4306e52",
      "name": "If4"
    },
    {
      "parameters": {
        "fileSelector": "=Hotel_{{ $json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        -544,
        -2016
      ],
      "id": "0577cca2-72bc-4b50-a36a-4050dab6e63f",
      "name": "Read from Disk1"
    },
    {
      "parameters": {
        "jsCode": "function buildSelectedHotels() {\n  const bookingData = $input.first().json.BookingData\n  const hotel1 = $input.first().json.First\n  const hotel2 = $input.first().json.Second\n\n  const checkin = bookingData.Check_In_Date;\n  const checkout = bookingData.Check_Out_Date;\n  const adults = bookingData.Num_Adults || 0;\n  const childrens = bookingData.Num_Children || 0;\n  const travel_assistance = bookingData.Travel_Assistance || 0;\n  const transfers = bookingData.Transfers || 0;\n\n  const best_hotels = [\n    {\n      name: hotel1.name,\n      stars: hotel1.stars,\n      location: hotel1.location,\n      price: hotel1.price,\n      link: hotel1.url\n    },\n    {\n      name: hotel2.name,\n      stars: hotel2.stars,\n      location: hotel2.location,\n      price: hotel2.price,\n      link: hotel2.url\n    }\n  ];\n\n  return [{\n    json: {\n      best_hotels: best_hotels,\n      checkin: checkin,\n      checkout: checkout,\n      adults: adults,\n      childrens: childrens,\n      travel_assistance: travel_assistance,\n      transfers: transfers\n    }\n  }];\n}\n\n// Call the function\nreturn buildSelectedHotels();\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1008,
        -2016
      ],
      "id": "3fa7f7c6-7015-4d88-8a3e-7b30fed30081",
      "name": "Code1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "e556d0fc-2858-4d6d-b4db-15e453ec9833",
              "name": "First",
              "value": "={{ $('Edit Fields2').item.json.FirstSelection }}",
              "type": "object"
            },
            {
              "id": "e4ad0123-ffb1-42ed-96fd-ea0280eb92e0",
              "name": "Second",
              "value": "={{ $('Edit Fields2').first().json.SecondSelection }}",
              "type": "object"
            },
            {
              "id": "e96f8e43-caf1-4f22-9d88-84958b0282dd",
              "name": "BookingData",
              "value": "={{ $('Edit Fields2').item.json.BookingData }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        784,
        -2016
      ],
      "id": "7e791779-0dbd-4673-b52d-f3244acfe817",
      "name": "Edit Fields4"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.pdfmonkey.io/api/v1/documents",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document\": {\n    \"document_template_id\": \"CFE4B8AE-0377-4B18-9A20-01134D51A108\",\n     \"status\": \"pending\",\n    \"payload\": {{ $json.toJsonString() }}\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1232,
        -2016
      ],
      "id": "d17a7c51-2fcc-42a0-9cfa-68d50ffb95f7",
      "name": "Create PDF3",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "url": "={{ $json.document.download_url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1744,
        -1088
      ],
      "id": "1bf21d04-4af2-4171-8f9d-39c4bcd71b5d",
      "name": "HTTP Request5"
    },
    {
      "parameters": {
        "name": "=Hotel_{{ $now.format('yyyy-MM-dd') }}",
        "driveId": {
          "__rl": true,
          "mode": "list",
          "value": "My Drive"
        },
        "folderId": {
          "__rl": true,
          "value": "1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN",
          "mode": "list",
          "cachedResultName": "PDF",
          "cachedResultUrl": "https://drive.google.com/drive/folders/1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        1184,
        -1088
      ],
      "id": "80313dba-d04f-4ca7-ae8c-de78205354c0",
      "name": "Google Drive4",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "operation": "share",
        "fileId": {
          "__rl": true,
          "value": "={{ $json.id }}",
          "mode": "id"
        },
        "permissionsUi": {
          "permissionsValues": {
            "role": "reader",
            "type": "anyone"
          }
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        960,
        -1088
      ],
      "id": "002f6b0a-37c7-4806-ba9f-596fc2c5f80d",
      "name": "Google Drive5",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}\",\n  \"type\": \"text\",\n  \"text\": {\n    \"preview_url\": true,\n    \"body\": \"Como solicitó, aquí tiene el enlace al PDF: {{ $('Google Drive4').item.json.webViewLink }}\"\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        752,
        -1088
      ],
      "id": "a14601bb-9067-4d8b-8a4c-4f72158a8f6c",
      "name": "HTTP Request6",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "listId": "67f4c5ec5c4fe13afd91b77f",
        "name": "=🙋‍♂️ {{ $json.Name }}",
        "description": "=✈️ Travel Type: {{ $json.Travel_Type }}\n🏨 Hotel Destination: {{ $json.Hotel_Destination }}\n\n🏨 Check-In Date: {{ $json.Check_In_Date }}\n🏨 Check-Out Date: {{ $json.Check_Out_Date }}\n\n👨‍👩‍👧‍👦 Number of Adults: {{ $json.Num_Adults }}\n🧒 Number of Children: {{ $json.Num_Children || 0 }}\n🎈 Children's Ages: {{ $json.Childrens_Ages || \"-\" }}\n\n🏠 Room Only: {{ $json.Room_Only }}\n💸 Refundable: {{ $json.Refundable }}\n🍽️ Half Board: {{ $json.Half_Board }}\n🥐 Breakfast Included: {{ $json.Breakfast_Included }}\n🍹 All Inclusive: {{ $json.All_Inclusive }}\n\n🛡️ Travel Assistance: {{ $json.Travel_Assistance || 0 }}\n🚐 Transfers: {{ $json.Transfers || 0 }}\n\n📄 PDF: {{ $json.Pdf_link }}",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.trello",
      "typeVersion": 1,
      "position": [
        240,
        -1088
      ],
      "id": "5104d06b-0966-42ea-88c5-204fca581d74",
      "name": "Trello2",
      "credentials": {
        "trelloApi": {
          "id": "2txCzzpBpfqLUX0k",
          "name": "Trello account"
        }
      }
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
          "value": 2113820245,
          "mode": "list",
          "cachedResultName": "scrapped",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=2113820245"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Phone": "={{ $('Edit Fields2').item.json.BookingData.Phone }}",
            "Contact_Id": "={{ $('Edit Fields2').item.json.BookingData.Contact_Id }}",
            "Travel_Type": "={{ $('Edit Fields2').item.json.BookingData.Travel_Type }}",
            "Num_Adults": "={{ $('Edit Fields2').item.json.BookingData.Num_Adults }}",
            "Num_Children": "={{ $('Edit Fields2').item.json.BookingData.Num_Children }}",
            "Pdf_link": "={{ $('Google Drive4').item.json.webViewLink }}",
            "Name": "={{ $('Edit Fields2').item.json.BookingData.Name }}",
            "Return_date": "={{ $('Edit Fields2').item.json.BookingData.Return_date }}",
            "Childrens_Ages": "={{ $('Edit Fields2').item.json.BookingData.Childrens_Ages }}",
            "Origin": "={{ $('Edit Fields2').item.json.BookingData.Origin }}",
            "Departure_date": "={{ $('Edit Fields2').item.json.BookingData.Departure_date }}",
            "Payload": "={{ $('Get PDF2').item.json.document.payload }}",
            "Hotel_Destination": "={{ $('Edit Fields2').item.json.BookingData.Hotel_Destination }}",
            "Flight_Destination": "={{ $('Edit Fields2').item.json.BookingData.Flight_Destination }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}",
            "Room_Only": "=",
            "Half_Board": "=",
            "Refundable": "=",
            "Breakfast_Included": "=",
            "Travel_Assistance": "=",
            "All_Inclusive": "=",
            "Transfers": "={{ $('Edit Fields2').item.json.BookingData.Transfers || 0 }}"
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
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Stopovers",
              "displayName": "Stopovers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
            },
            {
              "id": "Luggage",
              "displayName": "Luggage",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Pdf_link",
              "displayName": "Pdf_link",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Payload",
              "displayName": "Payload",
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
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        464,
        -1088
      ],
      "id": "1454bff5-d00f-4dd5-956d-f738ff376cbf",
      "name": "Google Sheets5",
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
        0,
        -1088
      ],
      "id": "4f9510b9-7f93-4fbd-8bff-6bf9704423aa",
      "name": "Google Sheets6",
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
        "url": "=https://api.pdfmonkey.io/api/v1/documents/{{ $json.document.id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1744,
        -2016
      ],
      "id": "147dd1d6-c762-4612-9080-4abf2e1a077d",
      "name": "Get PDF2",
      "retryOnFail": true,
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "success",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1744,
        -1728
      ],
      "id": "9861efee-add0-472a-a249-59cb7fecc8c6",
      "name": "If8"
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "failure",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1744,
        -1376
      ],
      "id": "163817e8-7684-4bc9-ba59-d71d60f86ac4",
      "name": "If9"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "18ca49c5-2de0-4d28-8b63-97a1e4364e53",
              "name": "Flights",
              "value": "={{ $json.data[0].Flights }}",
              "type": "array"
            },
            {
              "id": "8d2b672d-dcde-4810-9e3c-0d717dc30919",
              "name": "SelectedCount",
              "value": "={{ $json.data[0].SelectedCount + 1 }}",
              "type": "number"
            },
            {
              "id": "df473f22-25f5-4755-a103-253a0c100050",
              "name": "FirstSelection",
              "value": "={{ $json.data[0].SelectedCount === 0 ? $json.data[0].Flights[$('Switch').item.json.messages[0].interactive.button_reply.id] : $json.data[0].FirstSelection }}",
              "type": "string"
            },
            {
              "id": "2c18576a-3f49-4980-b4e1-e21e4d816eb7",
              "name": "SecondSelection",
              "value": "={{ $json.data[0].SelectedCount === 1 ? $json.data[0].Flights[$('Switch').item.json.messages[0].interactive.button_reply.id] : $json.data[0].SecondSelection }}",
              "type": "string"
            },
            {
              "id": "6a7ea907-433d-487b-8c1a-310f5ec74a82",
              "name": "BookingData",
              "value": "={{ $json.data[0].BookingData }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -96,
        -1840
      ],
      "id": "63fad2b3-56e9-4a4d-bca6-225a00571c49",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "content": "Enruta los mensajes según el tipo: respuestas de botones interactivos vs. mensajes de texto.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -1776,
        -1216
      ],
      "typeVersion": 1,
      "id": "2f9535a8-4f85-4c4e-90a0-bebaf3c0b821",
      "name": "Routing Note"
    },
    {
      "parameters": {
        "content": "Flujo Interactivo:\n\nManeja las selecciones de botones para reservas y actualizaciones de precio",
        "height": 660,
        "width": 400
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -800,
        -1584
      ],
      "typeVersion": 1,
      "id": "9de436e4-dd8d-4818-9be5-67312b92aa93",
      "name": "Interactive Flow Note"
    },
    {
      "parameters": {
        "content": "Enruta las respuestas interactivas: selecciones numéricas vs. acciones nombradas (Booking/priceUpdate).",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -1184,
        -1616
      ],
      "typeVersion": 1,
      "id": "e62b21c9-83eb-420e-91f4-51f50d734b77",
      "name": "Interactive Routing Note"
    },
    {
      "parameters": {
        "content": "1. SELECTION TRACKING\n\nGestiona las selecciones de usuario para vuelos y hoteles y genera PDFs.\n\n",
        "height": 740,
        "width": 2520
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -576,
        -2384
      ],
      "typeVersion": 1,
      "id": "df39899d-d715-456e-91ee-abf075e35223",
      "name": "Selection Tracking Note"
    },
    {
      "parameters": {
        "content": "TEXT MESSAGE FLOW: Processes natural language for booking or price updates",
        "height": 300,
        "width": 400
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -784,
        -224
      ],
      "typeVersion": 1,
      "id": "0224659e-3c6d-48a4-9d59-af32d4fe55cb",
      "name": "Text Flow Note"
    },
    {
      "parameters": {
        "content": "Obtiene el intent actual del usuario (Booking, priceUpdate, neutral) desde el Intent Setter.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -800,
        -560
      ],
      "typeVersion": 1,
      "id": "8edf2cff-10f6-4d5b-86b2-dec90e124a46",
      "name": "Intent Retrieval Note"
    },
    {
      "parameters": {
        "content": "Routes based on intent: Booking extraction, Price update, or Options menu",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -560,
        -560
      ],
      "typeVersion": 1,
      "id": "6574683a-acc5-478a-838f-1976611fd733",
      "name": "Intent Routing Note"
    },
    {
      "parameters": {
        "content": "BOOKING AI: Extracts travel data and saves to Google Sheets with AI agent",
        "height": 440,
        "width": 680
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        112,
        -704
      ],
      "typeVersion": 1,
      "id": "d549f4cc-c202-4daf-a5b1-89aaef20ca11",
      "name": "Booking AI Note"
    },
    {
      "parameters": {
        "content": "PIPELINE DE GENERACIÓN DE PDF:\n\nCrea, descarga y comparte PDFs a través de Google Drive.\n",
        "height": 600,
        "width": 720
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        640,
        -1456
      ],
      "typeVersion": 1,
      "id": "8c0eb253-db07-413b-8215-30dc87f5c455",
      "name": "PDF Pipeline Note"
    },
    {
      "parameters": {
        "content": "3. DATA PERSISTENCE & PDF GENERATION PIPELINE\n\nGuarda los datos de reserva en hojas de cálculo, crea tarjetas en Trello y limpia recursos; además, crea, descarga y comparte los PDFs a través de Google Drive.",
        "height": 600,
        "width": 720
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -96,
        -1456
      ],
      "typeVersion": 1,
      "id": "11e659bf-b028-4bb4-a6a7-1f3cc7c181a7",
      "name": "Data Persistence Note"
    },
    {
      "parameters": {
        "content": "INTENT MANAGEMENT: Sets and resets user intents for conversation state",
        "height": 340
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1200,
        -544
      ],
      "typeVersion": 1,
      "id": "3f3dad7f-0bf1-45a3-8d0e-389cbc311228",
      "name": "Intent Management Note"
    },
    {
      "parameters": {
        "operation": "fromJson",
        "options": {}
      },
      "type": "n8n-nodes-base.extractFromFile",
      "typeVersion": 1,
      "position": [
        -320,
        -2224
      ],
      "id": "402053d6-cf95-4bd9-872e-91d24612a329",
      "name": "Extract from File2"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "c651d506-9378-4c32-8c79-414fa7cef5b0",
              "name": "FlightsSelected",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir vuelo\" && $json.data[0].FlightsSelected < 2 ? $json.data[0].FlightsSelected + 1 : $json.data[0].FlightsSelected}}",
              "type": "number"
            },
            {
              "id": "a59782b4-2dbf-415f-8ea7-319bd77569d3",
              "name": "HotelsSelected",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir Hotel\" && $json.data[0].HotelsSelected < 2 ?$json.data[0].HotelsSelected + 1 : $json.data[0].HotelsSelected}}",
              "type": "number"
            },
            {
              "id": "f1748700-f988-43d0-a885-73b4a6afc379",
              "name": "First",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir vuelo\" && $json.data[0].FlightsSelected === 0 ? $json.data[0].Flights[$('Switch3').item.json.messages[0].interactive.button_reply.id]:$json.data[0].First }}",
              "type": "string"
            },
            {
              "id": "cf7175e9-b099-4281-b572-f11475cdf17d",
              "name": "Second",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir vuelo\" && $json.data[0].FlightsSelected === 1 ? $json.data[0].Flights[$('Switch3').item.json.messages[0].interactive.button_reply.id]:$json.data[0].Second }}",
              "type": "string"
            },
            {
              "id": "bd20fa14-e686-4add-b215-6a2f1b71b05d",
              "name": "Third",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir Hotel\" && $json.data[0].HotelsSelected === 0 ? $json.data[0].Hotels[$('Switch3').item.json.messages[0].interactive.button_reply.id]:$json.data[0].Third }}",
              "type": "string"
            },
            {
              "id": "05511392-719e-46d2-a131-7ed1d2e2a4ee",
              "name": "Fourth",
              "value": "={{ $('Switch3').item.json.messages[0].interactive.button_reply.title === \"Elegir Hotel\" && $json.data[0].HotelsSelected === 1 ? $json.data[0].Hotels[$('Switch3').item.json.messages[0].interactive.button_reply.id]:$json.data[0].Fourth }}",
              "type": "string"
            },
            {
              "id": "bc36ada8-6024-4526-870d-588c12ee8215",
              "name": "BookingData",
              "value": "={{ $json.data[0].BookingData }}",
              "type": "object"
            },
            {
              "id": "8d3e8ebb-b985-42f9-9d8f-e2b71ed3bf51",
              "name": "Flights",
              "value": "={{ $json.data[0].Flights }}",
              "type": "array"
            },
            {
              "id": "c3bc0b08-94a6-42d8-b90e-1ba7e868ddb8",
              "name": "Hotels",
              "value": "={{ $json.data[0].Hotels }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -96,
        -2224
      ],
      "id": "a8187b96-df4f-4111-8147-c9cabcda6fb5",
      "name": "Edit Fields3"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        128,
        -2224
      ],
      "id": "e37caf35-3dac-47cc-8b38-619541a84d61",
      "name": "Convert to File2"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=Ambos_{{ $('Switch').item.json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        368,
        -2224
      ],
      "id": "1f87e94f-9e4a-453c-acce-60cd6c067e2a",
      "name": "Read/Write Files from Disk2"
    },
    {
      "parameters": {
        "fileSelector": "=Ambos_{{ $('Switch3').item.json.contacts[0].wa_id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        -544,
        -2224
      ],
      "id": "8472545d-2c71-4dc7-bcbc-7a45b582d46f",
      "name": "Read from Disk2"
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
              "id": "50f60728-2bf1-46ce-8123-a5e9a74e3d9c",
              "leftValue": "={{ $('Edit Fields3').item.json.FlightsSelected }}",
              "rightValue": 1,
              "operator": {
                "type": "number",
                "operation": "equals"
              }
            },
            {
              "id": "91f67716-db2c-4d9b-83c1-47bd169b97c3",
              "leftValue": "={{ $('Edit Fields3').item.json.HotelsSelected }}",
              "rightValue": 2,
              "operator": {
                "type": "number",
                "operation": "equals"
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
        560,
        -2224
      ],
      "id": "b1c6129e-3b7e-483b-9a2e-99d25f675729",
      "name": "If7"
    },
    {
      "parameters": {
        "jsCode": "function parseInputJson(value) {\n  try {\n    return JSON.parse(value);\n  } catch {\n    return null;\n  }\n}\n\nfunction toStringOrNull(v) {\n  if (v === undefined || v === null) return null;\n  return String(v);\n}\n\n/* ---------- MAIN EXECUTION ---------- */\nconst raw = $('Edit Fields3').first().json;\nconst bookingData = raw.BookingData || {};\n\n// Inputs: First = flight, Third & Fourth = hotels\nconst flight = parseInputJson(raw.First);\nconst hotel1 = parseInputJson(raw.Third);\nconst hotel2 = parseInputJson(raw.Fourth);\n\n// Booking info\nconst departure_date = bookingData.Departure_date || null;\nconst return_date = bookingData.Return_date || null;\nconst checkin = bookingData.Check_In_Date || null;\nconst checkout = bookingData.Check_Out_Date || null;\nconst adults = parseInt(bookingData.Num_Adults || 0);\nconst childrens = parseInt(bookingData.Num_Children || 0);\nconst travel_assistance = parseInt(bookingData.Travel_Assistance || 0);\nconst transfers = parseInt(bookingData.Transfers || 0);\n\n// Currency fallback\nconst fallbackCurrency = bookingData.Currency || \"USD\";\n\n// ---- Build flight (single) ----\nlet selected_flights = [];\nif (flight) {\n  const airlineCode = flight.airline?.code || flight.airlineCode || flight.airline_code || null;\n  const airlineName = flight.airline?.name || flight.airlineName || flight.airline || null;\n\n  const priceAmount =\n    (typeof flight.price === \"object\" && flight.price?.amount != null)\n      ? toStringOrNull(flight.price.amount)\n      : toStringOrNull(flight.price);\n\n  const priceCurrency =\n    (typeof flight.price === \"object\" && flight.price?.currency)\n      ? flight.price.currency\n      : fallbackCurrency;\n\n  selected_flights = [\n    {\n      airline: {\n        code: airlineCode,\n        name: airlineName\n      },\n      legs: Array.isArray(flight.legs) ? flight.legs : [],\n      price: {\n        amount: priceAmount,\n        currency: priceCurrency\n      },\n      departure_date,\n      return_date,\n      luggage: !!bookingData.Luggage,\n      adults,\n      childrens\n    }\n  ];\n}\n\n// ---- Build hotels (third + fourth) ----\nlet best_hotels = [];\n[hotel1, hotel2].forEach(hotel => {\n  if (hotel) {\n    const hotelPrice =\n      (typeof hotel.price === \"object\" && hotel.price?.amount != null)\n        ? toStringOrNull(hotel.price.amount)\n        : toStringOrNull(hotel.price);\n\n    best_hotels.push({\n      name: hotel.name || null,\n      stars: hotel.stars != null ? hotel.stars : null,\n      location: hotel.location || null,\n      price: hotelPrice,\n      link: hotel.url || hotel.link || null\n    });\n  }\n});\n\n// ---- Output EXACT schema ----\nreturn [\n  {\n    json: {\n      selected_flights,\n      best_hotels,\n      checkin,\n      checkout,\n      adults,\n      childrens,\n      travel_assistance,\n      transfers\n    }\n  }\n];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1008,
        -2240
      ],
      "id": "dcae93cd-8b72-46d5-a672-6eed60564990",
      "name": "Code2"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.pdfmonkey.io/api/v1/documents",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document\": {\n    \"document_template_id\": \"3E8394AC-84D4-4286-A1CD-A12D1AB001D5\",\n     \"status\": \"pending\",\n    \"payload\": {{ $json.toJsonString() }}\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1232,
        -2240
      ],
      "id": "88642cf4-7bea-4b56-ace4-83626b335049",
      "name": "Create PDF",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "url": "={{ $json.document.download_url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        2000,
        -1408
      ],
      "id": "ec7fe3ba-8020-4f62-a8db-113da3dbea02",
      "name": "HTTP Request7"
    },
    {
      "parameters": {
        "url": "=https://api.pdfmonkey.io/api/v1/documents/{{ $json.document.id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        2000,
        -2240
      ],
      "id": "d618d3ef-202d-4a1e-903a-60d5f702d488",
      "name": "Get PDF3",
      "alwaysOutputData": false,
      "retryOnFail": true,
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "success",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        2000,
        -1904
      ],
      "id": "6816255a-ecd3-40a4-99aa-dbb948d58e75",
      "name": "If10"
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "failure",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        2000,
        -1648
      ],
      "id": "c6fca629-b53b-4a86-b54c-397eae080f10",
      "name": "If11"
    },
    {
      "parameters": {
        "name": "=Ambos_{{ $now.format('yyyy-MM-dd') }}",
        "driveId": {
          "__rl": true,
          "mode": "list",
          "value": "My Drive"
        },
        "folderId": {
          "__rl": true,
          "value": "1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN",
          "mode": "list",
          "cachedResultName": "PDF",
          "cachedResultUrl": "https://drive.google.com/drive/folders/1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        2000,
        -1120
      ],
      "id": "96b4c5ef-3258-4bdd-9779-c992be1f856d",
      "name": "Google Drive6",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "operation": "share",
        "fileId": {
          "__rl": true,
          "value": "={{ $json.id }}",
          "mode": "id"
        },
        "permissionsUi": {
          "permissionsValues": {
            "role": "reader",
            "type": "anyone"
          }
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        2000,
        -848
      ],
      "id": "d06396ce-f2eb-4c60-b9d7-e832469c8f4e",
      "name": "Google Drive7",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}\",\n  \"type\": \"text\",\n  \"text\": {\n    \"preview_url\": true,\n    \"body\": \"Como solicitó, aquí tiene el enlace al PDF: {{ $('Google Drive6').item.json.webViewLink }}\"\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1744,
        -848
      ],
      "id": "b9c54b34-e85f-4bd3-b640-3203e92c9394",
      "name": "HTTP Request8",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "listId": "67f4c5ec5c4fe13afd91b77f",
        "name": "=🙋‍♂️ {{ $json.Name }}",
        "description": "=✈️ Travel Type: {{ $json.Travel_Type }}\n🛫 Origin: {{ $json.Origin }}\n🏨 Hotel Destination: {{ $json.Hotel_Destination }}\n🛬 Flight Destination: {{ $json.Flight_Destination }}\n\n📅 Departure Date: {{ $json.Departure_date }}\n🏨 Check-In Date: {{ $json.Check_In_Date }}\n📅 Return Date: {{ $json.Return_date || \"-\"}}\n🏨 Check-Out Date: {{ $json.Check_Out_Date }}\n\n👨‍👩‍👧‍👦 Number of Adults: {{ $json.Num_Adults }}\n🧒 Number of Children: {{ $json.Num_Children || 0}}\n🎈 Children's Ages: {{ $json.Childrens_Ages || \"-\"}}\n\n🛑 Stopovers: {{ $json.Stopovers }}\n🧳 Luggage: {{ $json.Luggage }}\n\n🏠 Room Only: {{ $json.Room_Only }}\n💸 Refundable: {{ $json.Refundable }}\n🍽️ Half Board: {{ $json.Half_Board }}\n🥐 Breakfast Included: {{ $json.Breakfast_Included }}\n🍹 All Inclusive: {{ $json.All_Inclusive }}\n\n🛡️ Travel Assistance: {{ $json.Travel_Assistance || 0 }}\n🚐 Transfers: {{ $json.Transfers || 0}}\n\n📄 PDF: {{ $json.Pdf_link }}",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.trello",
      "typeVersion": 1,
      "position": [
        1312,
        -848
      ],
      "id": "d56ae08c-a2dc-4945-b6df-a95b00486d06",
      "name": "Trello3",
      "credentials": {
        "trelloApi": {
          "id": "2txCzzpBpfqLUX0k",
          "name": "Trello account"
        }
      }
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
          "value": 2113820245,
          "mode": "list",
          "cachedResultName": "scrapped",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=2113820245"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Phone": "={{ $('Edit Fields3').item.json.BookingData.Phone }}",
            "Contact_Id": "={{ $('Edit Fields3').item.json.BookingData.Contact_Id }}",
            "Travel_Type": "=Ambos",
            "Num_Adults": "={{ $('Edit Fields3').item.json.BookingData.Num_Adults }}",
            "Num_Children": "={{ $('Edit Fields3').item.json.BookingData.Num_Children }}",
            "Pdf_link": "={{ $('Google Drive6').item.json.webViewLink }}",
            "Name": "={{ $('Edit Fields3').item.json.BookingData.Name }}",
            "Return_date": "={{ $('Edit Fields3').item.json.BookingData.Return_date}}",
            "Childrens_Ages": "={{ $('Edit Fields3').item.json.BookingData.Childrens_Ages }}",
            "Origin": "={{ $('Edit Fields3').item.json.BookingData.Origin }}",
            "Departure_date": "={{ $('Edit Fields3').item.json.BookingData.Departure_date }}",
            "Payload": "={{ $('Get PDF3').item.json.document.payload }}",
            "Hotel_Destination": "={{ $('Edit Fields3').item.json.BookingData.Hotel_Destination }}",
            "Flight_Destination": "={{ $('Edit Fields3').item.json.BookingData.Flight_Destination }}",
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}",
            "Room_Only": "={{ $('Edit Fields3').item.json.BookingData.Room_Only || false }}",
            "Refundable": "={{ $('Edit Fields3').item.json.BookingData.Refundable || false }}",
            "Half_Board": "={{ $('Edit Fields3').item.json.BookingData.Half_Board || false }}",
            "Breakfast_Included": "={{ $('Edit Fields3').item.json.BookingData.Breakfast_Included || false }}",
            "All_Inclusive": "={{ $('Edit Fields3').item.json.BookingData.All_Inclusive || false }}",
            "Travel_Assistance": "={{ $('Edit Fields3').item.json.BookingData.Travel_Assistance || 0 }}",
            "Transfers": "={{ $('Edit Fields3').item.json.BookingData.Transfers || 0 }}"
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
              "canBeUsedToMatch": true,
              "removed": false
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
              "id": "Check_In_Date",
              "displayName": "Check_In_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Check_Out_Date",
              "displayName": "Check_Out_Date",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Stopovers",
              "displayName": "Stopovers",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
            },
            {
              "id": "Luggage",
              "displayName": "Luggage",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": true
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
              "id": "Pdf_link",
              "displayName": "Pdf_link",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "type": "string",
              "canBeUsedToMatch": true,
              "removed": false
            },
            {
              "id": "Payload",
              "displayName": "Payload",
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
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        1504,
        -848
      ],
      "id": "84b7d770-e722-4459-a237-b8260e0d9f3b",
      "name": "Google Sheets7",
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
        1120,
        -848
      ],
      "id": "7efb31ef-d2e2-4346-a870-8e7a86a2e00b",
      "name": "Google Sheets8",
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
        "descriptionType": "manual",
        "toolDescription": "=Purpose:\nCall this tool (only when user just want Flight) to add a new row of Flight data to a Google Sheet. (Do not Use this If travel type is Ambos)\n\nWhen to use:\nAfter collecting and confirming all required information from the user for a Vuelo.",
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
          "value": "gid=0",
          "mode": "list",
          "cachedResultName": "Flights",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=0"
        },
        "columns": {
          "mappingMode": "defineBelow",
          "value": {
            "Name": "={{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }}",
            "Phone": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
            "Contact_Id": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
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
        400,
        -400
      ],
      "id": "1e6a4a18-9c05-4643-85d6-0c68f03b35e3",
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
            "Name": "={{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }}",
            "Phone": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
            "Contact_Id": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
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
        688,
        -400
      ],
      "id": "67bf5c28-06f9-421e-af34-29fa565f8646",
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
        1280,
        -368
      ],
      "id": "e29ff212-6cbb-439f-881f-78424a1ac826",
      "name": "Set Neutral"
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
        -768,
        -1488
      ],
      "id": "f22f483b-5b7c-4793-ada2-98ac130f842c",
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
        -768,
        -1088
      ],
      "id": "f9c5ff04-8ec2-4495-93ea-503b495c19e9",
      "name": "Set Price Update"
    },
    {
      "parameters": {
        "inputSource": "passthrough"
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -2000,
        -1088
      ],
      "id": "c0c9468e-fd10-406b-8f61-81a381ebbb95",
      "name": "WhatsApp Trigger"
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
            "Name": "={{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }}",
            "Phone": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
            "Contact_Id": "={{ $('WhatsApp Trigger').item.json.contacts[0].wa_id }}",
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
        544,
        -400
      ],
      "id": "5bce4d79-e32e-458e-9919-2a75f0c4442c",
      "name": "Add Hotels",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    }
  ],
  "connections": {
    "AI Agent": {
      "main": [
        [
          {
            "node": "WhatsApp Business Cloud",
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
    "WhatsApp Business Cloud": {
      "main": [
        [
          {
            "node": "Set Neutral",
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
        ]
      ]
    },
    "Extract from File": {
      "main": [
        [
          {
            "node": "Edit Fields",
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
            "node": "Create PDF1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields1": {
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
    "Create PDF1": {
      "main": [
        [
          {
            "node": "Get PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get PDF": {
      "main": [
        [
          {
            "node": "If2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Google Drive",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive": {
      "main": [
        [
          {
            "node": "Google Drive1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive1": {
      "main": [
        [
          {
            "node": "HTTP Request1",
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
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "If3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If3": {
      "main": [
        [],
        [
          {
            "node": "Get PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk1": {
      "main": [
        [
          {
            "node": "If1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If1": {
      "main": [
        [
          {
            "node": "Edit Fields1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request1": {
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
    "Trello": {
      "main": [
        [
          {
            "node": "Google Sheets1",
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
            "node": "Trello",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets1": {
      "main": [
        []
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
            "node": "HTTP Request2",
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
            "node": "Switch1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request2": {
      "main": [
        []
      ]
    },
    "AI Agent1": {
      "main": [
        [
          {
            "node": "WhatsApp Business Cloud",
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
    "Switch2": {
      "main": [
        [
          {
            "node": "Switch3",
            "type": "main",
            "index": 0
          }
        ],
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
    "Read from Disk": {
      "main": [
        [
          {
            "node": "Extract from File",
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
    "Switch3": {
      "main": [
        [
          {
            "node": "Read from Disk2",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Read from Disk1",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Read from Disk",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract from File1": {
      "main": [
        [
          {
            "node": "Edit Fields2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields2": {
      "main": [
        [
          {
            "node": "Convert to File1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File1": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk": {
      "main": [
        [
          {
            "node": "If4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If4": {
      "main": [
        [
          {
            "node": "Edit Fields4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read from Disk1": {
      "main": [
        [
          {
            "node": "Extract from File1",
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
            "node": "Create PDF3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields4": {
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
    "Create PDF3": {
      "main": [
        [
          {
            "node": "Get PDF2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request5": {
      "main": [
        [
          {
            "node": "Google Drive4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive4": {
      "main": [
        [
          {
            "node": "Google Drive5",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive5": {
      "main": [
        [
          {
            "node": "HTTP Request6",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request6": {
      "main": [
        [
          {
            "node": "Google Sheets5",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Trello2": {
      "main": [
        [
          {
            "node": "Google Sheets6",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets5": {
      "main": [
        [
          {
            "node": "Trello2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets6": {
      "main": [
        []
      ]
    },
    "Get PDF2": {
      "main": [
        [
          {
            "node": "If8",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If8": {
      "main": [
        [
          {
            "node": "HTTP Request5",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "If9",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If9": {
      "main": [
        [],
        [
          {
            "node": "Get PDF2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields": {
      "main": [
        [
          {
            "node": "Convert to File",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract from File2": {
      "main": [
        [
          {
            "node": "Edit Fields3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields3": {
      "main": [
        [
          {
            "node": "Convert to File2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File2": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk2": {
      "main": [
        [
          {
            "node": "If7",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read from Disk2": {
      "main": [
        [
          {
            "node": "Extract from File2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If7": {
      "main": [
        [
          {
            "node": "Code2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code2": {
      "main": [
        [
          {
            "node": "Create PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create PDF": {
      "main": [
        [
          {
            "node": "Get PDF3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request7": {
      "main": [
        [
          {
            "node": "Google Drive6",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get PDF3": {
      "main": [
        [
          {
            "node": "If10",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If10": {
      "main": [
        [
          {
            "node": "HTTP Request7",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "If11",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If11": {
      "main": [
        [],
        [
          {
            "node": "Get PDF3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive6": {
      "main": [
        [
          {
            "node": "Google Drive7",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive7": {
      "main": [
        [
          {
            "node": "HTTP Request8",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request8": {
      "main": [
        [
          {
            "node": "Google Sheets7",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Trello3": {
      "main": [
        [
          {
            "node": "Google Sheets8",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets7": {
      "main": [
        [
          {
            "node": "Trello3",
            "type": "main",
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
    "Set Booking": {
      "main": [
        [
          {
            "node": "WhatsApp Business Cloud1",
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
            "node": "WhatsApp Business Cloud2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "WhatsApp Trigger": {
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
    }
  },
  "pinData": {
    "WhatsApp Trigger": [
      {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "5491166914285",
          "phone_number_id": "744836178704673"
        },
        "contacts": [
          {
            "profile": {
              "name": "Gere"
            },
            "wa_id": "5493417417442"
          }
        ],
        "messages": [
          {
            "context": {
              "from": "5491166914285",
              "id": "wamid.HBgNNTQ5MzQxNzQxNzQ0MhUCABEYEkFEMTAwNTNBRkJFQzU2NTA5RgA="
            },
            "from": "5493417417442",
            "id": "wamid.HBgNNTQ5MzQxNzQxNzQ0MhUCABIYFjNFQjAwMDVEMEVDRDdDRjUyRTdGNzcA",
            "timestamp": "1756824064",
            "type": "interactive",
            "interactive": {
              "type": "button_reply",
              "button_reply": {
                "id": "0",
                "title": "Select Vuelo"
              }
            }
          }
        ],
        "field": "messages"
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

*Flight Trigger*

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
          "value": "1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q",
          "mode": "list",
          "cachedResultName": "Travel Booking Data",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit?usp=drivesdk"
        },
        "sheetName": {
          "__rl": true,
          "value": "gid=0",
          "mode": "list",
          "cachedResultName": "Flights",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=0"
        },
        "event": "rowAdded",
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTrigger",
      "typeVersion": 1,
      "position": [
        144,
        -1008
      ],
      "id": "6f4d2fd7-069e-44c9-a0a5-6fdd4d72add6",
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
        368,
        -1008
      ],
      "id": "5b376af4-2999-45d8-9712-73af6f2a7239",
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
        592,
        -1008
      ],
      "id": "131fbccd-15b3-46e4-8d85-4c6c3114ec27",
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
        1264,
        -912
      ],
      "id": "61161100-3c13-4446-abb2-289b05132cc7",
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
          "value": "bcJa51Za0i7EmISs",
          "mode": "list",
          "cachedResultName": "Send Options"
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
        1280,
        -1232
      ],
      "id": "86926d96-f7ad-4b5d-9e92-f8ddcc894de7",
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
        1040,
        -1008
      ],
      "id": "49294fad-06e9-4468-b2d8-75e446425364",
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
        1488,
        -912
      ],
      "id": "8b9c5d57-5565-4988-8a05-97a9ed6af288",
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
        1712,
        -912
      ],
      "id": "0131c9be-f8f8-4681-bbfa-b3e407f2b2fd",
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
        "content": "Monitorea Google Sheets para nuevas entradas de reservas de vuelo cada minuto.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        112,
        -1152
      ],
      "typeVersion": 1,
      "id": "bc6c1acd-e943-4e0d-91ac-b1feddb415b0",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Conserva solo la última entrada de reserva para su procesamiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        336,
        -1152
      ],
      "typeVersion": 1,
      "id": "d063bcef-6b89-41d4-ab43-584ceed7e1ca",
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
        560,
        -1152
      ],
      "typeVersion": 1,
      "id": "1cc91497-f3d8-4419-9e39-367aafca5a97",
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
        1008,
        -1152
      ],
      "typeVersion": 1,
      "id": "15665a15-9ac4-4070-8139-0dc4f6572ae7",
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
        1232,
        -1360
      ],
      "typeVersion": 1,
      "id": "0ab5df88-985d-4092-9dd0-e2a6f79c7896",
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
        1232,
        -1056
      ],
      "typeVersion": 1,
      "id": "04cd71a9-3075-4072-bd44-cb68433a5c00",
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
        1456,
        -1056
      ],
      "typeVersion": 1,
      "id": "a212f607-04ec-4ea3-98ad-9edd23489653",
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
        1680,
        -1056
      ],
      "typeVersion": 1,
      "id": "a9022706-1886-4872-a8ff-a7c5a7d0edca",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "jsCode": "// --- 1. OBTENER DATOS Y PREFERENCIAS ---\n// Resultados del scraper (el JSON grande que me mostraste)\nconst flightResults = $input.first().json; \n// Preferencias del usuario desde la hoja de Google Sheets\nconst bookingData = $('Booking Data').first().json; \n\n// Extraemos las preferencias de la reserva. Si no existen, usamos valores por defecto.\nconst minLayover = (bookingData.Min_Layover_Hours !== undefined && bookingData.Min_Layover_Hours !== '') ? parseFloat(bookingData.Min_Layover_Hours) : null;\nconst maxLayover = (bookingData.Max_Layover_Hours !== undefined && bookingData.Max_Layover_Hours !== '') ? parseFloat(bookingData.Max_Layover_Hours) : null;\n// Esta es la bandera para vuelos directos. Será 'false' si el usuario pidió \"directo\".\nconst requiresDirectFlight = bookingData.Stopovers === false;\n\nconst allFlights = flightResults.Flights || [];\n\n// --- 2. FUNCIÓN AUXILIAR PARA CALCULAR HORAS ---\nfunction parseDurationToHours(durationStr) {\n  if (typeof durationStr !== 'string' || !durationStr) return 0;\n  let totalHours = 0;\n  const hoursMatch = durationStr.match(/(\\d+)\\s*h/);\n  const minutesMatch = durationStr.match(/(\\d+)\\s*m/);\n  if (hoursMatch) totalHours += parseInt(hoursMatch[1], 10);\n  if (minutesMatch) totalHours += parseInt(minutesMatch[1], 10) / 60;\n  return totalHours;\n}\n\n// --- 3. LÓGICA DE FILTRADO PRINCIPAL ---\nconst filteredFlights = allFlights.filter(flight => {\n  // Si un vuelo no tiene la estructura esperada, lo descartamos.\n  if (!flight || !flight.legs || flight.legs.length === 0) {\n    return false;\n  }\n\n  // Un vuelo es válido solo si CADA UNO de sus tramos (ida, vuelta) pasa los filtros.\n  return flight.legs.every(leg => {\n    const hasLayovers = leg.layovers && leg.layovers.length > 0;\n\n    // --- FILTRO A: VUELO DIRECTO ---\n    if (requiresDirectFlight) {\n      // Si se pide directo, el tramo solo es válido si NO tiene escalas.\n      return !hasLayovers;\n    }\n    \n    // --- FILTRO B: HORAS DE ESCALA ---\n    // Si no se especificaron horas de escala, el tramo es válido.\n    if (minLayover === null && maxLayover === null) {\n      return true; \n    }\n\n    // Validación de consistencia de datos de Ícaro:\n    // Si el texto dice que hay escalas pero la lista `layovers` está vacía, es un dato inválido. Descartar.\n    if (leg.flight_type && leg.flight_type.toLowerCase().includes('escala') && !hasLayovers) {\n      return false;\n    }\n\n    // Calcular la duración total de las escalas para este tramo.\n    const totalLayoverHours = !hasLayovers ? 0 : leg.layovers.reduce((total, layover) => {\n      return total + parseDurationToHours(layover.waiting_time);\n    }, 0);\n\n    // Comprobar si la duración total está dentro del rango solicitado.\n    const minConditionMet = (minLayover !== null) ? totalLayoverHours >= minLayover : true;\n    const maxConditionMet = (maxLayover !== null) ? totalLayoverHours <= maxLayover : true;\n\n    return minConditionMet && maxConditionMet;\n  });\n});\n\n// --- 4. DEVOLVER EL RESULTADO FINAL FILTRADO ---\nreturn [{\n  json: {\n    ...flightResults,\n    Flights: filteredFlights\n  }\n}];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        816,
        -1008
      ],
      "id": "0724b52a-0185-4296-8f69-9d5ed2477758",
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
    "Execute Workflow2": {
      "main": [
        []
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
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

*Hotel Trigger*

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
        "event": "rowAdded",
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTrigger",
      "typeVersion": 1,
      "position": [
        144,
        -880
      ],
      "id": "a2f6ec22-5908-4800-a85d-35ae13a73bdb",
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
        "workflowId": {
          "__rl": true,
          "value": "FvrvgisxXOYN6tEB",
          "mode": "list",
          "cachedResultName": "Hotel Scrapper"
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
        592,
        -880
      ],
      "id": "40a15785-5036-4f81-a046-29b28eb7003f",
      "name": "Execute Workflow"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "=\"{{ $('Booking Data').item.json.Contact_Id }}\"",
        "textBody": "=❌ No se encontraron hoteles.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        1104,
        -720
      ],
      "id": "e452bade-6e8e-47cf-9cc7-02def304138c",
      "name": "WhatsApp Business Cloud1",
      "webhookId": "3f75b25f-42a6-4ac1-861f-eef6cd93b20a",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
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
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}\n"
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
        1312,
        -720
      ],
      "id": "0778d5dc-d441-4aea-9e55-d5ad230bc192",
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
        1504,
        -720
      ],
      "id": "495cd6ab-bf84-47be-b131-1ad4bed893de",
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
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 2
          },
          "conditions": [
            {
              "id": "9eedf02f-bd73-48bd-b176-5273bd96996d",
              "leftValue": "={{ $json.Lozada !== null && $json.Lozada.isNotEmpty() && $json.Lozada.first().isNotEmpty() && $json.Lozada.first().name !== null && $json.Lozada.first().location !== null && $json.Lozada.first().price !== null}}",
              "rightValue": "",
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            }
          ],
          "combinator": "or"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        784,
        -880
      ],
      "id": "dc113655-ee56-4a3d-bfc0-86980ad6400e",
      "name": "If4"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "bcJa51Za0i7EmISs",
          "mode": "list",
          "cachedResultName": "Send Options"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Booking Data": "={{ $('Booking Data').item.json }}",
            "Hotels": "={{ $json.Lozada }}"
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
              "type": "array",
              "removed": true
            },
            {
              "id": "Hotels",
              "displayName": "Hotels",
              "required": false,
              "defaultMatch": false,
              "display": true,
              "canBeUsedToMatch": true,
              "type": "array",
              "removed": false
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
        1104,
        -1184
      ],
      "id": "60ed901d-9366-4ad8-9746-e93421a2cca0",
      "name": "Execute Workflow3"
    },
    {
      "parameters": {
        "content": "Monitorea la pestaña “Hotels” de Google Sheets en busca de nuevas entradas de reserva de hotel cada minuto.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        112,
        -1024
      ],
      "typeVersion": 1,
      "id": "7e2ca978-fd17-437d-994f-cd9757eeb061",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Conserva solo la última entrada de reserva de hotel para su procesamiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        320,
        -1024
      ],
      "typeVersion": 1,
      "id": "79c39fb4-2209-49e9-ba33-79106cdfebb1",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Llama al workflow “Hotel Scrapper” para buscar hoteles.\n\n",
        "height": 300,
        "width": 160
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        544,
        -1024
      ],
      "typeVersion": 1,
      "id": "6c859c37-cab3-4362-9ac7-b51a96162e65",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Verifica si se encontraron hoteles mediante el Scrapping de Delfos o Lozada.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        752,
        -1024
      ],
      "typeVersion": 1,
      "id": "7b28abde-608f-4608-8cb2-11267c555cc4",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Envía las opciones de hotel al cliente vía el workflow “Send Options”.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1072,
        -1296
      ],
      "typeVersion": 1,
      "id": "d48b0ceb-b005-46cc-99c6-fca734406dea",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Envía un mensaje de “no se encontraron hoteles” vía WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1072,
        -848
      ],
      "typeVersion": 1,
      "id": "b9bcf288-1a16-4504-8167-3276c628fe05",
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
        1264,
        -848
      ],
      "typeVersion": 1,
      "id": "add0d81a-c2a9-4137-85fc-38742975a483",
      "name": "Sticky Note6"
    },
    {
      "parameters": {
        "content": "Elimina la reserva procesada de la hoja “Hotels” para evitar reprocesarla.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1472,
        -848
      ],
      "typeVersion": 1,
      "id": "934626af-0eff-49c7-99a1-75f289174663",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "keep": "lastItems"
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        368,
        -880
      ],
      "id": "1663cbb0-e648-4b2a-b96d-b02982cd04bf",
      "name": "Booking Data"
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
    "Execute Workflow": {
      "main": [
        [
          {
            "node": "If4",
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
    "If4": {
      "main": [
        [
          {
            "node": "Execute Workflow3",
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
    "Booking Data": {
      "main": [
        [
          {
            "node": "Execute Workflow",
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
        "Name": "Mudassir",
        "Phone": 923180595674,
        "Contact_Id": 923180595674,
        "Time_Stamp": "2025-08-28 7:44",
        "Travel_Type": "Hotel",
        "Hotel_Destination": "madrid",
        "Check_In_Date": "2025-09-15",
        "Check_Out_Date": "2025-09-25",
        "Num_Adults": 2,
        "Num_Children": "",
        "Childrens_Ages": "",
        "Room_Only": "",
        "Refundable": "",
        "Half_Board": "",
        "Breakfast_Included": "",
        "All_Inclusive": "",
        "Travel_Assistance": 80,
        "Transfers": "",
        "Preferred_Hotel": "Riu",
        "Hotel_Chain": "Riu",
        "Hotel_Stars": ""
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

*Ambos Trigger*

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
        "event": "rowAdded",
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheetsTrigger",
      "typeVersion": 1,
      "position": [
        -128,
        -768
      ],
      "id": "ad201985-f6a0-42ef-80e0-c07b2837c3cc",
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
        "workflowId": {
          "__rl": true,
          "value": "FvrvgisxXOYN6tEB",
          "mode": "list",
          "cachedResultName": "Hotel Scrapper"
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
        320,
        -768
      ],
      "id": "f830b316-08dd-44c5-a2bd-40788c6fd85f",
      "name": "Execute Workflow"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "=\"{{ $('Booking Data').item.json.Contact_Id }}\"",
        "textBody": "=❌ No se encontraron hoteles.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        1104,
        -416
      ],
      "id": "7faf1419-4377-4638-8a9e-b26d18d7709a",
      "name": "WhatsApp Business Cloud1",
      "webhookId": "ccd6b419-3878-412e-827e-43fb64a88278",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
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
              "id": "e984e99f-6f3f-42ff-bf8f-9f65fe0e449c",
              "leftValue": "={{ $json.Delfos !== null && $json.Delfos.isNotEmpty() && $json.Delfos.first().isNotEmpty() && $json.Delfos.first().name !== null && $json.Delfos.first().price !== null && $json.Delfos.first().location !== null }}",
              "rightValue": "",
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            },
            {
              "id": "9eedf02f-bd73-48bd-b176-5273bd96996d",
              "leftValue": "={{ $json.Lozada !== null && $json.Lozada.isNotEmpty() && $json.Lozada.first().isNotEmpty() && $json.Lozada.first().name !== null && $json.Lozada.first().link !== null && $json.Lozada.first().location !== null && $json.Lozada.first().price !== null}}",
              "rightValue": "",
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            }
          ],
          "combinator": "or"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.2,
      "position": [
        528,
        -768
      ],
      "id": "85d21108-f436-4e81-a1f2-d5d0fc33a7e1",
      "name": "If4"
    },
    {
      "parameters": {
        "content": "Monitorea la pestaña “Hotels” de Google Sheets en busca de nuevas entradas de reserva de hotel cada minuto.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -160,
        -896
      ],
      "typeVersion": 1,
      "id": "472f1e42-99d5-4fa5-af5e-6cee70bac6ba",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Conserva solo la última entrada de reserva de hotel para su procesamiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        64,
        -896
      ],
      "typeVersion": 1,
      "id": "23570bf9-d6ba-412c-ae9b-3152264e9238",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Llama al workflow “Hotel Scrapper” para buscar hoteles.\n\n",
        "height": 300,
        "width": 160
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        288,
        -896
      ],
      "typeVersion": 1,
      "id": "0e0b18f5-d591-4e1d-83b6-577c639c5d39",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Verifica si se encontraron hoteles mediante el Scrapping de Delfos o Lozada.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        480,
        -896
      ],
      "typeVersion": 1,
      "id": "6d8edf83-2e7a-460e-b2e4-fd5c32b03678",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Envía un mensaje de “no se encontraron hoteles” vía WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1072,
        -544
      ],
      "typeVersion": 1,
      "id": "e68e0abf-2dae-483f-899a-d25f7492b1fd",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "keep": "lastItems"
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        112,
        -768
      ],
      "id": "d23cb481-de00-4da5-91f6-34dc90a3261b",
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
        1104,
        -1056
      ],
      "id": "3852ad0b-7da2-4049-8c89-8ba3ed3aca23",
      "name": "Execute Workflow1"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "bcJa51Za0i7EmISs",
          "mode": "list",
          "cachedResultName": "Send Options"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Flights": "={{ $json.Flights }}",
            "Booking Data": "={{ $('Booking Data').item.json }}",
            "Hotels": "={{ $('Execute Workflow').item.json.Lozada}}"
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
              "removed": false
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
        1808,
        -1264
      ],
      "id": "a34f919b-4f99-4cf2-8130-0c06a42bcd2a",
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
              "leftValue": "={{ $json.Flights }}",
              "rightValue": "",
              "operator": {
                "type": "array",
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
        1312,
        -1056
      ],
      "id": "452cc5f3-add3-4e12-a688-2a038f96db06",
      "name": "If2"
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
        1808,
        -880
      ],
      "id": "ec3aebd0-e14d-4f69-98d8-aab67201ee2d",
      "name": "WhatsApp Business Cloud",
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
        "content": "Verifica si se encontraron vuelos y están disponibles.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1264,
        -1216
      ],
      "typeVersion": 1,
      "id": "1d85fbf7-3577-445e-89de-3c19a662d113",
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
        1760,
        -1024
      ],
      "typeVersion": 1,
      "id": "defdf2d2-ac63-4a4a-8d67-20f4735103bc",
      "name": "Sticky Note9"
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
        1280,
        -416
      ],
      "id": "831aacda-1a3e-4a91-97ee-682c56ec6db9",
      "name": "Execute Workflow3"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "bcJa51Za0i7EmISs",
          "mode": "list",
          "cachedResultName": "Send Options"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Flights": "={{ $('If').item.json.Flights }}",
            "Booking Data": "={{ $json }}"
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
        2064,
        -624
      ],
      "id": "c096f9b0-7f15-4d11-bd47-ee612e6aa405",
      "name": "Execute Workflow4"
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
              "leftValue": "={{ $json.Flights }}",
              "rightValue": "",
              "operator": {
                "type": "array",
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
        1488,
        -416
      ],
      "id": "08548722-2cc2-4de6-8c01-42b7311fbb70",
      "name": "If"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "=\"{{ $('Booking Data').item.json.Contact_Id }}\"",
        "textBody": "=❌ No se encontraron.",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        1840,
        -256
      ],
      "id": "f923b7e7-38c4-4d25-8536-1ee71b82e9f9",
      "name": "WhatsApp Business Cloud2",
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
            "Time_Stamp": "={{ $now.toFormat('yyyy-MM-dd HH:mm') }}\n"
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
        2064,
        -256
      ],
      "id": "ff5a4c08-5978-420d-9431-df86b7ecd837",
      "name": "Google Sheets1",
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
        2288,
        -256
      ],
      "id": "7d83e0b9-ff11-4283-9bf1-75bf6e745a55",
      "name": "Google Sheets5",
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
        "content": "Verifica si se encontraron vuelos y están disponibles.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1440,
        -544
      ],
      "typeVersion": 1,
      "id": "6bd790d3-864b-4ae1-8f3a-408648b414c9",
      "name": "Sticky Note8"
    },
    {
      "parameters": {
        "jsCode": "\n  const data = $('Booking Data').first().json\n\n  return {\n    json: {\n      ...data,\n      Travel_Type: \"Vuelo\"\n    }\n  };\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1840,
        -624
      ],
      "id": "f6adddb2-5693-4fea-8775-3177bdc13e44",
      "name": "Code"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "bcJa51Za0i7EmISs",
          "mode": "list",
          "cachedResultName": "Send Options"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "Flights": "={{ $('Execute Workflow').item.json.Lozada }}",
            "Booking Data": "={{ $json }}"
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
        2272,
        -880
      ],
      "id": "0bec0ec7-2c9f-4433-90b3-b3a92812e254",
      "name": "Execute Workflow5"
    },
    {
      "parameters": {
        "jsCode": "\n  const data = $('Booking Data').first().json\n\n  return {\n    json: {\n      ...data,\n      Travel_Type: \"Hotel\"\n    }\n  };\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2048,
        -880
      ],
      "id": "cc547556-ed20-4c4c-b242-2fe422ef2787",
      "name": "Code1"
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
    "Execute Workflow": {
      "main": [
        [
          {
            "node": "If4",
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
            "node": "Execute Workflow3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If4": {
      "main": [
        [
          {
            "node": "Execute Workflow1",
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
    "Booking Data": {
      "main": [
        [
          {
            "node": "Execute Workflow",
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
            "node": "If2",
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
            "node": "WhatsApp Business Cloud",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "WhatsApp Business Cloud": {
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
    "Execute Workflow3": {
      "main": [
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If": {
      "main": [
        [
          {
            "node": "Code",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "WhatsApp Business Cloud2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "WhatsApp Business Cloud2": {
      "main": [
        [
          {
            "node": "Google Sheets1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets1": {
      "main": [
        [
          {
            "node": "Google Sheets5",
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
            "node": "Execute Workflow4",
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
            "node": "Execute Workflow5",
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
        "Name": "Tomas",
        "Phone": 5492954602920,
        "Contact_Id": 5492954602920,
        "Time_Stamp": "2025-08-24 9:43",
        "Travel_Type": "Ambos",
        "Origin": "EZE",
        "Flight_Destination": "CUN",
        "Departure_date": "2025-10-10",
        "Return_date": "2025-10-19",
        "Num_Adults": 2,
        "Num_Children": "",
        "Childrens_Ages": "",
        "Stopovers": "",
        "Luggage": true,
        "Airlines": "",
        "Departure_Time_Range": "",
        "Return_Time_Range": "",
        "Check_In_Date": "2025-10-10",
        "Check_Out_Date": "2025-10-19",
        "Hotel_Destination": "Cancun",
        "Room_Only": "",
        "Refundable": "",
        "Half_Board": "",
        "Breakfast_Included": "",
        "All_Inclusive": "",
        "Travel_Assistance": "",
        "Transfers": "",
        "Layover_Hours": "",
        "Max_Layover_Hours": "",
        "Min_Layover_Hours": "",
        "Preferred_Hotel": "Iberostar",
        "Hotel_Chain": "Iberostar",
        "Hotel_Stars": ""
      }
    ],
    "Execute Workflow1": [
      {
        "Flights": [
          {
            "airline": {
              "code": "IB",
              "name": "Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "BARCELONA",
                  "time": "14:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "16:15"
                },
                "duration": "01h 25m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "137,60",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "IB",
              "name": "Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "BARCELONA",
                  "time": "18:10"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "19:35"
                },
                "duration": "01h 25m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "137,60",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "IB",
              "name": "Iberia"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "BARCELONA",
                  "time": "13:35"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "15:00"
                },
                "duration": "01h 25m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "177,60",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "UX",
              "name": "Air Europa"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "BARCELONA",
                  "time": "11:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "13:20"
                },
                "duration": "01h 30m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "183,20",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "UX",
              "name": "Air Europa"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "BARCELONA",
                  "time": "20:30"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "MADRID",
                  "time": "22:00"
                },
                "duration": "01h 30m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "183,20",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "UX",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "Barcelona, Spain",
                  "time": "11:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "Madrid, Spain",
                  "time": "13:20"
                },
                "duration": "1h 30m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "163,20",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "UX",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "Barcelona, Spain",
                  "time": "20:30"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "Madrid, Spain",
                  "time": "22:00"
                },
                "duration": "1h 30m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "163,20",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "UX",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "Barcelona, Spain",
                  "time": "20:30"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "Madrid, Spain",
                  "time": "22:00"
                },
                "duration": "1h 30m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "196,642",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "IB",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "Barcelona, Spain",
                  "time": "14:50"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "Madrid, Spain",
                  "time": "16:15"
                },
                "duration": "1h 25m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "197,60",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "IB",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "BCN",
                  "city_name": "Barcelona, Spain",
                  "time": "13:35"
                },
                "arrival": {
                  "city_code": "MAD",
                  "city_name": "Madrid, Spain",
                  "time": "15:00"
                },
                "duration": "1h 25m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "237,60",
              "currency": "USD"
            }
          }
        ],
        "Retry": "true"
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}


*Send Options*

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
        -304,
        1088
      ],
      "id": "cc0195ec-6581-43d9-8db0-f9dc9a798978",
      "name": "Trigger"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        1600,
        1072
      ],
      "id": "61c883c0-08a3-43b6-9452-7fa25113d333",
      "name": "Convert to File"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "={{ $('Trigger').item.json['Booking Data'].Travel_Type }}_{{ $('Trigger').first().json['Booking Data'].Contact_Id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        1824,
        1072
      ],
      "id": "1c1bd69e-0689-4704-b2fb-f7c4ba54121f",
      "name": "Read/Write Files from Disk"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "18ca49c5-2de0-4d28-8b63-97a1e4364e53",
              "name": "Flights",
              "value": "={{ $('Trigger').first().json.Flights }}",
              "type": "array"
            },
            {
              "id": "8d2b672d-dcde-4810-9e3c-0d717dc30919",
              "name": "SelectedCount",
              "value": 0,
              "type": "number"
            },
            {
              "id": "df473f22-25f5-4755-a103-253a0c100050",
              "name": "FirstSelection",
              "value": "",
              "type": "string"
            },
            {
              "id": "3ccf0fd3-434f-4539-bc32-0d0e684361c6",
              "name": "SecondSelection",
              "value": "",
              "type": "string"
            },
            {
              "id": "d89aa9ff-37dc-4207-96f8-bb7e2b47b756",
              "name": "BookingData",
              "value": "={{ $('Trigger').first().json['Booking Data'] }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1392,
        1072
      ],
      "id": "387dc1f6-7c5a-4447-80f0-66fe5a2109d7",
      "name": "Edit Fields",
      "executeOnce": true
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('Trigger').item.json['Booking Data'].Contact_Id }}\",\n  \"type\": \"interactive\",\n  \"interactive\": {\n    \"type\": \"button\",\n    \"header\": {\n  \"type\":\"text\",\n  \"text\": \"{{ $json.title }}\"\n    },\n    \"body\": {\n      \"text\": \"{{ $json.description.replace(/\\n/g, '\\\\n') }}\"\n    },\n    \"action\": {\n      \"buttons\": [\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"{{ $json.id }}\",\n            \"title\": \"Select Hotel\"\n          }\n        }\n      ]\n    }\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1152,
        624
      ],
      "id": "17cb3004-151c-4e3c-b196-22b99c5c94a4",
      "name": "HTTP Request1",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "\n  return items.map((item, index) => {\n    const vuelo = item.json;\n    const legs = vuelo.legs;\n    const airline = vuelo.airline.name;\n    const price = `${vuelo.price.amount} ${vuelo.price.currency}`;\n\n    const titulo = `✈️ ${airline}`;\n\n    // Construir descripción estilo lista con emojis\n    const detalles = legs.map((pierna, index) => {\n      const tramo = index === 0 ? `🛫 Ida (${$('Trigger').first().json['Booking Data'].Departure_date})` : `🛬 Regreso (${$('Trigger').first().json['Booking Data'].Return_date})`;\n      const salida = `📍 *Origen*: ${pierna.departure.city_name} (${pierna.departure.city_code})`;\n      const horaSalida = `🕒 *Salida*: ${pierna.departure.time}`;\n      const llegada = `🎯 *Destino*: ${pierna.arrival.city_name} (${pierna.arrival.city_code})`;\n      const horaLlegada = `🕓 *Llegada*: ${pierna.arrival.time}`;\n      const duracion = `⏱️ *Duración*: ${pierna.duration}`;\n\n      let escalaTexto = \"\";\n      if (pierna.layovers?.length) {\n        const escala = pierna.layovers[0];\n        escalaTexto = `🛑 Escala en ${escala.destination_city} (${escala.destination_code}) durante ${escala.waiting_time}`;\n      }\n\n      return `${tramo}\\n${salida}\\n${horaSalida}\\n${llegada}\\n${horaLlegada}\\n${duracion}${escalaTexto ? `\\n${escalaTexto}` : \"\"}`;\n    });\n\n    const descripcion =\n      `${detalles.join(\"\\n\\n\")}\\n\\n💰 Precio: ${price}`;\n\n    return {\n      id: `${index}`,\n      title: titulo,\n      description: descripcion\n    };\n  });\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        944,
        1072
      ],
      "id": "29e4fdf4-1019-436e-8603-ea8ed1458b91",
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
        -96,
        1072
      ],
      "id": "42d0f47f-b45a-438e-8ae2-f5229c44f0a6",
      "name": "Switch"
    },
    {
      "parameters": {
        "jsCode": "return items.map((item, index) => {\n  const hotel = item.json;\n\n  const name = hotel.name;\n  const location = hotel.location;\n  const stars = hotel.stars;\n  const price = `${hotel.price} ${hotel.currency}`;\n  const checkin = $('Trigger').first().json['Booking Data'].Check_In_Date\n  const checkout = $('Trigger').first().json['Booking Data'].Check_Out_Date\n\n  const titulo = `🏨 ${name}`;\n\n  const descripcion =\n    `📍 *Ubicación*: ${location}\\n` +\n    `⭐ *Estrellas*: ${stars}\\n` +\n    `💰 *Precio*: ${price}\\n` +\n    `📅 *Check-in*: ${checkin}\\n` +\n    `📅 *Check-out*: ${checkout}\\n`;\n\n  return {\n    id: `${index}`,\n    title: titulo,\n    description: descripcion\n  };\n});\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        944,
        624
      ],
      "id": "d0d5ed1b-69fa-4b5c-84bf-084aeaeba617",
      "name": "Code2"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('Trigger').item.json['Booking Data'].Contact_Id }}\",\n  \"type\": \"interactive\",\n  \"interactive\": {\n    \"type\": \"button\",\n    \"header\": {\n  \"type\":\"text\",\n  \"text\": \"{{ $json.title }}\"\n    },\n    \"body\": {\n      \"text\": \"{{ $json.description.replace(/\\n/g, '\\\\n') }}\"\n    },\n    \"action\": {\n      \"buttons\": [\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"{{ $json.id }}\",\n            \"title\": \"Select Vuelo\"\n          }\n        }\n      ]\n    }\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1168,
        1072
      ],
      "id": "28eb7f39-77df-489a-b247-df1f2418cef6",
      "name": "HTTP Request3",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        1584,
        624
      ],
      "id": "2cff2472-1931-49d1-aedb-a3727bd95346",
      "name": "Convert to File1"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "={{ $('Trigger').item.json['Booking Data'].Travel_Type }}_{{ $('Trigger').first().json['Booking Data'].Contact_Id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        1808,
        624
      ],
      "id": "b4bbc046-de60-43c6-b187-6a8d46c0a70e",
      "name": "Read/Write Files from Disk1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "18ca49c5-2de0-4d28-8b63-97a1e4364e53",
              "name": "Hotels",
              "value": "={{ $('Trigger').item.json.Hotels }}",
              "type": "array"
            },
            {
              "id": "8d2b672d-dcde-4810-9e3c-0d717dc30919",
              "name": "SelectedCount",
              "value": 0,
              "type": "number"
            },
            {
              "id": "df473f22-25f5-4755-a103-253a0c100050",
              "name": "FirstSelection",
              "value": "",
              "type": "string"
            },
            {
              "id": "3ccf0fd3-434f-4539-bc32-0d0e684361c6",
              "name": "SecondSelection",
              "value": "",
              "type": "string"
            },
            {
              "id": "d89aa9ff-37dc-4207-96f8-bb7e2b47b756",
              "name": "BookingData",
              "value": "={{ $('Trigger').first().json['Booking Data'] }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1360,
        624
      ],
      "id": "7e2050f0-3f49-4faa-9560-70149883e307",
      "name": "Edit Fields1",
      "executeOnce": true
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
        720,
        1072
      ],
      "id": "df88a1d9-fbd6-40af-982d-85839975d33c",
      "name": "Filter"
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
              "id": "96af5054-e391-4b8b-8fb5-f835fbd54582",
              "leftValue": "={{ $json.name }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "7161e882-e0ea-4bfe-9afc-a27be9ab0db2",
              "leftValue": "={{ $json.location }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "852385e5-8450-4222-9728-748368aab338",
              "leftValue": "={{ $json.price }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "8af072e4-e003-4470-9eb9-eb28c38ca0f6",
              "leftValue": "={{ $json.currency }}",
              "rightValue": "",
              "operator": {
                "type": "string",
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
        720,
        624
      ],
      "id": "a0de9ac3-7c9f-4537-b229-0fc273efa7dc",
      "name": "Filter1"
    },
    {
      "parameters": {
        "content": "Enruta el flujo de trabajo según el tipo de viaje: Hotel o Vuelo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -144,
        928
      ],
      "typeVersion": 1,
      "id": "85e64245-90f1-46ce-92be-aa649fdc8f0f",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Filtra los hoteles para asegurar que existan todos los campos requeridos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        688,
        480
      ],
      "typeVersion": 1,
      "id": "f5695c55-1f81-4c5b-a812-68d262d86cd3",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Filtra los vuelos para asegurar que existan todos los campos requeridos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        688,
        928
      ],
      "typeVersion": 1,
      "id": "e5ea47b5-c3ec-4ec2-8f9f-657eab215750",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "content": "Da formato a los datos de los hoteles en un mensaje interactivo para WhatsApp.\n\n",
        "height": 300,
        "width": 160
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        912,
        480
      ],
      "typeVersion": 1,
      "id": "f3d32ca1-eee3-41e2-8405-04731ca24a8f",
      "name": "Sticky Note6"
    },
    {
      "parameters": {
        "content": "Da formato a los datos de los vuelos en un mensaje interactivo para WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        912,
        928
      ],
      "typeVersion": 1,
      "id": "1c2c3c8f-c91d-4b33-a4cc-ed765af3bf6b",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "content": "Envía las opciones de hotel al cliente vía WhatsApp con botones de selección.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1104,
        480
      ],
      "typeVersion": 1,
      "id": "07d8c39e-9936-41bc-aabb-2ade540c59f5",
      "name": "Sticky Note8"
    },
    {
      "parameters": {
        "content": "Envía las opciones de vuelo al cliente vía WhatsApp con botones de selección.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1120,
        928
      ],
      "typeVersion": 1,
      "id": "f882c25c-6ca5-4cc8-a59b-0ff18fe1348d",
      "name": "Sticky Note9"
    },
    {
      "parameters": {
        "content": "Prepares hotel selection data for storage with booking info",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1328,
        480
      ],
      "typeVersion": 1,
      "id": "a61e34fc-a3f4-4585-a3c9-0ad4199b9f54",
      "name": "Sticky Note10"
    },
    {
      "parameters": {
        "content": "Prepara los datos de la selección de vuelo para su almacenamiento junto con la información de la reserva.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1344,
        928
      ],
      "typeVersion": 1,
      "id": "e7652b5d-d77f-4ba8-b99d-93aba67434ba",
      "name": "Sticky Note11"
    },
    {
      "parameters": {
        "content": "Convierte los datos de los hoteles a formato JSON para almacenarlos en archivo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1552,
        480
      ],
      "typeVersion": 1,
      "id": "5d052878-e285-43a0-b8e1-b1b1e45093f4",
      "name": "Sticky Note12"
    },
    {
      "parameters": {
        "content": "Convierte los datos de los vuelos a formato JSON para almacenarlos en archivo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1568,
        928
      ],
      "typeVersion": 1,
      "id": "e81b58ba-6d6f-418c-8a8d-81a27af5f99d",
      "name": "Sticky Note13"
    },
    {
      "parameters": {
        "content": "Guarda los datos de la selección de hotel en disco para referencia futura.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1760,
        480
      ],
      "typeVersion": 1,
      "id": "38c997c5-1377-419b-a87a-6c0f4cefef5b",
      "name": "Sticky Note14"
    },
    {
      "parameters": {
        "content": "Guarda los datos de la selección de vuelo en disco para referencia futura.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1792,
        928
      ],
      "typeVersion": 1,
      "id": "b1196da4-0654-4194-8a7b-a26103ede72b",
      "name": "Sticky Note15"
    },
    {
      "parameters": {
        "fieldToSplitOut": "Hotels",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        288,
        624
      ],
      "id": "b52811c0-d614-4877-95c2-75b2940c801b",
      "name": "Split Out"
    },
    {
      "parameters": {
        "maxItems": 5
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        512,
        624
      ],
      "id": "c8403c1e-6c82-41c9-8c27-7babbae4d681",
      "name": "Limit"
    },
    {
      "parameters": {
        "content": "Divide el arreglo de opciones en elementos individuales para su procesamiento.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        240,
        464
      ],
      "typeVersion": 1,
      "id": "b2498bf2-ebc6-459d-be69-3f09db746a94",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Limita a un máximo de 10 opciones para la selección del usuario.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        464,
        464
      ],
      "typeVersion": 1,
      "id": "8bc173a4-6a29-4a9f-8071-e2becc5f4392",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "fieldToSplitOut": "Flights",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        288,
        1072
      ],
      "id": "28222a13-7342-4759-91b2-23a814a96de6",
      "name": "Split Out1"
    },
    {
      "parameters": {
        "maxItems": 5
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        480,
        1072
      ],
      "id": "ae963fc2-ba88-4384-aae2-68c2510f4154",
      "name": "Limit1"
    },
    {
      "parameters": {
        "content": "Divide el arreglo de opciones en elementos individuales para su procesamiento.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        240,
        464
      ],
      "typeVersion": 1,
      "id": "36c2ee6e-f5df-461e-a896-138086faf0ed",
      "name": "Sticky Note19"
    },
    {
      "parameters": {
        "content": "Limita a un máximo de 10 opciones para la selección del usuario.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        464,
        464
      ],
      "typeVersion": 1,
      "id": "532fa687-6a94-4b3a-9bc7-f78f59c9b3f8",
      "name": "Sticky Note20"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('Trigger').item.json['Booking Data'].Contact_Id }}\",\n  \"type\": \"interactive\",\n  \"interactive\": {\n    \"type\": \"button\",\n    \"header\": {\n  \"type\":\"text\",\n  \"text\": \"{{ $json.title }}\"\n    },\n    \"body\": {\n      \"text\": \"{{ $json.description.replace(/\\n/g, '\\\\n') }}\"\n    },\n    \"action\": {\n      \"buttons\": [\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"{{ $json.id }}\",\n            \"title\": \"Elegir Hotel\"\n          }\n        }\n      ]\n    }\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1152,
        1440
      ],
      "id": "97b3e81a-8b58-45a6-ac48-99fd5790ed3c",
      "name": "HTTP Request",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "return items.map((item, index) => {\n  const hotel = item.json;\n\n  const name = hotel.name;\n  const location = hotel.location;\n  const stars = hotel.stars;\n  const price = `${hotel.price} ${hotel.currency}`;\n  const checkin = $('Trigger').first().json['Booking Data'].Check_In_Date\n  const checkout = $('Trigger').first().json['Booking Data'].Check_Out_Date\n\n  const titulo = `🏨 ${name}`;\n\n  const descripcion =\n    `📍 *Ubicación*: ${location}\\n` +\n    `⭐ *Estrellas*: ${stars}\\n` +\n    `💰 *Precio*: ${price}\\n` +\n    `📅 *Check-in*: ${checkin}\\n` +\n    `📅 *Check-out*: ${checkout}\\n`;\n\n  return {\n    id: `${index}`,\n    title: titulo,\n    description: descripcion\n  };\n});\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        944,
        1440
      ],
      "id": "76f3f33c-f0e0-4343-811e-3e8e107019e5",
      "name": "Code"
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
              "id": "96af5054-e391-4b8b-8fb5-f835fbd54582",
              "leftValue": "={{ $json.name }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "7161e882-e0ea-4bfe-9afc-a27be9ab0db2",
              "leftValue": "={{ $json.location }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "852385e5-8450-4222-9728-748368aab338",
              "leftValue": "={{ $json.price }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
                "singleValue": true
              }
            },
            {
              "id": "8af072e4-e003-4470-9eb9-eb28c38ca0f6",
              "leftValue": "={{ $json.currency }}",
              "rightValue": "",
              "operator": {
                "type": "string",
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
        720,
        1440
      ],
      "id": "552bbf84-ed79-4ee7-897c-cc632c82b64b",
      "name": "Filter2"
    },
    {
      "parameters": {
        "content": "Filtra los hoteles para asegurar que existan todos los campos requeridos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        688,
        1312
      ],
      "typeVersion": 1,
      "id": "e20e4b26-0b9b-485b-bbe3-214ba80825bd",
      "name": "Sticky Note21"
    },
    {
      "parameters": {
        "content": "Da formato a los datos de los hoteles en un mensaje interactivo para WhatsApp.\n\n",
        "height": 300,
        "width": 160
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        912,
        1312
      ],
      "typeVersion": 1,
      "id": "206067ac-238b-40d9-8b47-a56e739ae01a",
      "name": "Sticky Note22"
    },
    {
      "parameters": {
        "content": "Envía las opciones de hotel al cliente vía WhatsApp con botones de selección.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1104,
        1312
      ],
      "typeVersion": 1,
      "id": "a3c85f40-40f2-4b09-8bac-d7ea5a764b5a",
      "name": "Sticky Note23"
    },
    {
      "parameters": {
        "fieldToSplitOut": "Hotels",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        288,
        1440
      ],
      "id": "50020a28-bb1c-4fec-8231-7d83052ba767",
      "name": "Split Out2"
    },
    {
      "parameters": {
        "maxItems": 5
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        512,
        1440
      ],
      "id": "d23ba5a1-1c34-48ba-ad8b-6e07c614521f",
      "name": "Limit2"
    },
    {
      "parameters": {
        "content": "Divide el arreglo de opciones en elementos individuales para su procesamiento.",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        240,
        1312
      ],
      "typeVersion": 1,
      "id": "a772de9b-0315-482a-bf25-ad9dda9021ad",
      "name": "Sticky Note27"
    },
    {
      "parameters": {
        "content": "Limita a un máximo de 10 opciones para la selección del usuario.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        464,
        1312
      ],
      "typeVersion": 1,
      "id": "4e8efe23-7748-4284-9fe5-bf6b84fc831f",
      "name": "Sticky Note28"
    },
    {
      "parameters": {
        "jsCode": "\n  return items.map((item, index) => {\n    const vuelo = item.json;\n    const legs = vuelo.legs;\n    const airline = vuelo.airline.name;\n    const price = `${vuelo.price.amount} ${vuelo.price.currency}`;\n\n    const titulo = `✈️ ${airline}`;\n\n    // Construir descripción estilo lista con emojis\n    const detalles = legs.map((pierna, index) => {\n      const tramo = index === 0 ? `🛫 Ida (${$('Trigger').first().json['Booking Data'].Departure_date})` : `🛬 Regreso (${$('Trigger').first().json['Booking Data'].Return_date})`;\n      const salida = `📍 *Origen*: ${pierna.departure.city_name} (${pierna.departure.city_code})`;\n      const horaSalida = `🕒 *Salida*: ${pierna.departure.time}`;\n      const llegada = `🎯 *Destino*: ${pierna.arrival.city_name} (${pierna.arrival.city_code})`;\n      const horaLlegada = `🕓 *Llegada*: ${pierna.arrival.time}`;\n      const duracion = `⏱️ *Duración*: ${pierna.duration}`;\n\n      let escalaTexto = \"\";\n      if (pierna.layovers?.length) {\n        const escala = pierna.layovers[0];\n        escalaTexto = `🛑 Escala en ${escala.destination_city} (${escala.destination_code}) durante ${escala.waiting_time}`;\n      }\n\n      return `${tramo}\\n${salida}\\n${horaSalida}\\n${llegada}\\n${horaLlegada}\\n${duracion}${escalaTexto ? `\\n${escalaTexto}` : \"\"}`;\n    });\n\n    const descripcion =\n      `${detalles.join(\"\\n\\n\")}\\n\\n💰 Precio: ${price}`;\n\n    return {\n      id: `${index}`,\n      title: titulo,\n      description: descripcion\n    };\n  });\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        928,
        1792
      ],
      "id": "1aef237c-8275-43b6-8148-7224c934bd27",
      "name": "Code3"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://graph.facebook.com/v23.0/744836178704673/messages",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"messaging_product\": \"whatsapp\",\n  \"recipient_type\": \"individual\",\n  \"to\": \"{{ $('Trigger').item.json['Booking Data'].Contact_Id }}\",\n  \"type\": \"interactive\",\n  \"interactive\": {\n    \"type\": \"button\",\n    \"header\": {\n  \"type\":\"text\",\n  \"text\": \"{{ $json.title }}\"\n    },\n    \"body\": {\n      \"text\": \"{{ $json.description.replace(/\\n/g, '\\\\n') }}\"\n    },\n    \"action\": {\n      \"buttons\": [\n        {\n          \"type\": \"reply\",\n          \"reply\": {\n            \"id\": \"{{ $json.id }}\",\n            \"title\": \"Elegir vuelo\"\n          }\n        }\n      ]\n    }\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1152,
        1792
      ],
      "id": "0cc05b17-cccb-4669-93be-39c60daca6b4",
      "name": "HTTP Request4",
      "credentials": {
        "httpHeaderAuth": {
          "id": "77vPOMyJ45UBue2Y",
          "name": "Whatsapp Auth"
        }
      }
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
        704,
        1792
      ],
      "id": "546849a3-93f4-4f0d-a585-e61e40623c4d",
      "name": "Filter3"
    },
    {
      "parameters": {
        "content": "Filtra los vuelos para asegurar que existan todos los campos requeridos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        672,
        1648
      ],
      "typeVersion": 1,
      "id": "5ad027bd-c157-409e-a0d9-ed38faa5a922",
      "name": "Sticky Note24"
    },
    {
      "parameters": {
        "content": "Da formato a los datos de los vuelos en un mensaje interactivo para WhatsApp.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        880,
        1648
      ],
      "typeVersion": 1,
      "id": "00d88c04-34c6-438b-b57b-ffd06bdcb4a8",
      "name": "Sticky Note25"
    },
    {
      "parameters": {
        "content": "Envía las opciones de vuelo al cliente vía WhatsApp con botones de selección.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1104,
        1648
      ],
      "typeVersion": 1,
      "id": "583941dc-fba6-4b8e-b393-3aefdc5e6a30",
      "name": "Sticky Note26"
    },
    {
      "parameters": {
        "fieldToSplitOut": "Flights",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        272,
        1792
      ],
      "id": "6a69e870-6d04-4564-9dcc-81e50868adee",
      "name": "Split Out3"
    },
    {
      "parameters": {
        "maxItems": 5
      },
      "type": "n8n-nodes-base.limit",
      "typeVersion": 1,
      "position": [
        464,
        1792
      ],
      "id": "1166870f-168b-47e1-8c8d-2ef2835d3e48",
      "name": "Limit3"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        1600,
        1600
      ],
      "id": "538196b4-44bf-47f8-b3ba-d8725b137623",
      "name": "Convert to File2"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=Ambos_{{ $('Trigger').first().json['Booking Data'].Contact_Id }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        1824,
        1600
      ],
      "id": "237a4177-3406-4f30-932a-1e76bc9f5181",
      "name": "Read/Write Files from Disk2"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "6f9901f1-3b5b-4c2e-ac36-f406c889aabf",
              "name": "SelectedCount",
              "value": 0,
              "type": "number"
            },
            {
              "id": "8d2b672d-dcde-4810-9e3c-0d717dc30919",
              "name": "FlightsSelected",
              "value": 0,
              "type": "number"
            },
            {
              "id": "62f19858-7295-4c46-8be5-2256f3a60be8",
              "name": "HotelsSelected",
              "value": 0,
              "type": "number"
            },
            {
              "id": "cc4358ac-d34f-40e7-9aae-5a2079b8d614",
              "name": "First",
              "value": "",
              "type": "string"
            },
            {
              "id": "df0cdf3a-dc13-4524-b123-fa943c6d6277",
              "name": "Second",
              "value": "",
              "type": "string"
            },
            {
              "id": "34d342da-c9df-4196-98e8-3898c91e08ef",
              "name": "Third",
              "value": "",
              "type": "string"
            },
            {
              "id": "599d5e6c-463b-40ef-9527-0ab657f42b79",
              "name": "Fourth",
              "value": "",
              "type": "string"
            },
            {
              "id": "d89aa9ff-37dc-4207-96f8-bb7e2b47b756",
              "name": "BookingData",
              "value": "={{ $('Trigger').item.json['Booking Data'] }}",
              "type": "object"
            },
            {
              "id": "addac903-c13a-4dd1-9b04-81f0491bc6af",
              "name": "Flights",
              "value": "={{ $('Trigger').item.json.Flights }}",
              "type": "array"
            },
            {
              "id": "8068bbde-b104-4f4c-bfa8-8dac06b25922",
              "name": "Hotels",
              "value": "={{ $('Trigger').item.json.Hotels }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1392,
        1600
      ],
      "id": "896260eb-0b76-453d-a928-6b08c570c944",
      "name": "Edit Fields2",
      "executeOnce": true
    },
    {
      "parameters": {
        "content": "Prepares hotel selection data for storage with booking info",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1344,
        1472
      ],
      "typeVersion": 1,
      "id": "f6269f5b-3ab5-41f3-ac28-1fc26bb2ecae",
      "name": "Sticky Note16"
    },
    {
      "parameters": {
        "content": "Convierte los datos de los hoteles a formato JSON para almacenarlos en archivo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1568,
        1472
      ],
      "typeVersion": 1,
      "id": "1433f49b-5a44-407a-90d4-45f11d2f1f48",
      "name": "Sticky Note17"
    },
    {
      "parameters": {
        "content": "Guarda los datos de la selección de hotel en disco para referencia futura.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1792,
        1472
      ],
      "typeVersion": 1,
      "id": "03fc6947-1f5e-449b-9882-63f1b6b18b97",
      "name": "Sticky Note18"
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('Trigger').item.json['Booking Data'].Contact_Id.toString() }}",
        "textBody": "=Selecciona dos hoteles y un vuelo para obtener el PDF 📄✨",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        2048,
        1600
      ],
      "id": "612ad6d9-031f-4040-aade-74f483ce3401",
      "name": "Send message2",
      "webhookId": "813f4ea4-248b-4d87-8b75-1d33078c925d",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('Trigger').item.json['Booking Data'].Contact_Id.toString() }}",
        "textBody": "=Selecciona dos vuelos para obtener el PDF 📄✨",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        2032,
        1072
      ],
      "id": "f8ef8275-3ae1-4fc4-972b-8ceaf3548445",
      "name": "Send message",
      "webhookId": "813f4ea4-248b-4d87-8b75-1d33078c925d",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
    },
    {
      "parameters": {
        "operation": "send",
        "phoneNumberId": "744836178704673",
        "recipientPhoneNumber": "={{ $('Trigger').item.json['Booking Data'].Contact_Id.toString() }}",
        "textBody": "=Selecciona dos hoteles para obtener el PDF 📄✨",
        "additionalFields": {}
      },
      "type": "n8n-nodes-base.whatsApp",
      "typeVersion": 1,
      "position": [
        2032,
        624
      ],
      "id": "33fec13f-7bc1-4b07-8464-fa8f5c4aba19",
      "name": "Send message1",
      "webhookId": "813f4ea4-248b-4d87-8b75-1d33078c925d",
      "credentials": {
        "whatsAppApi": {
          "id": "dg4LMJEZphbAF5Rz",
          "name": "WhatsApp account"
        }
      }
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
    "Convert to File": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk": {
      "main": [
        [
          {
            "node": "Send message",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields": {
      "main": [
        [
          {
            "node": "Convert to File",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request1": {
      "main": [
        [
          {
            "node": "Edit Fields1",
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
            "node": "HTTP Request3",
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
            "node": "Split Out",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Split Out1",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Split Out2",
            "type": "main",
            "index": 0
          },
          {
            "node": "Split Out3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code2": {
      "main": [
        [
          {
            "node": "HTTP Request1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request3": {
      "main": [
        [
          {
            "node": "Edit Fields",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File1": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk1": {
      "main": [
        [
          {
            "node": "Send message1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields1": {
      "main": [
        [
          {
            "node": "Convert to File1",
            "type": "main",
            "index": 0
          }
        ]
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
    "Filter1": {
      "main": [
        [
          {
            "node": "Code2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split Out": {
      "main": [
        [
          {
            "node": "Limit",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Limit": {
      "main": [
        [
          {
            "node": "Filter1",
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
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Edit Fields2",
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
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filter2": {
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
    "Split Out2": {
      "main": [
        [
          {
            "node": "Limit2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Limit2": {
      "main": [
        [
          {
            "node": "Filter2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code3": {
      "main": [
        [
          {
            "node": "HTTP Request4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request4": {
      "main": [
        [
          {
            "node": "Edit Fields2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filter3": {
      "main": [
        [
          {
            "node": "Code3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split Out3": {
      "main": [
        [
          {
            "node": "Limit3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Limit3": {
      "main": [
        [
          {
            "node": "Filter3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File2": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk2": {
      "main": [
        [
          {
            "node": "Send message2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields2": {
      "main": [
        [
          {
            "node": "Convert to File2",
            "type": "main",
            "index": 0
          }
        ]
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
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

*Flight Scrapper*
{
  "nodes": [
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "BookingData",
              "type": "object"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -544,
        -96
      ],
      "id": "1a591cb1-dfad-4845-9740-8adfed4f5795",
      "name": "When Executed by Another Workflow"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "eb0c514b-6561-4966-af67-17894fe7dba4",
              "name": "Flights",
              "value": "={{ $json.flights }}",
              "type": "array"
            },
            {
              "id": "0b41ae71-6807-4a42-8eef-627c53a56e40",
              "name": "Retry",
              "value": "={{ $json.search_params.retry_attempted }}",
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
        -96
      ],
      "id": "39136f14-1125-49d1-9b83-00742c77f627",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "jsCode": "// Get the date strings from previous node\nconst departureStr = $input.first().json.BookingData.json.Departure_date;\nconst returnStr = $input.first().json.BookingData.json.Return_date;\n\n// Helper function to format date to DDMMM\nfunction formatDate(dateStr) {\n  const date = new Date(dateStr);\n  const monthNames = [\"JAN\", \"FEB\", \"MAR\", \"APR\", \"MAY\", \"JUN\",\n                      \"JUL\", \"AUG\", \"SEP\", \"OCT\", \"NOV\", \"DEC\"];\n  const day = String(date.getDate()).padStart(2, '0');\n  const month = monthNames[date.getMonth()];\n  return `${day}${month}`;\n}\n\n// Format both dates\nconst formattedDeparture = formatDate(departureStr);\nconst formattedReturn = formatDate(returnStr);\n\n// Return the result\nreturn [\n  {\n    json: {\n      formattedDeparture,\n      formattedReturn\n    }\n  }\n];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -320,
        -96
      ],
      "id": "0947d6b0-4949-4238-90f0-c088ceea2d9a",
      "name": "Code3"
    },
    {
      "parameters": {
        "content": "Convierte fechas de YYYY‑MM‑DD al formato DDMMM (p. ej., 2025‑07‑20 → 20JUL).\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -384,
        -240
      ],
      "typeVersion": 1,
      "id": "0259cbcf-9f7b-4805-badd-0473dca34f13",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Mapea los datos de entrada al formato de la API usando valores predeterminados para los campos opcionales.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -144,
        -240
      ],
      "typeVersion": 1,
      "id": "c22fb966-290e-47b9-85bc-9158788d2a8c",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Llama a la API de búsqueda de vuelos de Icaro con un tiempo de espera de 4 minutos y lógica de reintento.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        80,
        -240
      ],
      "typeVersion": 1,
      "id": "9b08e155-71fb-48a4-a7e7-54ad0a6d632b",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://31.97.33.16:8002/search/icaro",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n      \"origin\": \"{{ $json.origin }}\",\n      \"destination\": \"{{ $json.destination }}\",\n      \"departure_date\": \"{{ $json.departure_date }}\",\n      \"return_date\": \"{{ $json.return_date }}\",\n      \"adults\": {{ $json.num_Adults }},\n      \"children\": {{ $json.num_Children }},\n      \"children_ages\": [{{ $json.childrens_Ages }}],\n      \"stopovers\": \"{{ $json.stopovers }}\",\n      \"luggage\": \"{{ $json.luggage }}\",\n      \"preferred_airlines\": [\"{{ $json.preferred_airlines }}\"]\n    }",
        "options": {
          "timeout": 240000
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        128,
        -96
      ],
      "id": "c2ca989b-2e7e-4e29-ac1b-9aab98c910a4",
      "name": "HTTP Request2",
      "executeOnce": true,
      "retryOnFail": false,
      "alwaysOutputData": true,
      "maxTries": 2,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "8a0c5339-b2e1-4bdb-8731-4a219faf08b7",
              "name": "origin",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Origin }}",
              "type": "string"
            },
            {
              "id": "bd9637f7-0851-4705-82e8-a19e1c186542",
              "name": "destination",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Flight_Destination }}",
              "type": "string"
            },
            {
              "id": "a652788c-f55a-4ad1-afd6-ee98c8f72b70",
              "name": "departure_date",
              "value": "={{ $json.formattedDeparture !== \"NaNundefined\" ? $json.formattedDeparture : \"\" }}",
              "type": "string"
            },
            {
              "id": "d7d4788a-c30a-4de0-a0c4-868fc1cc7871",
              "name": "return_date",
              "value": "={{ $json.formattedReturn !== \"NaNundefined\" ? $json.formattedReturn : \"\"}}",
              "type": "string"
            },
            {
              "id": "bc902576-4a3e-4bd7-bb54-a41566fa3691",
              "name": "num_Adults",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Num_Adults }}",
              "type": "number"
            },
            {
              "id": "fa969c5a-e42c-4498-bbe1-f9e4370f3a82",
              "name": "num_Children",
              "value": "={{ $json.Num_Children !== undefined && $json.Num_Children !== '' ? $json.Num_Children : 0 }}",
              "type": "string"
            },
            {
              "id": "444163e5-0f1d-4447-bd30-a68a9b4a591c",
              "name": "childrens_Ages",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Childrens_Ages }}",
              "type": "string"
            },
            {
              "id": "2cae9373-00af-41b4-8e39-450687e33e84",
              "name": "stopovers",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Stopovers || false }}",
              "type": "string"
            },
            {
              "id": "32cfd0ed-fd77-4320-bac1-f68ba13a6ba7",
              "name": "luggage",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Luggage || false}}",
              "type": "string"
            },
            {
              "id": "2948d0e8-a7cd-414f-bb54-2f06434e44eb",
              "name": "preferred_airlines",
              "value": "=[\"{{ $('When Executed by Another Workflow').item.json.BookingData.json.Airlines }}\"]",
              "type": "array"
            },
            {
              "id": "a18e5bf2-b928-49ca-9dd6-595e400fa51a",
              "name": "departure_time_range",
              "value": "=[{{ $('When Executed by Another Workflow').item.json.BookingData.json.Departure_Time_Range }}]",
              "type": "array"
            },
            {
              "id": "8a72fe7e-7426-4960-83ed-a2c86f7fcc15",
              "name": "return_time_range",
              "value": "=[{{ $('When Executed by Another Workflow').item.json.BookingData.json.Return_Time_Range }}]",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -96,
        -96
      ],
      "id": "cce4dd8a-fc59-4852-8f36-eab57015b3fb",
      "name": "Edit Fields1"
    }
  ],
  "connections": {
    "When Executed by Another Workflow": {
      "main": [
        [
          {
            "node": "Code3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code3": {
      "main": [
        [
          {
            "node": "Edit Fields1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request2": {
      "main": [
        [
          {
            "node": "Edit Fields",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields1": {
      "main": [
        [
          {
            "node": "HTTP Request2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "When Executed by Another Workflow": [
      {
        "BookingData": {
          "json": {
            "Name": "Gere",
            "Phone": 5493417417442,
            "Contact_Id": 1746198047,
            "Travel_Type": "Vuelo",
            "Origin": "Buenos Aires",
            "Destination": "Cancun",
            "Departure_date": "2025-07-20",
            "Check_In_Date": "",
            "Return_date": "2025-07-30",
            "Check_Out_Date": "",
            "Num_Adults": 2,
            "Num_Children": "",
            "Childrens_Ages": "",
            "Stopovers": true,
            "Luggage": true,
            "Airlines": ""
          },
          "pairedItem": {
            "item": 4
          }
        }
      }
    ]
  },
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}
*Flight Scrapper + API*
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "http://31.97.33.16:8002/search/icaro",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n      \"origin\": \"{{ $json.origin }}\",\n      \"destination\": \"{{ $json.destination }}\",\n      \"departure_date\": \"{{ $json.departure_date }}\",\n      \"return_date\": \"{{ $json.return_date }}\",\n      \"adults\": {{ $json.num_Adults }},\n      \"children\": {{ $json.num_Children }},\n      \"children_ages\": [{{ $json.childrens_Ages }}],\n      \"stopovers\": \"{{ $json.stopovers }}\",\n      \"luggage\": \"{{ $json.luggage }}\",\n      \"preferred_airlines\": [\"{{ $json.preferred_airlines }}\"],\n      \"departure_time_range\": [{{ $json.departure_time_range }}],\n      \"return_time_range\": [{{ $json.return_time_range }}]\n}",
        "options": {
          "timeout": 240000
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        128,
        -96
      ],
      "id": "1b40cbb5-54c0-4323-9d30-2eb3614f7e55",
      "name": "HTTP Request2",
      "executeOnce": true,
      "retryOnFail": false,
      "alwaysOutputData": true,
      "maxTries": 2,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "BookingData",
              "type": "object"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -544,
        -96
      ],
      "id": "97cea5e4-3439-4d53-85c8-b651112a0ad0",
      "name": "When Executed by Another Workflow"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "eb0c514b-6561-4966-af67-17894fe7dba4",
              "name": "Flights",
              "value": "={{ $('HTTP Request2').item.json.flights && $('HTTP Request2').item.json.flights !== null ? $('HTTP Request2').item.json.flights.slice(0,5).concat($json.Flights) : $json.Flights && $json.Flights !== null ? $json.Flights :  null}}",
              "type": "array"
            },
            {
              "id": "0b41ae71-6807-4a42-8eef-627c53a56e40",
              "name": "Retry",
              "value": "={{ $('HTTP Request2').item.json.search_params.retry_attempted }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        576,
        -96
      ],
      "id": "e7fa21dc-9da2-4c5e-aeaa-29ecfe87c73f",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "8a0c5339-b2e1-4bdb-8731-4a219faf08b7",
              "name": "origin",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Origin }}",
              "type": "string"
            },
            {
              "id": "bd9637f7-0851-4705-82e8-a19e1c186542",
              "name": "destination",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Flight_Destination }}",
              "type": "string"
            },
            {
              "id": "a652788c-f55a-4ad1-afd6-ee98c8f72b70",
              "name": "departure_date",
              "value": "={{ $json.formattedDeparture !== \"NaNundefined\" ? $json.formattedDeparture : \"\" }}",
              "type": "string"
            },
            {
              "id": "d7d4788a-c30a-4de0-a0c4-868fc1cc7871",
              "name": "return_date",
              "value": "={{ $json.formattedReturn !== \"NaNundefined\" ? $json.formattedReturn : \"\"}}",
              "type": "string"
            },
            {
              "id": "bc902576-4a3e-4bd7-bb54-a41566fa3691",
              "name": "num_Adults",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Num_Adults }}",
              "type": "number"
            },
            {
              "id": "fa969c5a-e42c-4498-bbe1-f9e4370f3a82",
              "name": "num_Children",
              "value": "={{ $json.Num_Children !== undefined && $json.Num_Children !== '' ? $json.Num_Children : 0 }}",
              "type": "string"
            },
            {
              "id": "444163e5-0f1d-4447-bd30-a68a9b4a591c",
              "name": "childrens_Ages",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Childrens_Ages }}",
              "type": "string"
            },
            {
              "id": "2cae9373-00af-41b4-8e39-450687e33e84",
              "name": "stopovers",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Stopovers || false }}",
              "type": "string"
            },
            {
              "id": "32cfd0ed-fd77-4320-bac1-f68ba13a6ba7",
              "name": "luggage",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Luggage || false}}",
              "type": "string"
            },
            {
              "id": "2948d0e8-a7cd-414f-bb54-2f06434e44eb",
              "name": "preferred_airlines",
              "value": "=[\"{{ $('When Executed by Another Workflow').item.json.BookingData.json.Airlines }}\"]",
              "type": "array"
            },
            {
              "id": "a18e5bf2-b928-49ca-9dd6-595e400fa51a",
              "name": "departure_time_range",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Departure_Time_Range }}",
              "type": "string"
            },
            {
              "id": "8a72fe7e-7426-4960-83ed-a2c86f7fcc15",
              "name": "return_time_range",
              "value": "={{ $('When Executed by Another Workflow').item.json.BookingData.json.Return_Time_Range }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        -96,
        -96
      ],
      "id": "74a35897-2f5e-4afb-a1c2-9d93e4562a1f",
      "name": "Edit Fields1"
    },
    {
      "parameters": {
        "jsCode": "// Get the date strings from previous node\nconst departureStr = $input.first().json.BookingData.json.Departure_date;\nconst returnStr = $input.first().json.BookingData.json.Return_date;\n\n// Helper function to format date to DDMMM\nfunction formatDate(dateStr) {\n  const date = new Date(dateStr);\n  const monthNames = [\"JAN\", \"FEB\", \"MAR\", \"APR\", \"MAY\", \"JUN\",\n                      \"JUL\", \"AUG\", \"SEP\", \"OCT\", \"NOV\", \"DEC\"];\n  const day = String(date.getDate()).padStart(2, '0');\n  const month = monthNames[date.getMonth()];\n  return `${day}${month}`;\n}\n\n// Format both dates\nconst formattedDeparture = formatDate(departureStr);\nconst formattedReturn = formatDate(returnStr);\n\n// Return the result\nreturn [\n  {\n    json: {\n      formattedDeparture,\n      formattedReturn\n    }\n  }\n];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -320,
        -96
      ],
      "id": "10104765-2a5f-42af-ad05-047d36473a7d",
      "name": "Code3"
    },
    {
      "parameters": {
        "workflowId": {
          "__rl": true,
          "value": "tCdHT1vAfy9INipo",
          "mode": "list",
          "cachedResultName": "Starling API"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "BookingData": "={{ $('When Executed by Another Workflow').item.json.BookingData }}"
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
        352,
        -96
      ],
      "id": "15ebe358-378d-4251-8f8e-fe3ff7ee381c",
      "name": "Execute Workflow",
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "content": "Receives BookingData from calling workflow with flight search parameters",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -608,
        -240
      ],
      "typeVersion": 1,
      "id": "192f776d-499c-4f5f-a791-efa2c2d792c7",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Converts dates from YYYY-MM-DD to DDMMM format with error handling",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -384,
        -240
      ],
      "typeVersion": 1,
      "id": "024f62ef-8667-456b-9e38-ead79d5d6c43",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Maps booking data to Icaro API format with date validation",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -144,
        -240
      ],
      "typeVersion": 1,
      "id": "ff1e19dc-3f87-444b-baeb-0368863115b3",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Calls Icaro flight search API with 4-minute timeout and retry logic",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        80,
        -240
      ],
      "typeVersion": 1,
      "id": "35bd0ec6-d778-4aa6-84f9-603101149c57",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Calls Starling API workflow for additional flight options",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        304,
        -240
      ],
      "typeVersion": 1,
      "id": "2e426eaf-ae8b-4070-a43a-158316f61d56",
      "name": "Sticky Note3"
    }
  ],
  "connections": {
    "HTTP Request2": {
      "main": [
        [
          {
            "node": "Execute Workflow",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "When Executed by Another Workflow": {
      "main": [
        [
          {
            "node": "Code3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields1": {
      "main": [
        [
          {
            "node": "HTTP Request2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code3": {
      "main": [
        [
          {
            "node": "Edit Fields1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Execute Workflow": {
      "main": [
        [
          {
            "node": "Edit Fields",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "When Executed by Another Workflow": [
      {
        "BookingData": {
          "json": {
            "Name": "Tomas",
            "Phone": 5492954602920,
            "Contact_Id": 5492954602920,
            "Time_Stamp": "2025-08-01 9:22",
            "Travel_Type": "Vuelo",
            "Origin": "EZE",
            "Flight_Destination": "MIA",
            "Departure_date": "2025-09-10",
            "Return_date": "2025-09-25",
            "Num_Adults": 2,
            "Num_Children": "",
            "Childrens_Ages": "",
            "Stopovers": "",
            "Luggage": true,
            "Airlines": "",
            "Departure_Time_Range": "",
            "Return_Time_Range": ""
          },
          "pairedItem": {
            "item": 0
          }
        }
      }
    ],
    "Edit Fields": [
      {
        "Flights": [
          {
            "airline": {
              "code": "AR",
              "name": "Aerolineas Argentinas",
              "display_name": "Icaro Flight - Aerolineas Argentinas"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "08:00"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "16:15"
                },
                "duration": "09h 15m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "09:10"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "19:15"
                },
                "duration": "09h 05m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.316,42",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "AR",
              "name": "Aerolineas Argentinas",
              "display_name": "Icaro Flight - Aerolineas Argentinas"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "08:00"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "16:15"
                },
                "duration": "09h 15m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "09:10"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "19:15"
                },
                "duration": "09h 05m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.316,42",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "AR",
              "name": "Aerolineas Argentinas",
              "display_name": "Icaro Flight - Aerolineas Argentinas"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "08:00"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "16:15"
                },
                "duration": "09h 15m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "18:25"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "04:30"
                },
                "duration": "09h 05m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.809,40",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "AR",
              "name": "Aerolineas Argentinas",
              "display_name": "Icaro Flight - Aerolineas Argentinas"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "08:00"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "16:15"
                },
                "duration": "09h 15m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "18:25"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "04:30"
                },
                "duration": "09h 05m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.809,40",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "AR",
              "name": "Aerolineas Argentinas",
              "display_name": "Icaro Flight - Aerolineas Argentinas"
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "08:00"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "16:15"
                },
                "duration": "09h 15m",
                "flight_type": "Non Stop",
                "layovers": []
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "MIAMI",
                  "time": "09:10"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "BUENOS AIRES",
                  "time": "19:15"
                },
                "duration": "09h 05m",
                "flight_type": "Non Stop",
                "layovers": []
              }
            ],
            "price": {
              "amount": "3.836,42",
              "currency": "USD"
            },
            "source": "icaro"
          },
          {
            "airline": {
              "code": "CM",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "00:06"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "16:59"
                },
                "duration": "17h 53m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "7h 16m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "14:20"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "03:58"
                },
                "duration": "12h 38m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "2h 16m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              }
            ],
            "price": {
              "amount": "1.495,22",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "CM",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "00:06"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "16:59"
                },
                "duration": "17h 53m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "7h 16m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "14:28"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "03:58"
                },
                "duration": "12h 30m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "2h 6m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              }
            ],
            "price": {
              "amount": "1.495,22",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "CM",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "00:06"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "22:26"
                },
                "duration": "23h 20m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "12h 44m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "14:20"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "03:58"
                },
                "duration": "12h 38m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "2h 16m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              }
            ],
            "price": {
              "amount": "1.514,22",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "CM",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "02:14"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "22:42"
                },
                "duration": "21h 28m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "10h 53m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "14:20"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "03:58"
                },
                "duration": "12h 38m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "2h 16m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              }
            ],
            "price": {
              "amount": "1.543,42",
              "currency": "USD"
            }
          },
          {
            "airline": {
              "code": "CM",
              "name": ""
            },
            "legs": [
              {
                "departure": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "02:14"
                },
                "arrival": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "22:42"
                },
                "duration": "21h 28m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "10h 53m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              },
              {
                "departure": {
                  "city_code": "MIA",
                  "city_name": "Miami, FL, USA",
                  "time": "14:28"
                },
                "arrival": {
                  "city_code": "EZE",
                  "city_name": "Buenos Aires, Buenos Aires, Argentina",
                  "time": "03:58"
                },
                "duration": "12h 30m",
                "flight_type": "1 escalas (PTY)",
                "layovers": [
                  {
                    "waiting_time": "2h 6m",
                    "destination_city": "Panama City, Panama",
                    "destination_code": "PTY"
                  }
                ]
              }
            ],
            "price": {
              "amount": "1.543,42",
              "currency": "USD"
            }
          }
        ],
        "Retry": "true"
      }
    ],
    "Edit Fields1": [
      {
        "origin": "EZE",
        "destination": "MIA",
        "departure_date": "10SEP",
        "return_date": "25SEP",
        "num_Adults": 2,
        "num_Children": "0",
        "childrens_Ages": "",
        "stopovers": "false",
        "luggage": "true",
        "preferred_airlines": [
          ""
        ],
        "departure_time_range": "",
        "return_time_range": ""
      }
    ]
  },
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}
*Hotel Scrapper*
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "http://31.97.33.16:8000/search",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n        \"destination\": \"{{ $json.Destination }}\",\n        \"checkin_date\": \"{{ $json.Check_In_Date }}\",\n        \"checkout_date\": \"{{ $json.Check_Out_Date }}\",\n        \"adults\": {{ $json.Num_Adults }},\n        \"children\": {{ $json.Num_Children }},\n        \"children_ages\": [{{ $json.Childrens_Ages }}]\n}",
        "options": {
          "timeout": 240000
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        -176,
        576
      ],
      "id": "fb0212de-f67b-429f-86e4-cb8a34e11abb",
      "name": "HTTP Request",
      "executeOnce": true,
      "retryOnFail": false,
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "4400d1c4-3f9c-47a5-aa45-d8490e94c647",
              "name": "Lozada",
              "value": "={{ $json.results.hotels }}",
              "type": "array"
            },
            {
              "id": "edf358ce-41a5-421b-bac4-55e096efcbc6",
              "name": "Delfos",
              "value": "={{ $('HTTP Request').item.json.results.hotels }}",
              "type": "array"
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
      "id": "7452f1c5-b4c3-42d0-83bc-b02d0750a407",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "55cce957-9aaf-4db2-a82b-f5c4f72b35c7",
              "name": "Num_Adults",
              "value": "={{ $json.BookingData.json.Num_Adults || 0}}",
              "type": "number"
            },
            {
              "id": "d0b83068-9ae6-4896-9a38-09a30e615b37",
              "name": "Num_Children",
              "value": "={{ $json.BookingData.json.Num_Children || 0 }}",
              "type": "number"
            },
            {
              "id": "7ebf5995-7457-4e44-ac64-88fb9acc899d",
              "name": "Destination",
              "value": "={{ $json.BookingData.json.Hotel_Destination.replaceSpecialChars() }}",
              "type": "string"
            },
            {
              "id": "7173ded5-0c58-4863-a9f3-ee91c88cc7cc",
              "name": "Check_In_Date",
              "value": "={{ $json.BookingData.json.Check_In_Date }}",
              "type": "string"
            },
            {
              "id": "b6a730e4-168c-463d-bf7d-f715d58d99cc",
              "name": "Check_Out_Date",
              "value": "={{ $json.BookingData.json.Check_Out_Date }}",
              "type": "string"
            },
            {
              "id": "2900cdc6-8a3d-4125-9144-ec84e2c2659d",
              "name": "Childrens_Ages",
              "value": "={{ $json.BookingData.json.Childrens_Ages }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        48,
        -64
      ],
      "id": "aa5c9001-92a1-442d-aefd-ea0d98f7efbb",
      "name": "Edit Fields1"
    },
    {
      "parameters": {
        "content": "Recibe BookingData del flujo de trabajo llamante con detalles de búsqueda de hotel.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -240,
        -208
      ],
      "typeVersion": 1,
      "id": "914554a8-dc46-4322-ac83-0198cb11b70e",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Mapea los datos de reserva al formato de la API con valores predeterminados para el número de huéspedes.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        0,
        -208
      ],
      "typeVersion": 1,
      "id": "7997f49f-7582-4e4c-9f57-35e32fe0471c",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Llama a la API de búsqueda de hoteles de Delfos con un tiempo de espera de 4 minutos.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -224,
        672
      ],
      "typeVersion": 1,
      "id": "27af518f-eda2-404f-b406-3018654c7cb6",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Llama a la API de búsqueda de hoteles de Lozada para obtener resultados adicionales.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        128,
        128
      ],
      "typeVersion": 1,
      "id": "792489c8-6913-498d-b404-09283483a0fc",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Combina los resultados de hoteles de las APIs de Delfos y Lozada.\n\n\n\n\n\n\n\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        352,
        128
      ],
      "typeVersion": 1,
      "id": "6c015b84-145b-4179-a010-62dfdd35eaa1",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "4400d1c4-3f9c-47a5-aa45-d8490e94c647",
              "name": "Lozada",
              "value": "={{ $json.Hotels }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        2640,
        160
      ],
      "id": "b2b5a346-0de9-4e88-9392-28afed9fc76c",
      "name": "Edit Fields2"
    },
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "BookingData",
              "type": "object"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -176,
        -64
      ],
      "id": "e0800528-608e-4867-880c-2ef22be88e8c",
      "name": "Trigger"
    },
    {
      "parameters": {
        "options": {}
      },
      "type": "n8n-nodes-base.xml",
      "typeVersion": 1,
      "position": [
        400,
        256
      ],
      "id": "2523c005-6ff6-4c06-8b76-2f952d4dcdfe",
      "name": "XML"
    },
    {
      "parameters": {
        "jsCode": "// n8n Function node\n// Input: items[0].json.ArrayOfHotelFare1.HotelFares = [ ...hotel objects ]\n// Output: one item per hotel with a flat structure\n\nfunction toArray(v) {\n  if (v == null) return [];\n  return Array.isArray(v) ? v : [v];\n}\n\nfunction text(v) {\n  if (v == null) return '';\n  if (typeof v === 'string' || typeof v === 'number') return String(v);\n  return v._ ?? '';\n}\n\nfunction extractStars(category) {\n  const m = String(category).match(/(\\d+)/);\n  return m ? m[1] : '';\n}\n\nfunction numberSafe(v) {\n  const n = parseFloat(text(v));\n  return isFinite(n) ? n : 0;\n}\n\nfunction euroFormat(num) {\n  return Number(num).toLocaleString('de-DE', {\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n  });\n}\n\nfunction sumTaxes(tax) {\n  if (!tax) return 0;\n  return toArray(tax).reduce((s, t) => s + numberSafe(t), 0);\n}\n\nconst hotels = $input.first().json.Hotels\n\nconst out = hotels.map((h) => {\n  const name = text(h.Name);\n  const stars = extractStars(text(h.Category));\n  const location = text(h.HotelAddress) || text(h.Location);\n\n  // currency from FareList\n  const currency = (h.FareList?.currency || '');\n\n  // find cheapest fare (Base + Tax)\n  const fares = toArray(h.FareList?.Fare).map((f) => {\n    const base = numberSafe(f.Base);\n    const tax = sumTaxes(f.Tax);\n    return { total: base + tax };\n  });\n  const cheapest = fares.length\n    ? fares.reduce((a, b) => (b.total < a.total ? b : a))\n    : null;\n  const price = cheapest ? euroFormat(cheapest.total) : '';\n\n  // optional: you can build a URL if you know the pattern\n  const link = null;\n\n  return {\n    name,\n    stars,\n    location,\n    currency,\n    price,\n    link,\n  };\n});\n\nreturn out.map((h) => ({ json: h }));\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1744,
        256
      ],
      "id": "b4004878-1abf-4307-8767-fef418f6e873",
      "name": "Code",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "// n8n Function node\n// Input: items[0].json['soap:Envelope']['soap:Body'].ArrayOfHotelFare1.HotelFares\n// Output: [{ Hotels: [ ... ] }]\n\nfunction toArray(v) {\n  if (v == null) return [];\n  return Array.isArray(v) ? v : [v];\n}\n\nconst input = $input.first().json;\nconst hotels = input?.['soap:Envelope']?.['soap:Body']?.ArrayOfHotelFare1?.HotelFares;\n\nreturn [\n  {\n    json: {\n      Hotels: toArray(hotels),\n    },\n  },\n];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        624,
        256
      ],
      "id": "85cfb22d-81dd-4744-8a26-71aa42637c52",
      "name": "Code1"
    },
    {
      "parameters": {
        "modelId": {
          "__rl": true,
          "value": "gpt-4.1-mini",
          "mode": "list",
          "cachedResultName": "GPT-4.1-MINI"
        },
        "messages": {
          "values": [
            {
              "content": "=You are a travel system helper. \nYour job is to return ONLY the city code (IATA-style, 3 letters) for the city the user asks about. \nDo not include extra text, explanations, or formatting. \nFor example:\n- Input: \"Madrid\" → Output: MAD\n- Input: \"Buenos Aires\" → Output: BUE\n- Input: \"New York\" → Output: NYC\n- Input: \"London\" → Output: LON\n\nNow return the city code for: {{ $json.Destination }}\n"
            }
          ]
        },
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.openAi",
      "typeVersion": 1.8,
      "position": [
        -176,
        256
      ],
      "id": "a6394bed-0b82-4272-bf5b-20f4af45cd4a",
      "name": "Message a model",
      "credentials": {
        "openAiApi": {
          "id": "wOHaMLW8yduV0Uay",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "return [{Hotels: $input.all().map(item => item.json)}]"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2416,
        160
      ],
      "id": "75832c9c-5c8a-46e2-bb54-12e4d360aa95",
      "name": "Code2"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "SOAPAction",
              "value": "\"searchHotelFares\""
            }
          ]
        },
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml; charset=utf-8",
        "body": "=<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <searchHotelFaresRQ1 xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\">\n      <cityLocation code=\"{{ $json.message.content }}\" xmlns=\"\" />\n      <dateFrom xmlns=\"\">{{ $('Edit Fields1').item.json.Check_In_Date }}</dateFrom>\n      <dateTo xmlns=\"\">{{ $('Edit Fields1').item.json.Check_Out_Date }}</dateTo>\n      <name>{{ $('Trigger').item.json.BookingData.json.Preferred_Hotel }}</name>\n      <pos xmlns=\"\">\n        <id>LOZADAWS</id>\n        <clave>.LOZAWS23.</clave>\n      </pos>\n      <currency xmlns=\"\">USD</currency>\n    </searchHotelFaresRQ1>\n  </soap:Body>\n</soap:Envelope>",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        176,
        256
      ],
      "id": "09b7e710-618b-4bee-be36-1596b974c802",
      "name": "HTTP Request2"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://test.eurovips.itraffic.com.ar/WSBridge_EuroTest/BridgeService.asmx",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "SOAPAction",
              "value": "\"searchHotelFares\""
            }
          ]
        },
        "sendBody": true,
        "contentType": "raw",
        "rawContentType": "text/xml; charset=utf-8",
        "body": "=<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">\n  <soap:Body>\n    <searchHotelFaresRQ1 xmlns=\"http://www.softur.com.ar/wsbridge/budget.wsdl\">\n      <cityLocation code=\"{{ $('Message a model').item.json.message.content }}\" xmlns=\"\" />\n      <dateFrom xmlns=\"\">{{ $('Edit Fields1').item.json.Check_In_Date }}</dateFrom>\n      <dateTo xmlns=\"\">{{ $('Edit Fields1').item.json.Check_Out_Date }}</dateTo>\n      <name xmlns=\"\" />\n      <pos xmlns=\"\">\n        <id>LOZADAWS</id>\n        <clave>.LOZAWS23.</clave>\n      </pos>\n      <currency xmlns=\"\">USD</currency>\n      <OtherBroker xmlns=\"\">true</OtherBroker>\n      <FareTypeSelectionList xmlns=\"http://www.softur.com.ar/wsbridge/budget.xsd\">\n        <FareTypeSelection OccupancyId=\"1\">1</FareTypeSelection>\n        <Ocuppancy OccupancyId=\"1\">\n          <Occupants type=\"ADT\" />\n          <Occupants type=\"ADT\" />\n        </Ocuppancy>\n      </FareTypeSelectionList>\n    </searchHotelFaresRQ1>\n  </soap:Body>\n</soap:Envelope>",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        848,
        256
      ],
      "id": "9f332cc4-ecfb-45af-8a02-00885f85837c",
      "name": "HTTP Request3"
    },
    {
      "parameters": {
        "options": {}
      },
      "type": "n8n-nodes-base.xml",
      "typeVersion": 1,
      "position": [
        1072,
        256
      ],
      "id": "fb5d082b-2049-482d-b2ac-a6a87ce8d4d6",
      "name": "XML1"
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
              "id": "2c8557f2-5c00-429d-94f8-d80cfc084aab",
              "leftValue": "={{ $json.name.toLowerCase() }}",
              "rightValue": "={{ $('Trigger').item.json.BookingData.json.Preferred_Hotel.toLowerCase() }}",
              "operator": {
                "type": "string",
                "operation": "contains"
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
        1968,
        256
      ],
      "id": "15b3292e-83f2-4ca1-a1fa-4d324b86d316",
      "name": "Filter",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "// n8n Function node\n// Input: items[0].json['soap:Envelope']['soap:Body'].ArrayOfHotelFare1.HotelFares\n// Output: [{ Hotels: [ ... ] }]\n\nfunction toArray(v) {\n  if (v == null) return [];\n  return Array.isArray(v) ? v : [v];\n}\n\nconst input = $input.first().json;\nconst hotels = input?.['soap:Envelope']?.['soap:Body']?.ArrayOfHotelFare1?.HotelFares;\n\nreturn [\n  {\n    json: {\n      Hotels: toArray(hotels),\n    },\n  },\n];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1296,
        256
      ],
      "id": "c950dce7-9e20-41b6-a9ea-390972a0d7b4",
      "name": "Code3"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "29c28c8b-8600-4f9f-8b3a-b8606b0def64",
              "name": "Hotels",
              "value": "={{ $json.Hotels.concat($('Code1').item.json.Hotels) }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1520,
        256
      ],
      "id": "018fd1e4-a23a-45b8-9e5f-cd90e2a56386",
      "name": "Edit Fields3"
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
              "id": "2c0ab29b-7f3d-4bd5-afc6-485008a1b0df",
              "leftValue": "={{ $json }}",
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
        2192,
        256
      ],
      "id": "4a6bc4d7-fc5e-4146-8293-adb6aef14772",
      "name": "If"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "4400d1c4-3f9c-47a5-aa45-d8490e94c647",
              "name": "Hotels",
              "value": "={{ $('Edit Fields3').item.json.Hotels.reverse().slice(0,9) }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        2416,
        352
      ],
      "id": "e6be58c9-b299-4d40-9975-e769e72713bb",
      "name": "Edit Fields4"
    },
    {
      "parameters": {
        "jsCode": "// n8n Function node\n// Input: items[0].json.ArrayOfHotelFare1.HotelFares = [ ...hotel objects ]\n// Output: one item per hotel with a flat structure\n\nfunction toArray(v) {\n  if (v == null) return [];\n  return Array.isArray(v) ? v : [v];\n}\n\nfunction text(v) {\n  if (v == null) return '';\n  if (typeof v === 'string' || typeof v === 'number') return String(v);\n  return v._ ?? '';\n}\n\nfunction extractStars(category) {\n  const m = String(category).match(/(\\d+)/);\n  return m ? m[1] : '';\n}\n\nfunction numberSafe(v) {\n  const n = parseFloat(text(v));\n  return isFinite(n) ? n : 0;\n}\n\nfunction euroFormat(num) {\n  return Number(num).toLocaleString('de-DE', {\n    minimumFractionDigits: 2,\n    maximumFractionDigits: 2,\n  });\n}\n\nfunction sumTaxes(tax) {\n  if (!tax) return 0;\n  return toArray(tax).reduce((s, t) => s + numberSafe(t), 0);\n}\n\nconst hotels = $input.first().json.Hotels\n\nconst out = hotels.map((h) => {\n  const name = text(h.Name);\n  const stars = extractStars(text(h.Category));\n  const location = text(h.HotelAddress) || text(h.Location);\n\n  // currency from FareList\n  const currency = (h.FareList?.currency || '');\n\n  // find cheapest fare (Base + Tax)\n  const fares = toArray(h.FareList?.Fare).map((f) => {\n    const base = numberSafe(f.Base);\n    const tax = sumTaxes(f.Tax);\n    return { total: base + tax };\n  });\n  const cheapest = fares.length\n    ? fares.reduce((a, b) => (b.total < a.total ? b : a))\n    : null;\n  const price = cheapest ? euroFormat(cheapest.total) : '';\n\n  // optional: you can build a URL if you know the pattern\n  const link = null;\n\n  return {\n    name,\n    stars,\n    location,\n    currency,\n    price,\n    link,\n  };\n});\n\nreturn out.map((h) => ({ json: h }));\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2640,
        352
      ],
      "id": "b421250e-468d-4885-994d-cfb8e2666eb0",
      "name": "Code4",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "jsCode": "return [{Lozada:$input.all().map(item => item.json)}]"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2864,
        352
      ],
      "id": "8d0c2ca6-a5be-4abd-ba6e-e74fe7501cc0",
      "name": "Code5"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "4400d1c4-3f9c-47a5-aa45-d8490e94c647",
              "name": "Lozada",
              "value": "={{ $json.results.hotels }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        496,
        -64
      ],
      "id": "fcf02305-848f-4dda-af27-7edc157261b5",
      "name": "Edit Fields5"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://31.97.33.16:8001/search",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n        \"destination\": \"{{ $('Edit Fields1').item.json.Destination }}\",\n        \"checkin_date\": \"{{ $('Edit Fields1').item.json.Check_In_Date }}\",\n        \"checkout_date\": \"{{ $('Edit Fields1').item.json.Check_Out_Date }}\",\n        \"adults\": {{ $('Edit Fields1').item.json.Num_Adults }},\n        \"children\": {{ $('Edit Fields1').item.json.Num_Children }},\n        \"children_ages\": [{{ $('Edit Fields1').item.json.Childrens_Ages }}],\n        \"all_inclusive\": \"{{ $('Trigger').item.json.BookingData.json.All_Inclusive || false }}\",\n        \"breakfast_included\": \"{{ $('Trigger').item.json.BookingData.json.Breakfast_Included || false }}\",\n        \"half_board\": \"{{ $('Trigger').item.json.BookingData.json.Half_Board || false}}\",\n        \"refundable\": \"{{ $('Trigger').item.json.BookingData.json.Refundable || false}}\",\n        \"room_only\": \"{{ $('Trigger').item.json.BookingData.json.Room_Only || false}}\",\n        \"preferred_hotel\": \"{{ $('Trigger').item.json.BookingData.json.Preferred_Hotel || \"\" }}\"\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        272,
        -64
      ],
      "id": "cf1d877a-a511-4633-be93-27bf65cb903f",
      "name": "Lozada",
      "executeOnce": true,
      "retryOnFail": false,
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    }
  ],
  "connections": {
    "HTTP Request": {
      "main": [
        []
      ]
    },
    "Edit Fields1": {
      "main": [
        [
          {
            "node": "Lozada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Trigger": {
      "main": [
        [
          {
            "node": "Edit Fields1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "XML": {
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
    "Code": {
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
    "Code1": {
      "main": [
        [
          {
            "node": "HTTP Request3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Message a model": {
      "main": [
        [
          {
            "node": "HTTP Request2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code2": {
      "main": [
        [
          {
            "node": "Edit Fields2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request2": {
      "main": [
        [
          {
            "node": "XML",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request3": {
      "main": [
        [
          {
            "node": "XML1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "XML1": {
      "main": [
        [
          {
            "node": "Code3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filter": {
      "main": [
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code3": {
      "main": [
        [
          {
            "node": "Edit Fields3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields3": {
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
    "If": {
      "main": [
        [
          {
            "node": "Code2",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Edit Fields4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields4": {
      "main": [
        [
          {
            "node": "Code4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code4": {
      "main": [
        [
          {
            "node": "Code5",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code5": {
      "main": [
        []
      ]
    },
    "Lozada": {
      "main": [
        [
          {
            "node": "Edit Fields5",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "Trigger": [
      {
        "BookingData": {
          "json": {
            "Name": "Tomas",
            "Phone": 5492954602920,
            "Contact_Id": 5492954602920,
            "Time_Stamp": "2025-08-28 8:13",
            "Travel_Type": "Hotel",
            "Hotel_Destination": "plata del carmen",
            "Check_In_Date": "2025-09-10",
            "Check_Out_Date": "2025-09-19",
            "Num_Adults": 2,
            "Num_Children": "",
            "Childrens_Ages": "",
            "Room_Only": "",
            "Refundable": "",
            "Half_Board": "",
            "Breakfast_Included": "",
            "All_Inclusive": true,
            "Travel_Assistance": "",
            "Transfers": "",
            "Preferred_Hotel": "iberostar",
            "Hotel_Chain": "iberostar",
            "Hotel_Stars": ""
          },
          "pairedItem": {
            "item": 0
          }
        }
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}
*Starling API*
{
  "nodes": [
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "BookingData",
              "type": "object"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -144,
        -336
      ],
      "id": "fc24cedc-8e56-494b-8d0d-8289fd603b5e",
      "name": "Trigger"
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $('Trigger').item.json.BookingData.json.toJsonString() }}\nToken: {{ $json.data }}",
        "options": {
          "systemMessage": "=You are an intelligent agent that transforms structured flight booking data into a valid `FlightAvailabilityQuery` JSON object.\nFollow the strict schema and logic below to produce a valid output.\n\n---\n\n### 🔁 **Input Format**\n\nYou will be given JSON input structured as:\n{\n  \"BookingData\": {\n    \"json\": {\n      \"Name\": \"Mudassir\",\n      \"Phone\": 923180595674,\n      \"Contact_Id\": 923180595674,\n      \"Travel_Type\": \"Vuelo\",\n      \"Origin\": \"MAD\",\n      \"Flight_Destination\": \"\",\n      \"Departure_date\": \"2025-08-14\",\n      \"Return_date\": \"\",\n      \"Num_Adults\": 2,\n      \"Num_Children\": \"\",\n      \"Childrens_Ages\": \"\",\n      \"Stopovers\": true,\n      \"Luggage\": \"\",\n      \"Airlines\": \"\",\n      \"Departure_Time_Range\": \"6,16\",\n      \"Return_Time_Range\": \"\"\n    },\n    \"pairedItem\": {\n      \"item\": 0\n    }\n  }\n}\n\nToken: \"a5bc43f4ec5a43e5P100457\"\n\n\n### 🧠 **Transformation Rules**\n\n1. **Token**\n   Set `\"Token\"` to `Token provided by user`.\n\n2. **Legs (QueryLeg\\[])**\n\n   * Create one object for **each flight leg**:\n\n     * Outbound: Use `\"Origin\"` as `\"DepartureAirportCity\"` and `\"Destination\"` as `\"ArrivalAirportCity\"` with `\"Departure_date\"`.\n     * Return (if `\"Return_date\"` exists): Add a second leg, reversing origin and destination, using `\"Return_date\"`.\n   * Use **IATA 3-letter codes** for the cities. You may assume mapping exists for standard cities (e.g., Madrid = MAD, Barcelona = BCN).\n\n3. **Passengers (PaxOption\\[])**\n\n   * Always include one object **per passenger type** present in the booking.\n   * Use:\n\n     * `\"Type\": \"ADT\"` for adults (use `\"Num_Adults\"`).\n     * `\"Type\": \"CHD\"` for children (use `\"Num_Children\"`, omit if blank).\n     * `\"Type\": \"INF\"` if infant ages were provided.\n\n4. **Optional Fields**\n\n   * Set the Currency to `USD` and Airlines to `null` **unless explicitly provided**:\n\n     * `\"Airlines\"`\n     * `\"Currency\"`\n\n---\n\n### ✅ **Output Example**\n\nFor the provided input above, return:\n\n{\n  \"Token\": \"{{ $json.data }}\",\n  \"Legs\": [\n    {\n      \"DepartureAirportCity\": \"MAD\",\n      \"ArrivalAirportCity\": \"BCN\",\n      \"FlightDate\": \"2025-06-06\"\n    },\n    {\n      \"DepartureAirportCity\": \"BCN\",\n      \"ArrivalAirportCity\": \"MAD\",\n      \"FlightDate\": \"2025-06-10\"\n    }\n  ],\n  \"Passengers\": [\n    {\n      \"Type\": \"ADT\",\n      \"Count\": 1\n    }\n  ],\n  \"Airlines\": null,\n  \"Currency\": \"USD\"\n}\n"
        }
      },
      "type": "@n8n/n8n-nodes-langchain.agent",
      "typeVersion": 1.9,
      "position": [
        304,
        -336
      ],
      "id": "a5533549-761f-423c-acf4-2df02658f80c",
      "name": "AI Agent"
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "mode": "list",
          "value": "gpt-4o-mini"
        },
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
      "typeVersion": 1.2,
      "position": [
        384,
        -112
      ],
      "id": "e01f9b3a-1eec-46c1-bc11-0348fb40038c",
      "name": "OpenAI Chat Model",
      "credentials": {
        "openAiApi": {
          "id": "wOHaMLW8yduV0Uay",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://apihv2.webtravelcaster.com/api/1.6/FlightService.json/GetFlightAvailability",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.Body.toJsonString() }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        880,
        -336
      ],
      "id": "58206488-d51d-4193-b1a4-ad907c8713a2",
      "name": "API call"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "2e656fce-a17d-47dc-b8b3-ad5a12755773",
              "name": "Body",
              "value": "={{ $json.output.parseJson() }}",
              "type": "object"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        656,
        -336
      ],
      "id": "baf8a236-fbb9-4fbf-8d40-27075987051c",
      "name": "Input"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://apihv2.webtravelcaster.com/api/1.6/FlightService.json/GetAccessToken",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\n    \"username\": \"apilozadaweb\", \n    \"password\": \"FZsP$19gX%\" \n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        80,
        -336
      ],
      "id": "e1d76d80-78f5-46e7-8029-4b384a2f7d70",
      "name": "Get Token"
    },
    {
      "parameters": {
        "content": "Recibe BookingData del flujo de trabajo llamante con parámetros de búsqueda de vuelo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -192,
        -480
      ],
      "typeVersion": 1,
      "id": "c14dc88c-12c4-40ed-ad2f-9f9e33ad5c0c",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Obtiene el token de autenticación de la API de Starling para acceso seguro.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        48,
        -480
      ],
      "typeVersion": 1,
      "id": "29be7d77-f3ab-41aa-ae60-8abfa16d590f",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Usa IA para transformar los datos de reserva al formato de la API de Starling con códigos IATA adecuados.\n\n",
        "height": 300,
        "width": 320
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        256,
        -480
      ],
      "typeVersion": 1,
      "id": "de7adfb4-8427-48d4-a890-aff9b3e85faf",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Analiza la salida de la IA y prepara el cuerpo JSON para la llamada a la API.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        608,
        -480
      ],
      "typeVersion": 1,
      "id": "575e0e18-8dd8-47b4-916c-d443e5e02165",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Llama a la API de disponibilidad de vuelos de Starling con la solicitud formateada.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        848,
        -480
      ],
      "typeVersion": 1,
      "id": "5c96b156-d973-4879-b19c-63fe34d3a061",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "99bc9a71-5c39-42b3-901f-094925ecd7cf",
              "name": "Flights",
              "value": "={{ $json.filteredFares.slice(0,5) }}",
              "type": "array"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1328,
        -336
      ],
      "id": "ef8bb024-11ef-43b2-bb46-b228c34def00",
      "name": "Flights"
    },
    {
      "parameters": {
        "jsCode": "// === Static airport data ===\nconst airportData = $input.first().json.IATA\n// === Build lookup maps ===\nconst airportMap = airportData.reduce((acc, curr) => {\n  acc[curr.code] = curr.location;\n  return acc;\n}, {});\n\n// === Helpers ===\nfunction getTime(dateStr, timeStr) {\n  if (!dateStr || !timeStr) return '';\n  return timeStr;\n}\n\nfunction formatDuration(minutes) {\n  if (typeof minutes !== 'number') return '';\n  const h = Math.floor(minutes / 60);\n  const m = minutes % 60;\n  return `${h}h ${m}m`;\n}\n\n// === Process all items ===\nreturn $('Split Out').all().map(item => {\n  const input = item.json;\n\n  const legs = Array.isArray(input?.Legs) ? input.Legs.map(leg => {\n    const firstOption = leg.Options?.[0];\n    const segments = firstOption?.Segments;\n\n    if (!Array.isArray(segments) || segments.length === 0) return {};\n\n    const departureSegment = segments[0];\n    const arrivalSegment = segments[segments.length - 1];\n\n    const layovers = segments.slice(0, -1).map((seg, index) => {\n      const nextSeg = segments[index + 1];\n      if (!nextSeg) return null;\n\n      const layoverDurationMinutes = (() => {\n        const dep = new Date(`${nextSeg.Departure?.Date}T${nextSeg.Departure?.Time}:00Z`);\n        const arr = new Date(`${seg.Arrival?.Date}T${seg.Arrival?.Time}:00Z`);\n        const diff = (dep - arr) / (1000 * 60);\n        return diff > 0 ? diff : 0;\n      })();\n\n      return {\n        waiting_time: formatDuration(layoverDurationMinutes),\n        destination_city: airportMap[seg.Arrival?.AirportCode] || '',\n        destination_code: seg.Arrival?.AirportCode || ''\n      };\n    }).filter(Boolean);\n\n    const flightType = segments.length > 1\n      ? `${segments.length - 1} escalas (${segments.slice(0, -1).map(s => s.Arrival?.AirportCode).join(',')})`\n      : 'Non Stop';\n\n    return {\n      departure: {\n        city_code: departureSegment.Departure?.AirportCode || '',\n        city_name: airportMap[departureSegment.Departure?.AirportCode] || '',\n        time: getTime(departureSegment.Departure?.Date, departureSegment.Departure?.Time)\n      },\n      arrival: {\n        city_code: arrivalSegment.Arrival?.AirportCode || '',\n        city_name: airportMap[arrivalSegment.Arrival?.AirportCode] || '',\n        time: getTime(arrivalSegment.Arrival?.Date, arrivalSegment.Arrival?.Time)\n      },\n      duration: formatDuration(firstOption?.OptionDuration || 0),\n      flight_type: flightType,\n      layovers: layovers\n    };\n  }) : [];\n\n  const result = {\n    airline: {\n      code: input?.ValidatingCarrier || '',\n      name: \"Starling Flight - \" + input?.ValidatingCarrier || ''// You can add airline name lookup similarly\n    },\n    legs: legs,\n    price: {\n      amount: typeof input?.TotalAmount === 'number'\n        ? input.TotalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 })\n        : '',\n      currency: input?.Currency || ''\n    }\n  };\n\n  return { json: result };\n});\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2000,
        -336
      ],
      "id": "cfdcc6ac-830c-449c-9c26-cd8eff44dbaa",
      "name": "Code",
      "executeOnce": false
    },
    {
      "parameters": {
        "fieldToSplitOut": "Flights",
        "options": {}
      },
      "type": "n8n-nodes-base.splitOut",
      "typeVersion": 1,
      "position": [
        1552,
        -336
      ],
      "id": "50e60477-c6ea-4a5b-8ad7-82460d64f400",
      "name": "Split Out"
    },
    {
      "parameters": {
        "jsCode": "const input = `\nAAE –  Annaba, Algeria – Les Salines\nAAL –  Aalborg, Denmark – Aalborg\nAAR –  Aarhus, Denmark – Tirstrup\nABE –  Allentown, PA, USA – Allentown-Bethlehem-Easton Airport\nABI –  Abilene, TX, USA – Municipal\nABJ –  Abidjan, Cote D'ivoire – Port Bouet\nABL –  Ambler, AK, USA\nABM –  Bamaga, Queensland, Australia\nABQ –  Albuquerque, NM, USA – Albuquerque International Airport\nABR –  Aberdeen, SD, USA – Aberdeen Regional Airport\nABS –  Abu Simbel, Egypt – Abu Simbel\nABX –  Albury, New South Wales, Australia – Albury\nABY –  Albany, GA, USA – Dougherty County\nABZ –  Aberdeen, Scotland, United Kingdom – Dyce\nACA –  Acapulco, Guerrero, Mexico – Alvarez International\nACC –  Accra, Ghana – Kotoka\nACE –  Lanzarote, Canary Islands, Spain – Lanzarote\nACI –  Alderney, Channel Islands, United Kingdom – The Blaye\nACK –  Nantucket, MA, USA\nACT –  Waco, TX, USA – Madison Cooper\nACV –  Arcata, CA, USA – Arcata/Eureka Airport\nACY –  Atlantic City /Atlantic Cty, NJ, USA – Atlantic City International\nADA –  Adana, Turkey – Adana\nADB –  Izmir, Turkey – Adnam Menderes\nADD –  Addis Ababa, Ethiopia – Bole\nADJ –  Amman, Jordan – Civil\nADL –  Adelaide, South Australia, Australia – Adelaide\nADQ –  Kodiak, AK, USA\nADZ –  San Andres Island, Colombia\nAEP –  Buenos Aires, Buenos Aires, Argentina – Jorge Newbery\nAES –  Aalesund, Norway – Vigra\nAET –  Allakaket, AK, USA\nAEX –  Alexandria, LA, USA – Alexandria Intl Airport\nAEY –  Akureyri, Iceland – Akureyri\nAGA –  Agadir, Morocco – Inezgane\nAGB –  Augsburg, Germany – Muehlhausen\nAGF –  Agen, France – La Garenne\nAGH –  Helsingborg, Sweden – Angelholm/Helsingborg\nAGP –  Malaga, Spain – Malaga\nAGR –  Agra, India – Kheria\nAGS –  Augusta, GA, USA – Bush Field\nAGU –  Aguascalientes, Aguascalientes, Mexico\nAHN –  Athens, GA, USA\nAHO –  Alghero, Sardinia, Italy – Fertilia\nAIA –  Alliance, NE, USA\nAIN –  Wainwright, AK, USA\nAJN – Anjouan, Comoros\nAJA –  Ajaccio, Corsica, France – Campo Dell Oro\nAJU –  Aracaju, Sergipe, Brazil\nAKJ –  Asahikawa, Japan – Asahikawa\nAKL –  Auckland, New Zealand – Auckland International Airport\nALA –  Almaty, Kazakhstan – Almaty\nALB –  Albany, NY, USA – Albany County Airport\nALC –  Alicante, Spain – Alicante\nALE –  Alpine, TX, USA – Alpine Texas\nALF –  Alta, Norway – Elvebakken\nALG –  Algiers, Algeria – Houari Boumedienne\nALM –  Alamogordo, NM, USA\nALO –  Waterloo, IA, USA – Waterloo Municipal Airport\nALP –  Aleppo, Syria – Nejrab\nALS –  Alamosa, CO, USA – Bergman Field\nALW –  Walla Walla, WA, USA\nALY –  Alexandria, Egypt – Alexandria\nAMA –  Amarillo, TX, USA – Amarillo International Airport\nAMD –  Ahmedabad, India – Ahmedabad\nAMI –  Mataram, Indonesia – Selaparang\nAMM –  Amman, Jordan – Queen Alia International\nAMQ –  Ambon, Indonesia – Pattimura\nAMS –  Amsterdam, Netherlands – Schiphol\nANB –  Anniston, AL, USA – Municipal\nANC –  Anchorage, AK, USA – Anchorage International\nANF –  Antofagasta, Chile – Cerro Moreno\nANG –  Angouleme, France – Gel-Air\nANI –  Aniak, AK, USA\nANR –  Antwerp, Belgium – Deurne\nANU –  Saint Johns / Antigua, Antigua And Barbuda – Vc Bird International\nANV –  Anvik, AK, USA\nAOI –  Ancona, Italy – Falconara\nAOJ –  Aomori, Japan\nAOK –  Karpathos, Greece – Karpathos\nAOO –  Altoona / Martinsburg, PA, USA – Blair County\nAOR –  Alor Setar, Malaysia – Sultan Abdul Halim\nAPF –  Naples, FL, USA\nAPL –  NampulaMozambique\nAPN –  Alpena, MI, USA – Alpena Regional Airport\nAPW –  Apia, Samoa – Faleolo\nAQJ –  Aqaba, Jordan – Aqaba\nAQP –  Arequipa, Peru – Rodriguez Ballon\nARH –  Arkhangelsk, Russia – Arkhangelsk\nARI –  Arica, Chile – Chacalluta\nARM –  Armidale, New South Wales, Australia – Armidale\nARN –  Stockholm, Sweden – Arlanda International\nART –  Watertown, NY, USA – Watertown\nASD –  Andros Town, Bahamas\nASE –  Aspen, CO, USA – Pitkin County Airport Sardy Field\nASM –  Asmara, Eritrea – Asmara Intl/Yohannes Iv\nASP –  Alice Springs, Northern Territory, Australia – Alice Springs\nASU –  Asuncion, Paraguay – Silvio Pettirossi\nASW –  Aswan, Egypt – Daraw\nATC –  Arthurs Town, Bahamas\nATH –  Athens, Greece – Hellinikon\nATL –  Atlanta, GA, USA – Hartsfield International\nATW –  Appleton, WI, USA – Outagamie County Airport\nATY –  Watertown, SD, USA\nAUA –  Aruba, Aruba – Reina Beatrix\nAUC –  Arauca, Colombia\nAUG –  Augusta, ME, USA – Maine State\nAUH –  Abu Dhabi, United Arab Emirates – Abu Dhabi International\nAUS –  Austin, TX, USA – Robert Mueller Municipal Airport\nAVL –  Asheville / Hendersonville, NC, USA – Asheville Regional Airport\nAVN –  Avignon, France – Caumont\nAVP –  Wilkes Barre/Scranton, PA, USA – Wilkes-Barre/Scranton Intl\nAXA –  Anguilla, Anguilla\nAXD –  Alexandroupolis, Greece – Alexandroupolis\nAYQ –  Ayers Rock, Northern Territory, Australia – Connellan\nAYT –  Antalya, Turkey – Antalya\nAZO –  Kalamazoo, MI, USA – Kalamazoo/Battle Creek Intl\nBAH –  Bahrain, Bahrain – Bahrain International Bahrain\nBAK –  Baku, Azerbaijan – Baku\nBAL –  Batman, Turkey – Nearest Air Service Through Diyarbakir\nBAQ –  Barranquilla, Colombia – E Cortissoz\nBAX –  Barnaul, Russia – Barnaul Airport\nBBI –  Bhubaneswar, India – Bhubaneswar\nBBK –  Kasane, Botswana – Kasane\nBBU –  Bucharest, Romania – Baneasa\nBCD –  Bacolod, Philippines – Bacolod\nBCN –  Barcelona, Spain – Barcelona\nBDA –  Bermuda/Hamilton, Bermuda – Kindley Airfield/Civil Air\nBDJ  Terminal – Banjarmasin, Indonesia – Syamsudin Noor\nBDL –  Hartford, CT, USA – Bradley International Airport\nBDO –  Bandung, Indonesia – Husein Sastranegara\nBDQ –  Vadodara, India – Vadodara\nBDR –  Bridgeport, CT, USA – Sikorsky Memorial\nBED –  Bedford, MA, USA – Bedford\nBEG –  Belgrade, Yugoslavia – Belgrade-Beograd\nBEH –  Benton Harbor, MI, USA – Ross Field\nEIB –  Beica, Ethiopia – Beica\nBEL – Belem, Para, Brazil – Val De Cans\nBEO –  Newcastle, New South Wales, Australia – Belmont\nBER –  Berlin, Germany – Schoenefeld\nBES –  Brest, France – Guipavas\nBET –  Bethel, AK, USA – Bethel\nBEW –  Beira, Mozambique – Beira\nBEY –  Beirut, Lebanon – International\nBFD –  Bradford, PA, USA – Bradford Regional\nBFF –  Scottsbluff, NE, USA – William B Heiling Field\nBFL –  Bakersfield, CA, USA – Meadows Field\nBFN –  Bloemfontein, South Africa – Jbm Hertzog\nBFS –  Belfast, Northern Ireland, United Kingdom – Belfast International\nBGA –  Bucaramanga, Colombia – Palo Negro\nBGF –  Bangui, Central African Republic – Bangui\nBGI –  Bridgetown, Barbados – Grantley Adams International\nBGK –  Big Creek, Belize – Big Creek\nBGM –  Binghamton/Endicott/Johnson City, NY, USA – Edwin Alink Field\nBGO –  Bergen, Norway – Flesland\nBGR –  Bangor, ME, USA – Bangor International Airport\nBGY –  Milan, Italy – Orio Al Serio\nBHB –  Bar Harbor, ME, USA\nBHD –  Belfast, Northern Ireland, United Kingdom – Belfast Harbor\nBHI –  Bahia Blanca, Buenos Aires, Argentina – Commandante\nBHK –  Bukhara, Uzbekistan\nBHM –  Birmingham, AL, USA – Seibels/Bryan Airport\nBHQ –  Broken Hill, New South Wales, Australia – Broken Hill\nBHS –  Bathurst, New South Wales, Australia – Raglan\nBHX –  Birmingham, England, United Kingdom – International\nBIA –  Bastia, Corsica, France – Poretta\nBIK –  Biak, Indonesia – Mokmer\nBIL –  Billings, MT, USA – Billings Logan Intnl Airport\nBIM –  Bimini, Bahamas – Bimini Island International\nBIO –  Bilbao, Spain – Sondica\nBIQ –  Biarritz, France – Parme\nBIS –  Bismarck, ND, USA – Bismarck Mannan Municipal\nBJI –  Bemidji, MN, USA – Bemidji Municipal Airport\nBJL –  Banjul, Gambia – Yundum International\nBJX –  Leon/Guanajuato, Guanajuato, Mexico – Del Bajio\nBKI –  Kota Kinabalu, Sabah, Malaysia – Kota Kinabalu\nBKK –  Bangkok, Thailand – Bangkok International Airport\nBKO –  Bamako, Mali – Senou\nBKW –  Beckley, WV, USA\nBKX –  Brookings, SD, USA – Brookings Municipal Airport\nBLA –  Barcelona, Venezuela – General Jose Antonio Anzoategui\nBLF –  Bluefield, WV, USA\nBLI –  Bellingham, WA, USA – Bellingham International\nBLK –  Blackpool, England, United Kingdom – Blackpool\nBLL –  Billund, Denmark – Billund\nBLQ –  Bologna, Italy – Guglielmo Marconi\nBLR –  Bangalore, India – Hindustan\nBLZ –  Blantyre, Malawi – Chileka\nBMA –  Stockholm, Sweden – Bromma Arpt\nBMG –  Bloomington, IN, USA – Monroe County Airport\nBMI –  Bloomington, IL, USA – Normal\nBNA –  Nashville, TN, USA – Nashville Metropolitan Airport\nBNE –  Brisbane, Queensland, Australia – Brisbane International Airport\nBNJ –  Bonn, Germany – Train Main Railroad Station\nBNN –  Bronnoysund, Norway – Bronnoy\nBNS –  Barinas, Venezuela – Barinas\nBOD –  Bordeaux, France – Merignac\nBOG –  Bogota, Colombia – Eldorado\nBOI –  Boise, ID, USA – Boise Municipal Arpt (Gowen Field)\nBOM –  Bombay, India – Bombay\nBON –  Bonaire, Netherlands Antilles – Flamingo Field\nBOO –  Bodo, Norway – Bodo\nBOS –  Boston, MA, USA – Logan International Airport\nBPS –  Porto Seguro, Bahia, Brazil – Porto Seguro\nBPT –  Beaumont, TX, USA – Jefferson County\nBQK –  Brunswick, GA, USA – Glynco Jetport\nBQN –  Aguadilla, PR, USA\nBRC –  San Carlos De Bariloche, Rio Negro, Argentina – International\nBRD –  Brainerd, MN, USA\nBRE –  Bremen, Germany – Bremen\nBRI –  Bari, Italy\nBRL –  Burlington, IA, USA – Burlington Municipal Airport\nBRM –  Barquisimeto, Venezuela – Barquisimeto\nBRN –  Berne, Switzerland – Belp\nBRO –  Brownsville, TX, USA – South Padre Island Intl\nBRQ –  Brno, Czech Republic – Turany\nBRR –  Barra / Hebrides Islands, Scotland, United Kingdom – North Bay\nBRS –  Bristol, England, United Kingdom – Bristol\nBRT –  Bathurst Island, Northern Territory, Australia\nBRU –  Brussels, Belgium – National\nBRW –  Barrow, AK, USA – Barrow\nBSB –  Brasilia, Distrito Federal, Brazil – International\nBSK –  Biskra, Algeria – Biskra\nBSL –  Basel, Switzerland – Basel\nBTM – Butte, MT, USA\nBTS –  Bratislava, Slovakia – Ivanka\nBTU –  Bintulu, Sarawak, Malaysia – Bintulu\nBTV –  Burlington, VT, USA – Burlington International Airport\nBUD –  Budapest, Hungary – Ferihegy\nBUF –  Buffalo, NY, USA – Greater Buffalo Intl Airport\nBUQ –  Bulawayo, Zimbabwe – Bulawayo\nBUR –  Burbank, CA, USA – Burbank Glendale Pasadena Airport\nBUZ –  Bushehr, Iran – Bushehr\nBVB –  Boa Vista, Roraima, Brazil\nBVE –  Brive-La-Gaillarde, France – Laroche\nBVI –  Birdsville, Queensland, Australia – Birdsville\nBWA –  Bhairawa, Nepal – Bhairawa\nBWI –  Baltimore, MD, USA – Baltimore-Washington International\nBWN –  Bandar Seri Begawan, Brunei Darussalam – Brunei International\nBXN –  Bodrum, Turkey – Imsik Airport\nBXU –  Butuan, Philippines – Butuan\nBYU –  Bayreuth, Germany – Bindlacher Berg\nBZE –  Belize City, Belize – Belize International\nBZN –  Bozeman, MT, USA – Gallatin Field\nBZR –  Beziers, France – Beziers-Vias\nCAE –  Columbia, SC, USA – Columbia Sc Airport Metropolitan\nCAG –  Cagliari, Sardinia, Italy – Elmas\nCAI –  Cairo, Egypt – International\nCAJ –  Canaima, Venezuela\nCAK –  Akron/Canton, OH, USA – Akron-Canton Regional Airport\nCAN –  Guangzhou, China – Baiyun\nCAS –  Casablanca, Morocco – Anfa\nCAY –  Cayenne, French Guiana – Rochambeau\nCBB –  Cochabamba, Bolivia – San Jose De La Banda\nCBE –  Cumberland, MD, USA – Municipal\nCBG –  Cambridge, England, United Kingdom – Cambridge\nCBL –  Ciudad Bolivar, Venezuela\nCBR –  Canberra, Australian Capital Territory, Australia – Canberra\nCCF –  Carcassonne, France – Salvaza Airport\nCCJ –  Calicut, India\nCCP –  Concepcion, Chile – Carriel Sur\nCCS –  Caracas, Venezuela – Simon Bolivar International\nCCU –  Calcutta, India – Calcutta\nCDC –  Cedar City, UT, USA\nCDG –  Paris, France – Charles De Gaulle\nCDH –  Camden, AR, USA\nCDR –  Chadron, NE, USA\nCDV –  Cordova, AK, USA\nCEB –  Cebu, Philippines – International\nCEC – Crescent City, CA, USA – Crescent City Municipal Airport\nCEI –  Chiang Rai, Thailand – Chiang Rai\nCEN –  Ciudad Obregon, Sonora, Mexico\nCER –  Cherbourg, France – Maupertus\nCEZ –  Cortez, CO, USA – Montezuma County\nCFR –  Caen, France – Carpiquet\nCFU –  Kerkyra, Greece – Kerkyra\nCGA –  Craig, AK, USA\nCGB –  Cuiaba, Mato Grosso, Brazil\nCGH –  Sao Paulo, Sao Paulo, Brazil – Congonhas\nCGI –  Cape Girardeau, MO, USA – Municipal Airport\nCGK –  Jakarta, Indonesia – Soekarno Hatta International\nCGN –  Cologne/Bonn, Germany – Koeln/Bonn\nCGO –  Zhengzhou, China\nCGP –  Chittagong, Bangladesh – Patenga\nCGQ –  Changchun, China\nCGR –  Campo Grande, Mato Grosso Do Sul, Brazil\nCGX –  Chicago, IL, USA – Meigs Field\nCGX –  Chicago, IL, USA – Midway / Ohare / Meigs\nCHA –  Chattanooga, TN, USA – Cha Lovell Field\nCHC –  Christchurch, New Zealand – International\nCHO –  Charlottesville, VA, USA – Charlottesville/Albemarle\nCHQ –  Chania, Crete Island, Greece – Souda\nCHS –  Charleston, SC, USA – Charleston International Airport\nCIA –  Rome, Italy – Ciampino\nCIC –  Chico, CA, USA – Chico Municipal Air Terminal\nCID –  Cedar Rapids, IA, USA – Municipal\nCIU –  Sault Ste Marie, MI, USA – Chippewa County Intl Airport\nCIX –  Chiclayo, Peru – Cornel Ruiz\nCJB –  Coimbatore, India – Peelamedu\nCJS –  Ciudad Juarez, Chihuahua, Mexico – International Abraham Gonzalez\nCJU –  Cheju, South Korea – Cheju\nCKB –  Clarksburg, WV, USA – Clarksburg-Benedum Airport\nCKS –  Carajas, Para, Brazil – International / Brasilia Brazil\nCKY –  Conakry, Guinea – Conakry\nCLD –  Carlsbad, CA, USA – Carlsbad/Palomar Airport\nCLE –  Cleveland, OH, USA – Hopkins International Airport\nCLJ –  Cluj, Romania – Cluj\nCLL –  College Station, TX, USA\nCLM –  Port Angeles, WA, USA – Wm Fairchild Intl Airport\nCLO –  Cali, Colombia – Alfonso Bonilla Aragon\nCLQ –  Colima, Colima, Mexico\nCLT –  Charlotte, NC, USA – Charlotte/Douglas Intl Airport\nCLY –  Calvi, Corsica, France – Ste Catherine\nCMB –  Colombo, Sri Lanka – Katunayake International\nCME –  Ciudad Del Carmen, Campeche, Mexico\nCMF –  Chambery, France – Chambery Aix-Les-Bains\nCMG –  Corumba, Mato Grosso Do Sul, Brazil – Corumba\nCMH –  Columbus, OH, USA – Port Columbus Intl Airport\nCMI –  Champaign, IL, USA – Univ Of Illinois-Willard Airport\nCMN –  Casablanca, Morocco – Mohamed V\nCMX –  Hancock, MI, USA – Houghton County / Memorial\nCND –  Constanta, Romania – Kogalniceanu\nCNF –  Belo Horizonte /Belo Horizon, Minas Gerais, Brazil – Tancredo Neves International Airport\nCNM –  Carlsbad, NM, USA\nCNS –  Cairns, Queensland, Australia – Cairns\nCNX –  Chiang Mai, Thailand – International\nCNY –  Moab, UT, USA\nCOK –  Cochin, India – Naval Air Station\nCOO –  Cotonou, Benin – Cotonou\nCOR –  Cordoba, Cordoba, Argentina – Pajas Blancas\nCOS –  Colorado Springs, CO, USA – Colorado Springs Municipal\nCOU –  Columbia, MO, USA – Columbia Regional\nCPC –  San Martin De Los Andes, Neuquen, Argentina\nCPH –  Copenhagen, Denmark – Copenhagen\nCPQ –  Campinas, Sao Paulo, Brazil – Campinas International\nCPR –  Casper, WY, USA – Natrona County Intl Airport\nCPT –  Cape Town, South Africa – DF Malan\nCRD –  Comodoro Rivadavia, Chubut, Argentina – Comodoro Rivadavia\nCRI –  Crooked Island, Bahamas\nCRP –  Corpus Christi, TX, USA – Corpus Christi International Airport\nCRU –  Carriacou Island, Grenada\nCRW –  Charleston, WV, USA – Yeager Airport\nCSG –  Columbus, GA, USA – Columbus Metropolitan / Fort Benning\nCSX –  Changsha, China\nCTA –  Catania, Sicily, Italy – Fontanarossa\nCTG –  Cartagena, Colombia – Rafael Nunez\nCTL –  Charleville, Queensland, Australia – Charleville\nCTS –  Sapporo, Japan – Chitose\nCTU –  Chengdu, China\nCUC –  Cucuta, Colombia – Camilo Daza\nCUE –  Cuenca, Ecuador – Mariscal La Mar\nCUL –  Culiacan, Sinaloa, Mexico\nCUM –  Cumana, Venezuela\nCUN –  Cancun, Mexico\nCUP –  Carupano, Venezuela – Carupano\nCUR –  Willemstad / Curacao Island, Netherlands Antilles – Hato Airport\nCUU –  Chihuahua, Chihuahua, Mexico – Genvillalobos\nCUZ –  Cuzco, Peru – Lte Velazco Astete\nCVG –  Cincinnati, OH, USA – Greater Cincinnati Intl Airport\nCVN –  Clovis, NM, USA\nCWA –  Wausau, WI, USA – Central Wisconsin Airport\nCWB –  Curitiba, Parana, Brazil – Afonso Pena\nCWL –  Cardiff, Wales, United Kingdom – Cardiff-Wales\nCWT –  Cowra, New South Wales, Australia – Cowra\nCXH –  Vancouver, British Columbia, Canada – Vancouver Harbor Airport\nCYB –  Cayman Brac Island, Cayman Islands\nCYR –  Colonia, Uruguay\nCYS –  Cheyenne, WY, USA – Cheyenne Municipal Airport\nCZM –  Cozumel, Quintana Roo, Mexico – Aeropuerto Intl De Cozumel\nDAB –  Daytona Beach, FL, USA – Daytona Beach International Airport\nDAC –  Dhaka, Bangladesh – Zia International Airport\nDAD –  Da Nang, Vietnam – Da Nang\nDAL –  Dallas, TX, USA – Love Field\nDAM –  Damascus, Syria – Damascus Intl\nDAN –  Danville, VA, USA\nDAR –  Dar Es Salaam, Tanzania – International\nDAY –  Dayton, OH, USA – James M Cox Dayton International\nDBO –  Dubbo, New South Wales, Australia – Dubbo\nDBQ –  Dubuque, IA, USA – Dubuque Municipal Airport\nDCA –  Washington, DC, USA – Washington National Airport\nDCF –  Dominica, Dominica – Cane Field\nDDC –  Dodge City, KS, USA – Dodge City Municipal\nDEC –  Decatur, IL, USA – Decatur Municiple Airport\nDEL –  Delhi, India – Delhi International Airport\nDEM –  Dembidollo, Ethiopia – Dembidollo\nDEN –  Denver, CO, USA – Denver International\nDFW –  Dallas/Ft Worth, TX, USA – Dallas Ft Worth International\nDGA –  Dangriga, Belize – Dangriga\nDGO –  Durango, Durango, Mexico – Gen Guadalupe Victoria\nDHA –  Dhahran, Saudi Arabia – Dhahran Intl\nDHN –  Dothan, AL, USA – Municipal\nDIB –  Dibrugarh, India – Chabua\nDIJ –  Dijon, France – Longvic\nDIL –  Dili, Indonesia – Comoro\nDIY –  Diyarbakir, Turkey – Diyarbakia\nDKR –  Dakar, Senegal – Yoff\nDLA –  Douala, Cameroon – Douala\nDLC –  Dalian, China\nDLH –  Duluth, MN, USA – Duluth International Airport\nDLM – Dalaman, Turkey – Dalaman\nDME –  Moscow, Russia – Domodedovo\nDND –  Dundee, Scotland, United Kingdom – Dundee\nDNM –  Denham, Western Australia, Australia\nDNV –  Danville, IL, USA – Vermilion County Airport\nDOH –  Doha, Qatar – Doha\nDOK –  Donetsk, Ukraine – Donetsk\nDOL –  Deauville, France – Saint Gatien\nDOM –  Dominica, Dominica – Melville Hal-Dom\nDPL –  Dipolog, Philippines – Dipolog\nDPO –  Devonport, Tasmania, Australia – Devonport\nDPS –  Denpasar Bali, Indonesia – Ngurah Rai\nDRO –  Durango, CO, USA – Durango La Plata County Airport\nDRS –  Dresden, Germany – Dresden\nDRT –  Del Rio, TX, USA\nDRW –  Darwin, Northern Territory, Australia\nDSI –  Destin, FL, USA\nDSM –  Des Moines, IA, USA\nDTM –  Dortmund, Germany – Wickede\nDTW –  Detroit, MI, USA – Detroit Metropolitan Airport\nDUB –  Dublin, Ireland – Dublin\nDUD –  Dunedin, New Zealand – Momona\nDUJ –  Du Bois, PA, USA – Jefferson County\nDUQ –  Duncan / Quam, British Columbia, Canada – Quamichan Lake\nDUR –  Durban, South Africa – Louis Botha\nDUS –  Dusseldorf, Germany – Dusseldorf\nDUT –  Dutch Harbor, AK, USA – Dutch Harbor\nDVO –  Davao, Philippines – Mati\nDXB –  Dubai, United Arab Emirates – Dubai International Airport\nEAP –  , Switzerland\nEAR –  Kearney, NE, USA – Kearney Municipal Airport\nEAS –  San Sebastian, Spain – Fuenterrabia\nEAT –  Wenatchee, WA, USA – Pangborn Memorial Field\nUAE –  Eau Claire, WI, USA – Eau Claire Municipal\nEBA –  Elba Island, Italy – Marina Di Campo\nEBB –  Entebbe/Kampala, Uganda – Entebbe\nEBJ –  Esbjerg, Denmark – Esbjerg\nEDI –  Edinburgh, Scotland, United Kingdom – Turnhouse\nEDR –  Edward River, Queensland, Australia – Edward River\nEEN –  Keene / Brattleboro, NH, USA – Dillant Hopkins\nEFD –  Houston, TX, USA – Ellington Field\nEGE –  Vail/Eagle, CO, USA – Eagle County Regional\nEIN –  Eindhoven, Netherlands – Welschap\nEIS –  Tortola/Beef Island, Virgin Islands (British) – Beef Island\nEJA – Barrancabermeja, Colombia – Variguies\nEKO –  Elko, NV, USA – JC Harris Field\nELD –  El Dorado, AR, USA\nELH –  North Eleuthera, Bahamas\nELM –  Elmira / Corning, NY, USA – Elmira Corning Regional Arpt\nELP –  El Paso, TX, USA – El Paso International Airport\nELS –  East London, South Africa – Ben Shoeman\nELY –  Ely, NV, USA – Yelland Field\nEMA –  East Midlands, England, United Kingdom – East Midlands\nEMD –  Emerald, Queensland, Australia – Emerald\nENA –  Kenai, AK, USA – Kenai Municipal Airport\nENS –  Enschede, Netherlands – Twente\nEOH –  Medellin, Colombia – Enrique Olaya Herrara\nEPR –  Esperance, Western Australia, Australia – Esperance\nERF –  Erfurt, Germany – Erfurt\nERI –  Erie, PA, USA – Erie International\nERS –  Windhoek, Namibia – Eros\nERZ –  Erzurum, Turkey – Erzurum\nESB –  Ankara, Turkey – Esenboga\nESC –  Escanaba, MI, USA – Delta County Airport\nESD –  Eastsound, WA, USA – Eastsound/Orcas Island Airport\nESR –  El Salvador, Chile\nETH –  Elat, Israel – Elat\nETZ –  Metz/Nancy, France – Frescaty\nEUG –  Eugene, OR, USA – Eugene Airport\nEUN –  Laayoune, Morocco – Laayoune-Hassan I Morocco\nEVE –  Evenes, Norway – Evenes\nEVN –  Yerevan, Armenia\nEVV –  Evansville, IN, USA – Evansville Regional Airport\nEWB –  New Bedford/Fall River, MA, USA – New Bedford Municipal\nEWN –  New Bern, NC, USA – Simmons-Nott Airport\nEWR –  Newark, NJ, USA – Newark International Airport\nEXT –  Exeter, England, United Kingdom – Exeter\nEYW –  Key West, FL, USA\nEZE –  Buenos Aires, Buenos Aires, Argentina – Eze – Ezeiza International Airport\nFAE –  Faroe Islands, Faroe Islands – Faeroe Islands\nFAI –  Fairbanks, AK, USA – Fairbanks International Airport\nFAO –  Faro, Portugal – Faro\nFAR –  Fargo, ND, USA – Hector Airport\nFAT –  Fresno, CA, USA – Fresno Air Terminal\nFAY –  Fayetteville, NC, USA – Fayetteville Municipal\nFBU –  Oslo, Norway – Fornebu\nFCA –  Kalispell, MT, USA – Glacier Park International\nFCO –  Rome, Italy – Leonardo Da Vinci/Fiumicino\nFDE –  Forde, Norway – Forde\nFDF –  Fort De France, Martinique – Fort De France\nFDH –  Friedrichshafen, Germany – Friedrichshafen – Lowenthal\nFEZ –  Fez, Morocco – Fez\nFFM –  Fergus Falls, MN, USA – Fergus Falls Municipal Airport\nFHU –  Fort Huachuca/Sierra Vista, AZ, USA\nFIH –  Kinshasa, Zaire – Kinshasa\nFKL –  Franklin, PA, USA – Chess Lamberton\nFLG –  Flagstaff, AZ, USA – Flagstaff\nFLL –  Ft Lauderdale, FL, USA – Ft Lauderdale/Hollywood Intl Apt\nFLN –  Florianopolis, Santa Catarina, Brazil – Florianopolis\nFLO –  Florence, SC, USA – Gilbert Field\nFLR –  Florence, Italy\nFMA –  Formosa, Formosa, Argentina – Formosa\nFMN –  Farmington, NM, USA – Four Corners Regional Airport\nFMO –  Muenster, Germany – Muenster\nFNC –  Funchal, Madeira Islands, Portugal – Funchal\nFNL –  Fort Collins/Loveland, CO, USA – Fort Collins / Loveland Airport\nFNT –  Flint, MI, USA – Bishop Int'l Airport\nFOD –  Fort Dodge, IA, USA – Fort Dodge Regional Airport\nFOE –  Topeka, KS, USA – Forbes Field\nFOR –  Fortaleza, Ceara, Brazil – Fortaleza\nFPO –  Freeport, Bahamas – Freeport Intl Airport\nFRA –  Frankfurt, Germany – Frankfurt International\nFRD –  Friday Harbor, WA, USA – Friday Harbor Airport\nFRM –  Fairmont, MN, USA – Fairmont Municipal\nFRO –  Floro, Norway – Floro\nFRS –  Flores, Guatemala – Flores\nFRU –  Bishkek, Kyrgyzstan – Bishkek Airport\nFSD –  Sioux Falls, SD, USA – Joe Foss Field\nFSM –  Fort Smith, AR, USA – Fort Smith Municipal\nFSP –  St Pierre, St. Pierre And Miquelon\nFUE –  Fuerteventura / Puerto Del Rosario, Canary Islands/Fuerteventura Island, Spain – Fuerteventura\nFUK –  Fukuoka, Japan – Itazuke\nFWA –  Fort Wayne, IN, USA – Baer Field\nFYV –  Fayetteville, AR, USA – Municipal\nGAJ –  Yamagata, Japan – Junmachi\nGAL –  Galena, AK, USA\nGAU –  Gauhati, India – Borjhar\nGBE –  Gaborone, Botswana – Gaborone\nGBG –  Galesburg, IL, USA – Galesburg Municiple Airport\nGCC –  Gillette, WY, USA – Campbell County Airport\nGCI – Guernsey, Channel Islands, United Kingdom – Guernsey\nGCK –  Garden City, KS, USA – Garden City Municipal Airport\nGCM –  Grand Cayman Island, Cayman Islands – Owen Roberts Intl Airport\nGCN –  Grand Canyon, AZ, USA\nGDL –  Guadalajara, Jalisco, Mexico – Miguel Hidalgo Intl\nGDN –  Gdansk, Poland – Rebiechowo\nGDT –  Grand Turk Is, Turks And Caicos Islands\nGDV –  Glendive, MT, USA\nGDX –  Magadan, Russia – Magadan\nGEG –  Spokane, WA, USA – International/Geiger Field\nGEN –  Oslo, Norway – Garderm OEN\nGEO –  Georgetown, Guyana – Timehri\nGET –  Geraldton, Western Australia, Australia – Geraldton\nGFK –  Grand Forks, ND, USA – Grand Forks International Airport\nGGG –  Longview/Gladewater/Kilgore, TX, USA – Gregg County\nGGT –  George Town, Bahamas – Exuma International\nGGW –  Glasgow, MT, USA\nGHB –  Governors Harbour, Bahamas\nGIB –  Gibraltar, Gibraltar – Gibraltar\nGIG –  Rio De Janeiro, Rio De Janeiro, Brazil – International Airport\nGJT –  Grand Junction, CO, USA – Walker Field\nGKA –  Goroka, Papua New Guinea – Goroka\nGLA –  Glasgow, Scotland, United Kingdom – Glasgow Scotland\nGLD –  Goodland, KS, USA – Renner Field\nGLF –  Golfito, Costa Rica – Golfito\nGLS –  Galveston, TX, USA – Scholes Field\nGLV –  Golovin, AK, USA\nGNB –  Grenoble, France – St Geoirs\nGND –  St Georges/Grenada, Grenada – Pt Saline\nGNV –  Gainesville, FL, USA – Jr Alison Municipal\nGOA –  Genoa, Italy – Christoforo Colombo\nGOH –  Nuuk, Greenland\nGOI –  Goa, India – Dabolim\nGOJ –  Nizhniy Novgorod, Russia – Nizhniy\nGON –  Groton / New London, CT, USA – Groton-New London\nGOT –  Gothenburg, Sweden – Landvetter\nGOV –  Gove, Northern Territory, Australia – Nhulunbuy\nGPS –  Galapagos Islands, Ecuador – Baltra\nGPT –  Gulfport, MS, USA – Gulfport/Biloxi\nGRB –  Green Bay, WI, USA – Austin/Straybel Field\nGRI –  Grand Island, NE, USA – Central Nebraska Regional Airport\nGRJ –  George, South Africa – George\nGRO –  Gerona, Spain – Costa Brava\nGRQ –  Groningen, Netherlands – Eelde\nGRR –  Grand Rapids, MI, USA – Kent County International Airport\nGRU –  Sao Paulo, Sao Paulo, Brazil – Guarulhos\nGRU –  Sao Paulo, Sao Paulo, Brazil – Guarulhos International\nGRX –  Granada, Spain – Granada\nGRZ –  Graz, Austria – Thalerhof\nGSO –  Greensboro / High Point, NC, USA – Piedmont Triad Intl Airport\nGTF –  Great Falls, MT, USA – Great Falls International\nGTO –  Gorontalo, Indonesia – Tolotio\nGTR –  Columbus, MS, USA – Golden\nGUA –  Guatemala City, Guatemala – La Aurora Intl Airport\nGUB –  Guerrero Negro, Baja California Sur, Mexico – Guerrero Negro Airport\nGUC –  Gunnison, CO, USA – Gunnison County Airport\nGUM –  Guam, Guam – Ab Wonpat Intl Airport\nGUP –  Gallup, NM, USA – Gallup Municipal\nGUR –  Alotau, Papua New Guinea – Gurney\nGVA –  Geneva, Switzerland – Geneva\nGWD –  Gwadar, Pakistan\nGWT –  Westerland, Germany – Westerland\nGWY –  Galway, Ireland – Carnmore\nGXQ –  Coyhaique, Chile – Teniente Vidal\nGYE –  Guayaquil, Ecuador – Simon Bolivar\nGYM –  Guaymas, Sonora, Mexico\nGYY –  Gary, IN, USA\nHAD –  Halmstad, Sweden – Halmstad\nHAG –  The Hague, Netherlands\nHAH –  Moroni (Hahaya), Comoros\nHAJ –  Hanover, Germany – Langenhagen\nHAK –  Haikou, China – Haikou\nHAM –  Hamburg, Germany – Fuhlsbuttel\nHAN –  Hanoi, Vietnam – Noibai Airport\nHAU –  Haugesund, Norway – Karmoy\nHAV –  Havana, Cuba – Jose Marti\nHBA –  Hobart, Tasmania, Australia – Hobart\nHDB –  Heidelberg, Germany\nHDN –  Hayden, CO, USA – Yampa Valley Regional Airport\nHDY –  Hat Yai, Thailand\nHEL –  Helsinki, Finland – Helsinki\nHER –  Heraklion, Crete Island, Greece – Heraklion\nHET –  Hohhot, China\nHFT –  Hammerfest, Norway\nHGH –  Hangzhou, China\nHGN –  Mae Hong Son, Thailand – Mae Hong Son\nHGR –  Hagerstown, MD, USA – Washington County Regional Airport\nHHH –  Hilton Head, SC, USA – Municipal\nHIB –  Hibbing / Chisholm, MN, USA – Hibbing-Chisholm\nHIJ –  Hiroshima, Japan – Hiroshima\nHIR – Honiara/Guadalcanal, Solomon Islands – Henderson International\nHIS –  Hayman Island, Queensland, Australia – Hayman Island Airport\nHKD –  Hakodate, Japan – Hakodate\nHKG –  Hong Kong, Hong Kong\nHKK –  Hokitika, New Zealand – Hokitika\nHKN –  Hoskins, Papua New Guinea – Hoskins\nHKT –  Phuket, Thailand – Phuket\nHKY –  Hickory, NC, USA\nHLN –  Helena, MT, USA\nHLP –  Jakarta, Indonesia – Halim Perdana Kusama\nHLZ –  Hamilton, New Zealand – Hamilton\nHMA –  Malmo, Sweden – Malmo Harbor\nHMO –  Hermosillo, Sonora, Mexico – General Ignacio Pesqueira Garcia\nHNA –  Morioka, Japan – Hanamaki\nHNH –  Hoonah, AK, USA\nHNL –  Honolulu, HI, USA – Honolulu International\nHNS –  Haines, AK, USA\nHOB –  Hobbs, NM, USA – Lea County\nHOM –  Homer, AK, USA – Homer Airport\nHON –  Huron, SD, USA – Huron Regional Airport\nHOT –  Hot Springs, AR, USA – Memorial Field\nHOU –  Houston, TX, USA – Houston Hobby Airport\nHOU –  Houston, TX, USA – Houston Hobby Airport\nHPB –  Hooper Bay, AK, USA\nHPN –  Westchester County, NY, USA – Westchester County Airport\nHPV –  Kauai Island, HI, USA – Princeville\nHRB –  Harbin, China\nHRE –  Harare, Zimbabwe – Harare\nHRG –  Hurghada, Egypt\nHRK –  Kharkov, Ukraine – Kharkov\nHRL –  Harlingen, TX, USA\nHRO –  Harrison, AR, USA – Boone County\nHSI –  Hastings, NE, USA\nHSV –  Huntsville/Decatur, AL, USA – Huntsville-Madison County Jetplex\nHTI –  Hamilton Island, Queensland, Australia\nHTS –  Huntington / Ashland, WV, USA – Tri-State\nHUF –  Terre Haute, IN, USA – Hulman Field\nHUI –  Hue, Vietnam\nHUM –  Houma, LA, USA – Terrebonne\nHUN –  Hualien, Taiwan – Hualien\nHUX –  Huatulco, Oaxaca, Mexico\nHUY –  Humberside, England, United Kingdom – Humberside\nHVB –  Hervey Bay, Queensland, Australia\nHVN –  New Haven, CT, USA – Tweed New Haven\nHVR –  Havre, MT, USA – City County\nHWN –  Hwange National Park, Zimbabwe – Hwange National Park\nHYA – Hyannis, MA, USA – Barnstable County\nHYD –  Hyderabad, India – Begumpet\nHYG –  Hydaburg, AK, USA\nHYS –  Hays, KS, USA – Hays Municipal Airport\nIAD –  Washington, DC, USA – Dulles\nIAD –  Washington, DC, USA – Washington-Dulles International\nIAH –  Houston, TX, USA\nIAH –  Houston, TX, USA – Houston Intercontinental\nIAS –  Iasi, Romania – Iasi\nIBZ –  Ibiza, Spain – Ibiza\nICT –  Wichita, KS, USA – Mid-Continent Airport\nIDA –  Idaho Falls, ID, USA\nIEV –  Kiev, Ukraine – Zhulhany\nIFP –  Bullhead City, AZ, USA – Bullhead\nIGA –  Inagua, Bahamas\nIGM –  Kingman, AZ, USA – Mohave County\nIGR –  Iguazu, Misiones, Argentina – Iguazu International\nIGU –  Iguassu Falls, Parana, Brazil\nIJK –  Izhevsk, Russia\nIKT –  Irkutsk, Russia – Irkutsk\nILE –  Killeen, TX, USA\nILF –  Ilford, Manitoba, Canada\nILI –  Iliamna, AK, USA\nILM –  Wilmington, NC, USA – New Hanover County Airport\nILO –  Iloilo, Philippines – Mandurriao\nILQ –  Ilo, Moquegua, Peru – Ilo Airport\nILY –  Islay, Scotland, United Kingdom – Glenegedale\nIMF –  Imphal, India – Municipal\nIMP –  Imperatriz, Maranhao, Brazil\nIMT –  Iron Mountain, MI, USA – Ford Airport\nIND –  Indianapolis, IN, USA – Indianapolis International Airport\nINL –  International Falls, MN, USA – Falls International\nINN –  Innsbruck, Austria – Kranebitten\nINT –  Winston-Salem, NC, USA – Smith Reynolds\nINU –  Nauru, Nauru\nINV –  Inverness, Scotland, United Kingdom – Inverness\nIOA –  Ioannina, Greece – Ioannina\nIOM –  Isle Of Man, Isle Of Man, United Kingdom – Ronaldsway\nIOS –  Ilheus, Bahia, Brazil – Eduardo Gomes\nIPC –  Easter Island, Chile – Mataveri\nIPH –  Ipoh, Malaysia – Ipoh\nIPI –  Ipiales, Colombia – San Luis\nIPT –  Williamsport, PA, USA – Williamsport Lycoming Municipal\nIQQ –  Iquique, Chile – Chucumata\nIQT –  Iquitos, Peru – Cf Secada\nISB –  Islamabad, Pakistan – International\nISC – Isles Of Scilly, Isles Of Scilly, United Kingdom – Tresco\nISN –  Williston, ND, USA – Sloulin Field International\nISO –  Kinston, NC, USA\nISP –  Islip, NY, USA – Long Island-Macarthur Airport\nIST –  Istanbul, Turkey – Ataturk\nITH –  Ithaca, NY, USA – Tompkins County\nITM –  Osaka, Japan – Itami International Was Osaka\nITO –  Hilo, HI, USA – Hilo Hawaii:Hawaii-International Usa\nIWD –  Ironwood, MI, USA – Gogebic County Airport\nIXB –  Bagdogra, India – Bagdogra\nIXE –  Mangalore, India – Bajpe\nIXJ –  Jammu, India – Satwari\nIXM –  Madurai, India – Madurai\nIXU –  Aurangabad, India – Chikkalthana\nIXZ –  Port Blair, India – Port Blair\nIYK –  Inyokern, CA, USA – Inyokern Airport\nIZO –  Izumo, Japan\nJAC –  Jackson Hole, WY, USA – Jackson Hole Airport\nJAI –  Jaipur, India – Sanganeer\nJAN –  Jackson, MS, USA – Allen C Thompson Field\nJAT –  Jabat, Marshall Islands – Jabat Intl\nJAV –  Ilulissat, Greenland\nJAX –  Jacksonville, FL, USA – Jacksonville International Airport\nJBR –  Jonesboro, AR, USA – Municipal\nJCA –  Cannes, France – Mandelieu\nJDH –  Jodhpur, India\nJDP –  Paris, France – Issy Les Moulineaux\nJED –  Jeddah, Saudi Arabia – Jeddah International\nJER –  Jersey, Channel Islands, United Kingdom – States\nJFK –  New York, NY, USA – John F Kennedy Intl Airport\nJGA –  Jamnagar, India\nJHB –  Johor Bahru, Malaysia – Sultan Ismail International\nJHE –  Helsingborg, Sweden – Heliport\nJHM –  Kapalua, HI, USA – Kapalua\nJHW –  Jamestown, NY, USA – Chautauqua County Airport\nJIB –  Djibouti, Djibouti – Ambouli\nJKG –  Jonkoping, Sweden – Axamo\nJLN –  Joplin, MO, USA – Municipal Airport\nJMC –  Sausalito, CA, USA – Marin County\nJMK –  Mikonos, Greece – Mikonos\nJMM –  Malmo, Sweden – Malmo Harbor Heliport\nJMO –  Jomsom, Nepal\nJMS –  Jamestown, ND, USA – Jamestown Municipal Airport\nJNB –  Johannesburg, South Africa – Jan Smuts\nJNS –  Narssaq, Greenland\nJNU –  Juneau, AK, USA – Juneau\nJNX –  Naxos, Cyclades Islands, Greece – Naxos Airport\nJOG –  Yogyakarta, Indonesia\nJOI –  Joinville, Santa Catarina, Brazil – Federal\nJON –  Johnston Island, US, Outlying Islands\nJRA –  New York City, NY, USA\nJRO –  Kilimanjaro, Tanzania – Kilimanjaro\nJSI –  Skiathos, Greece – Skiathos\nJST –  Johnstown, PA, USA – Johnstown Cambria\nJTR –  Santorini/Thira Is, Greece – Santorini\nJUJ –  Jujuy, Provincia Jujuy, Argentina – El Cadillal\nJUL –  Juliaca, Peru – Juliaca\nKAB –  Kariba, Zimbabwe – Kariba\nKAE –  Kake, AK, USA\nKAL –  Kaltag, AK, USA\nKAN –  Kano, Nigeria – Aminu Kano International\nKAT –  Kaitaia, New Zealand – Kaitaia\nKBP –  Kiev, Ukraine – Borispol\nKBR –  Kota Bharu, Malaysia – Sultan Ismail Petra\nKCG –  Chignik, AK, USA – Fisheries\nKCH –  Kuching, Sarawak, Malaysia – Kuching\nKCL –  Chignik, AK, USA – Lagoon\nKEF –  Reykjavik, Iceland – Keflavik\nKEH –  Kenmore Air Harbor, WA, USA\nKEJ –  Kemerovo, Russia – Kemerovo\nKEL –  Kiel, Germany – Holtenau\nKEM –  Kemi/Tornio, Finland – Kemi\nKEP –  Nepalganj, Nepal – Nepalganj\nKER –  Kerman, Iran – Kerman\nKGC –  Kingscote, South Australia, Australia\nKGD –  Kaliningrad, Russia – Kaliningrad Airport\nKHH –  Kaohsiung, Taiwan\nKHI –  Karachi, Pakistan – Karachi\nKHV –  Khabarovsk, Russia – Novy\nKIN –  Kingston, Jamaica\nKIR –  Kerry County, Ireland – Kerry County\nKIV –  Kishinev, Moldova – Kishinev\nKIX –  Osaka, Japan – Kansai International\nKJA –  Krasnojarsk, Russia\nKKN –  Kirkenes, Norway – Hoeyburtmoen\nKLO –  Kalibo, Philippines – Kalibo\nKLR –  Kalmar, Sweden – Kalmar\nKLU –  Klagenfurt, Austria – Klagenfurt\nKLW –  Klawock, AK, USA\nKMG –  Kunming, China – Kunming\nKMI –  Miyazaki, Japan – Miyazaki\nKMJ –  Kumamoto, Japan – Kumamoto\nKNS –  King Island, Tasmania, Australia – King Island\nKOA –  Kona, HI, USA – Keahole\nKOI – Kirkwall / Orkney Island, Scotland, United Kingdom – Kirkwall\nKOJ –  Kagoshima, Japan – Kagoshima\nKOK –  Kokkola/Pietarsaari, Finland – Kruunupyy\nKPN –  Kipnuk, AK, USA\nKPO –  Pohang, South Korea – Na\nKRF –  Kramfors, Sweden – Kramfors\nKRK –  Krakow, Poland – Balice\nKRN –  Kiruna, Sweden – Kiruna\nKRP –  Karup, Denmark – Karup\nKRR –  Krasnodar, Russia – Krasnodar\nKRS –  Kristiansand, Norway – Kjevik\nKRT –  Khartoum, Sudan – Civil\nKSA –  Kosrae, Caroline Islands, Micronesia\nKSC –  Kosice, Slovakia – Barca\nKSH –  Kermanshah, Iran – Bakhtaran Iran\nKSJ –  Kasos Island, Greece – Kasos Island\nKSU –  Kristiansund, Norway – Kvernberget\nKTM –  Kathmandu, Nepal – Tribhuvan\nKTN –  Ketchikan, AK, USA – Ketchikan International\nKTR –  Katherine, Northern Territory, Australia – Tindal\nKTW –  Katowice, Poland – Pyrzowice\nKUA –  Kuantan, Malaysia – Padang Geroda\nKUF –  Samara, Russia – Samara\nKUL –  Kuala Lumpur, Malaysia – Subang Kuala Lumpur International\nKUN –  Kaunas, Lithuania – Kaunas\nKUO –  Kuopio, Finland – Kuopio\nKUS –  Kulusuk, Greenland – Metropolitan Area\nKUV –  Kunsan, South Korea\nKVA –  Kavala, Greece – Kavala\nKWA –  Kwajalein, Marshall Islands\nKWI –  Kuwait, Kuwait – International\nKWL –  Guilin, China\nKZN –  Kazan, Russia – Kazan\nLAD –  Luanda, Angola – Fevereiro\nLAF –  Lafayette, IN, USA – Purdue University Airport\nLAN –  Lansing, MI, USA – Capital City Airport\nLAP –  La Paz, Baja California Sur, Mexico – General Marquez De Leon Airport\nLAR –  Laramie, WY, USA – General Brees Field\nLAS –  Las Vegas, NV, USA – Mccarran International Airport\nLAW –  Lawton, OK, USA – Municipal\nLAX –  Los Angeles, CA, USA – Los Angeles Intl Airport\nLAX –  Los Angeles, CA, USA – Los Angeles Intl Airport\nLBA –  Leeds/Bradford, England, United Kingdom\nLBB –  Lubbock, TX, USA – Lubbock International Airport\nLBE –  Latrobe, PA, USA – Westmoreland County\nLBF –  North Platte, NE, USA – Lee Bird Field\nLBL –  Liberal, KS, USA – Glenn L Martin Terminal\nLBU –  Labuan, Sabah, Malaysia\nLBV –  Libreville, Gabon – Libreville\nLCA –  Larnaca, Cyprus – Intl\nLCE –  La Ceiba, Honduras – International\nLCG –  La Coruna, Spain – La Coruna\nLCH –  Lake Charles, LA, USA – Municipal\nLCY –  London, England, United Kingdom – London City\nLDB –  Londrina, Parana, Brazil – Londrina\nLDE –  Lourdes/Tarbes, France – Tarbes International\nLDU –  Lahad Datu, Sabah, Malaysia – Lahad Datu\nLEA –  Learmonth, Western Australia, Australia\nLEB –  Lebanon/Hanover/White River, NH, USA – Lebanon Regional\nLED –  St Petersburg, Russia – Pulkovo\nLEH –  Le Havre, France – Le Havre\nLEI –  Almeria, Spain – Almeria\nLEJ –  Leipzig, Germany – Leipzig\nLET –  Leticia, Colombia – Gen Av Cob0\nLEX –  Lexington, KY, USA – Blue Grass Field\nLFT –  Lafayette / New Iberia, LA, USA – Municipal\nLFW –  Lome, Togo – Lome\nLGA –  New York, NY, USA – Laguardia\nLGB –  Long Beach, CA, USA – Long Beach Municipal Airport\nLGG –  Liege, Belgium – Bierset\nLGI –  Deadmans Cay / Long Island, Bahamas – Deadmans Cay\nLGK –  Langkawi, Malaysia\nLGP –  Legaspi, Philippines – Legaspi\nLGW –  London, England, United Kingdom – Gatwick\nLHE –  Lahore, Pakistan – Lahore\nLHR –  London, England, United Kingdom – Heathrow\nLIG –  Limoges, France – Bellegarde\nLIH –  Kauai Island, HI, USA – Lihue Municipal Airport\nLIM –  Lima, Peru – Jorge Chavez\nIntl LIN –  Milan, Italy – Linate\nLIR –  Liberia, Costa Rica – Liberia\nLIS –  Lisbon, Portugal – Lisbon\nLIT –  Little Rock, AR, USA – Little Rock Regional Airport\nLJU –  Ljubljana, Slovenia – Brnik\nLKE –  Seattle, WA, USA – Lake Union Sea Plane Base\nLKL – \nLKN –  Leknes, Norway – Leknes\nLKO –  Lucknow, India\nLLA –  Lulea, Sweden – Kallax\nLLW –  Lilongwe, Malawi – Kamuzu Intl\nLLY –  Mount Holly, NJ, USA – Mt Holly\nLMM –  Los Mochis, Sinaloa, Mexico\nLMN –  Limbang, Sarawak, Malaysia – Limbang\nLMT –  Klamath Falls, OR, USA – Kingsley Field Airport\nLNK –  Lincoln, NE, USA – Municipal Airport\nLNS –  Lancaster, PA, USA – Lancaster\nLNV –  Londolovit, Papua New Guinea – Londolovit\nLNY –  Lanai City, HI, USA – Lanai\nLNZ –  Linz, Austria – Linz\nLOS –  Lagos, Nigeria – Murtala Muhammed\nLOV –  Monclova, Coahuila, Mexico – Monclova Airport\nLPA –  Gran Canaria, Canary Islands, Spain – Aeropuerto De Gran Canaria\nLPB –  La Paz, Bolivia – El Alto\nLPI –  Linkoping, Sweden – Saab\nLPL –  Liverpool, England, United Kingdom – Liverpool\nLRD –  Laredo, TX, USA – International\nLRH –  La Rochelle, France – Laleu\nLRM –  Casa De Campo, Dominican Republic\nLRS –  Leros, Greece – Leros\nLRT –  Lorient, France – Lann-Bihoue\nLRU –  Las Cruces, NM, USA\nLSC –  La Serena, Chile – La Florida\nLSE –  La Crosse, WI, USA – La Crosse Municipal\nLSI –  Shetland Islands /Shetland Isd, Scotland, United Kingdom – Shetland Islands\nLSP –  Las Piedras, Venezuela – Josefa Camejo\nLSQ –  Los Angeles, Chile – Maria Dolores\nLSS –  Terre-De-Haut, Guadeloupe\nLST –  Launceston, Tasmania, Australia – Launceston\nLSY –  Lismore, New South Wales, Australia – Lismore\nLTN –  London, England, United Kingdom – Luton International\nLTO –  Loreto, Baja California Sur, Mexico\nLUA –  Lukla, Nepal – Lukla\nLUD –  Luderitz, Namibia – Luderitz\nLUG –  Lugano, Switzerland – Agno\nLUN –  Lusaka, Zambia – Lusaka\nLUX –  Luxembourg, Luxembourg – Findel\nLVI –  Livingstone, Zambia – Livingstone\nLWB –  Greenbrier, WV, USA – Greenbrier Valley Airport\nLWK –  Shetland Islands /Shetland Isd, Scotland, United Kingdom – Tingwall\nLWO –  Lvov, Ukraine – Snilow\nLWS –  Lewiston, ID, USA – Lewiston-Nez Perce Airport\nLWT –  Lewistown, MT, USA – Municipal\nLWY –  Lawas, Sarawak, Malaysia – Lawas\nLXR –  Luxor, Egypt – Luxor\nLYH –  Lynchburg, VA, USA – Municipal Airport\nLYP –  Faisalabad, Pakistan – Lyallpur\nLYR –  Longyearbyen, Norway – Svalbard\nLYS – Lyon, France – Satolas\nLZC –  Lazaro Cardenas, Michoacan, Mexico – Na\nMAA –  Madras, India – Meenambarkkam\nMAD –  Madrid, Spain – Barajas\nMAF –  Midland/Odessa, TX, USA – Midland Intl Airport\nMAG –  Madang, Papua New Guinea – Madang\nMAH –  Menorca, Spain – Aerop De Menorca\nMAJ –  Majuro, Marshall Islands – International\nMAM –  Matamoros, Tamaulipas, Mexico – Servando Canales\nMAN –  Manchester, England, United Kingdom – International\nMAO –  Manaus, Amazonas, Brazil – Eduardo Gomes\nMAR –  Maracaibo, Venezuela – La Chinita\nMAY –  Mangrove Cay, Bahamas\nMAZ –  Mayaguez, PR, USA – El Maui\nMBA –  Mombasa, Kenya – Moi International\nMBJ –  Montego Bay, Jamaica – Sangster\nMBL –  Manistee, MI, USA – Manistee Blacker Airport\nMBS –  Midland / Bay City / Saginaw, MI, USA – Tri-City Airport\nMCG –  Mc Grath, AK, USA – Mc Grath\nMCI –  Kansas City, MO, USA – Kansas City International Airport\nMCK –  Mc Cook, NE, USA – Municipal\nMCM –  Monte Carlo, Monaco – Hel De Monte Carlo\nMCN –  Macon, GA, USA – Lewis B Wilson\nMCO –  Orlando, FL, USA – Orlando International Airport\nMCP –  Macapa, Amapa, Brazil\nMCT –  Muscat, Oman – Seeb\nMCW –  Mason City, IA, USA – Mason City Municipal Airport\nMCY –  Sunshine Coast, Queensland, Australia – Maroochydore\nMDC –  Manado, Indonesia – Samratulang\nMDE –  Medellin, Colombia – La Playas\nMDH –  Carbondale, IL, USA – Southern Illinois Airport\nMDQ –  Mar Del Plata, Buenos Aires, Argentina\nMDT –  Harrisburg, PA, USA – Harrisburg International Airport\nMDW –  Chicago, IL, USA – Midway\nMDZ –  Mendoza, Mendoza, Argentina – El Plumerillo\nMED –  Medinah, Saudi Arabia – Madinah-Prince Mohammad Bin Abdulaziz\nMEI –  Meridian, MS, USA – Key Field\nMEL –  Melbourne, Victoria, Australia – Tullamarine\nMEM –  Memphis, TN, USA – Memphis International Airport\nMES –  Medan, Indonesia – Poland\nMEX –  Mexico City, Distrito Federal, Mexico – Juarez Intl Airport\nMEY –  Meghauli, Nepal – Meghauli\nMFE –  Mc Allen/Mission, TX, USA\nMFN – Milford Sound, New Zealand\nMFR –  Medford, OR, USA – Medford-Jackson County Airport\nMGA –  Managua, Nicaragua\nMGM –  Montgomery, AL, USA – Dannelly Field\nMGQ –  Mogadishu, Somalia\nMGW –  Morgantown, WV, USA – Morgantown Municipal Airport\nMHH –  Marsh Harbour, Bahamas\nMHK –  Manhattan, KS, USA – Manhattan Municipal\nMHQ –  Mariehamn, Aland Island, Finland\nMHT –  Manchester, NH, USA – Manchester\nMIA –  Miami, FL, USA – Miami International Airport\nMID –  Merida, Yucatan, Mexico – Merida Internationl\nMIE –  Muncie, IN, USA – Delaware County Airport\nMIR –  Monastir, Tunisia – Skanes\nMJT –  Mytilene, Greece – Mytilene\nMJV –  Murcia, Spain – San Javier\nMKC –  Kansas City, MO, USA – Downtown\nMKE –  Milwaukee, WI, USA – General Mitchell Field\nMKG –  Muskegon, MI, USA – Muskegon County Intl Airport\nMKK –  Hoolehua, HI, USA – Municipal\nMKL –  Jackson, TN, USA – Mc Kellar Field\nMKM –  Mukah, Sarawak, Malaysia\nMKW –  Manokwari, Indonesia – Rendani\nMKY –  Mackay, Queensland, Australia – Mackay\nMLA –  Malta, Malta – Luqa\nMLB –  Melbourne, FL, USA – Melbourne Regional Airport\nMLE –  Male, Maldives – Male International\nMLG –  Malang, Indonesia\nMLH –  Mulhouse, France – Mulhouse\nMLI –  Moline, IL, USA – Quad City Airport\nMLM –  Morelia, Michoacan, Mexico – Municipal\nMLO –  Milos, Greece – Milos\nMLS –  Miles City, MT, USA – Miles City\nMLU –  Monroe, LA, USA\nMMB –  Memanbetsu, Japan\nMME –  Teesside, England, United Kingdom – Tees-Side\nMMH –  Mammoth Lakes, CA, USA – Mammoth Lakes Airport\nMMK –  Murmansk, Russia – Murmansk\nMMU –  Morristown, NJ, USA – Morristown\nMMX –  Malmo, Sweden – Sturup\nMNI –  Montserrat, Montserrat – Blackburne\nMNL –  Manila, Philippines – Ninoy Aquino International\nMNM –  Menominee, MI, USA – Twin County Airport\nMOB –  Mobile, AL, USA – Mobile Municipal\nMOD –  Modesto, CA, USA – Harry Sham Feild\nMOL –  Molde, Norway – Aro\nMOT – Minot, ND, USA – Minot International Airport\nMOW –  Moscow, Russia\nMPA –  Mpacha, Namibia\nMPB –  Miami, FL, USA – Miami Public Seaplane Base\nMPL –  Montpellier, France – Frejorgues\nMPM –  Maputo, Mozambique – Maputo International\nMQL –  Mildura, Victoria, Australia – Mildura\nMQN –  Mo I Rana, Norway – Rossvoll\nMQT –  Marquette, MI, USA – Marquette County Airport\nMRD –  Merida, Venezuela – Alberto Carnevalli\nMRK –  Marco Island, FL, USA\nMRS –  Marseille, France – Marseille-Provence\nMRU –  Mauritius, Mauritius – Plaisance\nMRY –  Monterey / Carmel, CA, USA – Monterey Peninsula Airport\nMSJ –  Misawa, Japan\nMSL –  Muscle Shoals / Florence / Sheffield, AL, USA – Muscle Shoals\nMSN –  Madison, WI, USA – Dane County Regional Airport\nMSO –  Missoula, MT, USA – Missoula International\nMSP –  Minneapolis, MN, USA – Minneapolis/St Paul Intl Airport\nMSQ –  Minsk, Belarus – Minsk\nMSS –  Massena, NY, USA\nMST –  Maastricht, Netherlands – Zuid-Limburg\nMSU –  Maseru, Lesotho – Maseru\nMSY –  New Orleans, LA, USA – Moisant International Airport\nMTH –  Marathon, FL, USA\nMTJ –  Montrose, CO, USA – Montrose County Airport\nMTY –  Monterrey, Nuevo Leon, Mexico – Escobedo\nMUB –  Maun, Botswana\nMUC –  Munich, Germany – Franz Josef Strauss\nMUN –  Maturin, Venezuela\nMVD –  Montevideo, Uruguay – Carrasco\nMVN –  Mount Vernon, IL, USA – Mount Vernon Outland Airport\nMVY –  Marthas Vineyard, MA, USA\nMWA –  Marion, IL, USA\nMXL –  Mexicali, Baja California, Mexico – Rodolfo Sanchez Taboada\nMXP –  Milan, Italy – Malpensa\nMYA –  Moruya, New South Wales, Australia – Moruya\nMYJ –  Matsuyama, Japan – Matsuyama\nMYR –  Myrtle Beach, SC, USA\nMYY –  Miri, Sarawak, Malaysia – Miri\nMZL –  Manizales, Colombia – Santaguida\nMZT –  Mazatlan, Sinaloa, Mexico – Buelna\nMZV –  Mulu, Malaysia – Mulu Airport\nNAG –  Nagpur, India – Sonegaon\nNAH –  Naha, Indonesia\nNAK –  Nakhon Ratchasima, Thailand – Nakhon Ratchasima\nNAN –  Nadi, Fiji – International\nNAP –  Naples, Italy – Capodichino\nNAS –  Nassau, Bahamas – Nassau International Airport\nNAT –  Natal, Rio Grande Do Norte, Brazil – Agusto Severo\nNAY –  Beijing, China\nNBO –  Nairobi, Kenya – Jomo Kenyatta Internatonal\nNCA –  North Caicos, Turks And Caicos Islands\nNCE –  Nice, France – Cote D'azur\nNCL –  Newcastle, England, United Kingdom – International\nNCY –  Annecy, France – Annecy-Meythe\nNDJ –  N Djamena, Chad – N'djamena\nNEC –  Necochea, Buenos Aires, Argentina – Necochea\nNEV –  Nevis, Leeward Islands, Saint Kitts And Nevis\nNGO –  Nagoya, Japan – Komaki\nNGS –  Nagasaki, Japan – Nagasaki\nNJC –  Nizhnevartovsk, Russia – Nizhnevartovsk\nNKC –  Nouakchott, Mauritania – Nouakchott\nNKG –  Nanjing, China\nNLA –  Ndola, Zambia – Ndola\nNLD –  Nuevo Laredo, Tamaulipas, Mexico\nNLP –  Nelspruit, South Africa\nNNG –  Nanning, China\nNOC –  Connaught, Ireland – Rep Of Ireland\nNOU –  Noumea, New Caledonia – Tontouta\nNPL –  New Plymouth, New Zealand – New Plymouth\nNQY –  Newquay, England, United Kingdom – Newquay Civil\nNRT –  Tokyo, Japan – Narita\nNRT –  Tokyo, Japan\nNSB –  Bimini, Bahamas – North Seaplane Base\nNSI –  Yaounde, Cameroon – Nsimalen\nNSN –  Nelson, New Zealand – Nelson\nNTE –  Nantes, France – Nantes-Chateau Bougon\nNTL –  Newcastle, New South Wales, Australia – Williamtown\nNUE –  Nuremberg, Germany – Nuremberg\nNVT –  Navegantes, Santa Catarina, Brazil\nNWA –  Moheli, Comoros\nNWI –  Norwich, England, United Kingdom – Norwich\nOAG –  Orange, New South Wales, Australia – Springhill\nOAJ –  Jacksonville, NC, USA\nOAK –  Oakland, CA, USA – Metropolitan Oakland Intl Apt\nOAX –  Oaxaca, Oaxaca, Mexico – Xoxocotlan\nOBO –  Obihiro, Japan – Obihiro\nODE –  Odense, Denmark – Odense\nODS –  Odessa, Ukraine – Central\nODW –  Oak Harbor, WA, USA\nOFK –  Norfolk, NE, USA – Karl Stefan Memorial Airport\nOGG – Kahului, HI, USA – Kahului Airport\nOGS –  Ogdensburg, NY, USA\nOHD –  Ohrid, Macedonia – Ohrid\nOIT –  Oita, Japan – Oita\nOKA –  Okinawa, Ryukyu Islands, Japan – Naha Field\nOKC –  Oklahoma City, OK, USA – Will Rogers World Airport\nOKJ –  Okayama, Japan – Okayama\nOLF –  Wolf Point, MT, USA\nOMA –  Omaha, NE, USA – Eppley Airfield\nOME –  Nome, AK, USA\nOMR –  Oradea, Romania – Oradea\nNGO –  Mornington, Queensland, Australia – Mornington Is\nONT –  Ontario, CA, USA – Ontario International\nOOK –  Toksook Bay, AK, USA\nOOL –  Gold Coast, Queensland, Australia – Coolangatta\nOOM –  Cooma, New South Wales, Australia\nOPF –  Miami, FL, USA – Opa Locka\nOPO –  Porto, Portugal – Porto\nORB –  Orebro, Sweden – Orebro\nORD –  Chicago, IL, USA – O'hare International Airport\nORF –  Norfolk, VA, USA – Norfolk International Airport\nORH –  Worcester, MA, USA – Worcester /James D O'brien Field\nORK –  Cork, Ireland – Cork\nORL –  Orlando, FL, USA – Herndon\nORN –  Oran, Algeria – Es Senia\nORY –  Paris, France – Orly\nOSA –  Osaka, Japan – Osaka International\nOSD –  Ostersund, Sweden – Froesoe\nOSH –  Oshkosh, WI, USA – Wittman Field\nOTH –  North Bend, OR, USA\nOTM –  Ottumwa, IA, USA – Ottumwa Industrial Airport\nOTP –  Bucharest, Romania – Otopeni\nOTZ –  Kotzebue, AK, USA\nOUA –  Ouagadougou, Burkina Faso – Ouagadougou\nOUL –  Oulu, Finland – Oulu\nOVB –  Novosibirsk, Russia – Tolmachevo\nOVD –  Asturias, Spain – Asturias\nOWB –  Owensboro, KY, USA\nOWD –  Norwood, MA, USA – Memorial Code: Owd\nOXB –  Bissau, Guinea-Bissau – Osvaldo Vieira\nOXR –  Oxnard / Ventura, CA, USA – Oxnard Airport\nOZZ –  Ouarzazate, Morocco – Ouarzazate\nPAD –  Paderborn, Germany – Paderborn\nPAH –  Paducah, KY, USA\nPAP –  Port Au Prince, Haiti – Mais Gate\nPAR –  Paris, France\nPAS –  Paros, Greece – Paros Community\nPAT –  Patna, India – Patna\nPEACE – Poza Rica, Veracruz, Mexico\nPBC –  Puebla, Puebla, Mexico\nPBI –  West Palm Beach, FL, USA – Palm Beach International Airport\nPBM –  Paramaribo, Suriname – Zanderij Intl\nPBO –  Paraburdoo, Western Australia, Australia – Paraburdoo\nPCL –  Pucallpa, Peru – Captain Rolden\nPCT –  Princeton, NJ, USA – Princeton Municipal\nPDG –  Padang, Indonesia – Tabing\nPDL –  Ponta Delgada, Azores Islands, Portugal – Nordela\nPDT –  Pendleton, OR, USA\nPDX –  Portland, OR, USA – Portland International Airport\nPEE –  Perm, Russia – Perm\nPEG –  Perugia, Italy – Na\nPEI –  Pereira, Colombia – Matecana\nPEK –  Beijing, China – Peking Capital Airport\nPEN –  Penang, Malaysia – Penang International\nPER –  Perth, Western Australia, Australia – Perth\nPES –  Petrozavodsk, Russia – Petrozavodsk Airport\nPEW –  Peshawar, Pakistan – Peshawar\nPFN –  Panama City, FL, USA\nPFO –  Paphos, Cyprus – International\nPGA –  Page, AZ, USA\nPGF –  Perpignan, France – Llabanere\nPGV –  Greenville, NC, USA\nPGX –  Perigueux, France\nPHE –  Port Hedland, Western Australia, Australia – Port Hedlan\nPHF –  Newport News/Williamsburg/Hampton, VA, USA – Patrick Henry Intl\nPHL –  Philadelphia, PA, USA – Philadelphia International Airport\nPHO –  Point Hope, AK, USA – Point Hope\nPHS –  Phitsanulok, Thailand\nPHX –  Phoenix, AZ, USA – Sky Harbor International Airport\nPIA –  Peoria, IL, USA – Greater Peoria Airport\nPIB –  Laurel, MS, USA – Laurel Hattiesburg/Camp Shelby\nPID –  Nassau, Bahamas – Paradise Island\nPIE –  St Petersburg/Clearwater, FL, USA – St Petersburg/Clearwater Intl\nPIH –  Pocatello, ID, USA\nPIK –  Glasgow, Scotland, United Kingdom – Prestwick\nPIR –  Pierre, SD, USA – Pierre Municipal Airport\nPIT –  Pittsburgh, PA, USA – Greater Pit Intnl Airport\nPIW –  Pikwitonei, Manitoba, Canada\nPJG –  Panjgur, Pakistan\nPKB –  Parkersburg / Marietta, WV, USA – Wood County\nPKC –  Petropavlovsk-Kamchatsky, Russia – Petropavlovsk-Kamchatsky\nPKE –  Parkes, New South Wales, Australia – Parkes\nPKR –  Pokhara, Nepal – Pokhara\nPKU –  Pekanbaru, Indonesia – Simpang Tiga\nPLB –  Plattsburgh, NY, USA\nPLH –  Plymouth, England, United Kingdom – Plymouth Airport\nPLM –  Palembang, Indonesia – Sultan Mahmud Badaruddin Ii\nPLN –  Pellston, MI, USA – Pellston Regional Airport\nPLO –  Port Lincoln, South Australia, Australia – Port Lincoln\nPLQ –  Palanga, Lithuania – Palanga\nPLS –  Providenciales, Turks And Caicos Islands\nPLU –  Belo Horizonte /Belo Horizon, Minas Gerais, Brazil – Confins/Pampulha\nPLW –  Palu, Indonesia – Mutiara\nPLZ –  Port Elizabeth, South Africa – Hf Verwoerd\nPMC –  Puerto Montt, Chile – Tepual\nPMD –  Palmdale, CA, USA – Air Force 42\nPMI –  Palma Mallorca, Mallorca Island, Spain – Palma Mallorca\nPMO –  Palermo, Sicily, Italy – Punta Raisi\nPMR –  Palmerston North, New Zealand – Palmerstown North\nPMV –  Porlamar, Venezuela – Gral Santiago Marino\nPNA –  Pamplona, Spain – Pamplona – Noain\nPNC –  Ponca City, OK, USA\nPNH –  Phnom Penh, Cambodia – Pochentong\nPNI –  Pohnpei, Caroline Islands, Micronesia – Pohnpei International\nPNK –  Pontianak, Indonesia – Supadio\nPNL –  Pantelleria, Italy – Pantelleria\nPNQ –  Poona, India – Lohegaon Poona\nPNR –  Pointe Noire, Congo – Pointe Noire\nPNS –  Pensacola, FL, USA\nPOA –  Porto Alegre, Rio Grande Do Sul, Brazil – Salgado Filho\nPOG –  Port Gentil, Gabon – Port Gentil\nPOM –  Port Moresby, Papua New Guinea – Jackson\nPOP –  Puerto Plata, Dominican Republic – La Union\nPOR –  Pori, Finland – Pori\nPOS –  Port Of Spain, Trinidad, Trinidad And Tobago – Piarco International Airport\nPOU –  Poughkeepsie, NY, USA – Dutchess County\nPOZ –  Poznan, Poland – Lawica\nPPG –  Pago Pago, American Samoa – International\nPPS –  Puerto Princesa, Philippines – Puerto Princesa\nPPT –  Papeete, French Polynesia – Intl Tahiti-Faaa\nPQI –  Presque Isle, ME, USA\nPQQ –  Port Macquarie, New South Wales, Australia – Port Macquarie\nPRC –  Prescott, AZ, USA\nPRG –  Prague, Czech Republic – Ruzyne\nPRI – Praslin Island, Seychelles\nPSA –  Pisa, Italy – G Galilei\nPSE –  Ponce, PR, USA – Mercedita\nPSG –  Petersburg, AK, USA – Municipal\nPSM –  Portsmouth, NH, USA – Pease Intl Tradeport\nPSO –  Pasto, Colombia – Cano\nPSP –  Palm Springs, CA, USA – Palm Springs Municipal\nPSR –  Pescara, Italy – Liberi\nPSZ –  Puerto Suarez, Bolivia\nPTF –  Malololailai, Fiji – Malololailai\nPTG –  Pietersburg, South Africa\nPTP –  Pointe A Pitre, Guadeloupe – Le Raizet\nPTY –  Panama City, Panama – Tocumen International Airport\nPUB –  Pueblo, CO, USA – Pueblo Memorial Airport\nPUJ –  Punta Cana, Dominican Republic\nPUQ –  Punta Arenas, Chile – Presidente Ibanez\nPUS –  Pusan, South Korea – Kimhae\nPUW –  Pullman, WA, USA – Pullman\nPUY –  Pula, Croatia (Hrvatska) – Pula\nPUZ –  Port Cabezas, Nicaragua – Puerto Cabezas\nPVC –  Provincetown, MA, USA – Provincetown Municipal Airport\nPVD –  Providence, RI, USA – Tf Green State Airport\nPVR –  Puerto Vallarta, Jalisco, Mexico – Gustavo Diaz Ordaz\nPVU –  Provo, UT, USA – Provo\nPWK –  Chicago, IL, USA – Pal-Waukee Airport\nPWM –  Portland, ME, USA – Portland International Jetport\nPWT –  Bremerton, WA, USA – Municipal\nPXM –  Puerto Escondido, Oaxaca, Mexico\nPXO –  Porto Santo, Madeira Islands, Portugal – Porto Santo\nPZE –  Penzance, England, United Kingdom – Penzance\nPZO –  Puerto Ordaz, Venezuela – Puerto Ordaz\nQBF –  Vail/Eagle, CO, USA\nQDU –  Duesseldorf, Germany – Main Train Station\nQKB –  Breckenridge, CO, USA\nQKL –  Cologne, Germany – Train Main Railroad Station\nQRO –  Queretaro, Queretaro, Mexico\nQSY –  Sydney, New South Wales, Australia\nRAB –  Rabaul, Papua New Guinea – Lakunai\nRAJ –  Rajkot, India – Rajkot\nRAK –  Marrakech, Morocco – Menara\nRAP –  Rapid City, SD, USA – Rapid City Regional Airport\nRAR –  Rarotonga, Cook Islands – Rarotonga\nRBA –  Rabat, Morocco – Sale\nRCB –  Richards Bay, South Africa – Richards Bay\nRCE –  Roche Harbor, WA, USA – Roche Harbor\nRDD – Redding, CA, USA – Redding Municipal Airport\nRDG –  Reading, PA, USA – Municipal / Spaatz Field\nRDU –  Raleigh/Durham, NC, USA – Raleigh Durham International Arpt\nREC –  Recife, Pernambuco, Brazil – Guararapes International\nREG –  Reggio Calabria, Italy – Tito Menniti\nREL –  Trelew, Chubut, Argentina\nRES –  Resistencia, Chaco, Argentina\nREU –  Reus, Spain – Reus\nREX –  Reynosa, Tamaulipas, Mexico – General Lucio Blanco Airport\nRFD –  Rockford, IL, USA – Greater Rockford\nRGA –  Rio Grande, Tierra Del Fuego, Argentina\nRGL –  Rio Gallegos, Santa Cruz, Argentina – Rio Gallegos-Internacional\nRGN –  Yangon, Myanmar – Mingaladon\nRHI –  Rhinelander, WI, USA – Rhinelander Oneida County Airport\nRHO –  Rhodes, Greece – Paradisi\nRIC –  Richmond, VA, USA – Richmond International Airport\nRIO –  Rio De Janeiro, Rio De Janeiro, Brazil\nRIW –  Riverton, WY, USA – Riverton Regional Airport\nRIX –  Riga, Latvia – Riga\nRKD –  Rockland, ME, USA – Rockland\nRKS –  Rock Springs, WY, USA – Rock Springs Sweetwater Cty Arpt\nRKV –  Reykjavik, Iceland – Reykjavik Domestic Airport\nRMA –  Roma, Queensland, Australia – Roma\nRNB –  Ronneby, Sweden – Kallinge\nRNN –  Bornholm, Denmark – Arnager\nRNO –  Reno, NV, USA – Reno-Cannon International Apt\nRNS –  Rennes, France – St Jacques\nROA –  Roanoke, VA, USA – Roanoke Regional Airport\nROC –  Rochester, NY, USA – Monroe County Airport\nROM –  Rome, Italy – Leonardo Da Vinci / Fiumicino\nROP –  Rota, Northern Mariana Islands – Rota\nROR –  Koror, Palau – Airai\nROS –  Rosario, Santa Fe, Argentina – Fisherton\nROV –  Rostov, Russia – Rostov\nROW –  Roswell, NM, USA – Industrial Air Center\nRPR –  Raipur, India\nRRG –  Rodrigues Island, Mauritius – Rodrigues\nRSA –  Santa Rosa, La Pampa, Argentina\nRSD –  Rock Sound, Bahamas\nRST –  Rochester, MN, USA – Rochester Municipal\nRSU –  Yosu, South Korea – Yosu Airport\nRSW –  Fort Myers, FL, USA – Southwest Regional Airport\nRTB –  Roatan, Honduras – Roatan\nRTM – Rotterdam, Netherlands – Rotterdam\nRUH –  Riyadh, Saudi Arabia – King Khaled Intl\nRUI –  Ruidoso, NM, USA\nRUN –  St-Denis De La Reunion, Reunion – Gillot\nRUT –  Rutland, VT, USA\nRWI –  Rocky Mount, NC, USA – Wilson\nSAB –  Saba Island, Netherlands Antilles\nSAF –  Santa Fe, NM, USA – Santa Fe Municipal Airport\nSAH –  Sanaa, Yemen – International\nSAL –  San Salvador, El Salvador – El Salvadore Intl Airport\nSAN –  San Diego, CA, USA – Lindbergh International Airport\nSAP –  San Pedro Sula, Honduras – La Mesa\nSAT –  San Antonio, TX, USA – San Antonio International\nSAV –  Savannah, GA, USA – Travis Field\nSBA –  Santa Barbara, CA, USA – Santa Barbara Airport\nSBH –  St Barthelemy, Guadeloupe\nSBN –  South Bend, IN, USA – Michiana Regional Airport\nSBP –  San Luis Obispo, CA, USA – San Luis Bishop County Airport\nSBW –  Sibu, Sarawak, Malaysia – Sibu\nSBY –  Salisbury, MD, USA – Salisbury-Wicomico County Arpt\nSCE –  State College, PA, USA – University Park Arpt\nSCL –  Santiago, Chile – Comodoro Arturo Merino Benitez Airport\nSCN –  Saarbruecken, Germany – Ensheim\nSCQ –  Santiago De Compostela, Spain – Santiago\nSCU –  Santiago, Cuba – Santiago-Antonio Maceo Cuba\nSDF –  Louisville, KY, USA – Standiford Field\nSDJ –  Sendai, Japan – Sendai\nSDK –  Sandakan, Sabah, Malaysia\nSDL –  Sundsvall, Sweden – Sundsvall\nSDN –  Sandane, Norway\nSDQ –  Santo Domingo, Dominican Republic – Las Americas\nSDR –  Santander, Spain – Santander\nSDU –  Rio De Janeiro, Rio De Janeiro, Brazil – Santos Dumont\nSDX –  Sedona, AZ, USA\nSDY –  Sidney, MT, USA\nSEA –  Seattle, WA, USA – Seattle Tacoma Intl Airport\nSEL –  Seoul, South Korea – Kimpo International\nSEZ –  Mahe Island, Seychelles – Mahe Island Seychelles Intl\nSFA –  Sfax, Tunisia – Sfax Airport\nSFG –  St Martin, Netherlands Antilles – Esperance\nSFJ –  Kangerlussuaq, Greenland – Sondre Stromfjord\nSFN –  Santa Fe, Santa Fe, Argentina\nSFO –  San Francisco, CA, USA – San Francisco Intl Airport\nSFT – Skelleftea, Sweden – Skelleftea\nSGC –  Surgut, Russia\nSGD –  Sonderborg, Denmark – Sonderborg\nSGF –  Springfield, MO, USA – Springfield Regional Airport\nSGN –  Ho Chi Minh City, Vietnam – Tan Son Nhut\nSGO –  St George, Queensland, Australia – St George\nSGU –  Saint George, UT, USA – St George\nSGY –  Skagway, AK, USA\nSHA –  Shanghai, China – Shanghai Intl /Hongqiao/\nSHC –  Indaselassie, Ethiopia\nSHD –  Staunton, VA, USA – Shenandoah Valley Regional\nSHE –  Shenyang, China – Shenyang\nSHJ –  Sharjah, United Arab Emirates – Sharjah\nSHO –  Sokcho, South Korea\nSHR –  Sheridan, WY, USA – Sheridan County Airport\nSHV –  Shreveport, LA, USA – Regional Airport\nSID –  Sal, Cape Verde – Amilcar Cabral International\nSIN –  Singapore, Singapore – Changi International Airport\nSIP –  Simferopol, Ukraine – Simferopol\nSIT –  Sitka, AK, USA – Sitka\nSJC –  San Jose, CA, USA – San Jose International Airport\nSJD –  San Jose Del Cabo, Baja California Sur, Mexico – Los Cabos Intl Airport\nSJI –  San Jose, Philippines – Mcguire Field\nSJJ –  Sarajevo, Bosnia And Herzegowina – Butmir\nSJO –  San Jose, Costa Rica – Juan Santamaria International\nSJT –  San Angelo, TX, USA\nSJU –  San Juan, PR, USA – Luis Munoz Marin International\nSJW –  Shijiazhuang, China – Shijiazhuang\nSKB –  St Kitts, Saint Kitts And Nevis – Golden Rock\nSKD –  Samarkand, Uzbekistan\nSKG –  Thessaloniki, Greece – Thessaloniki\nSKP –  Skopje, Macedonia – Skopje\nSKS –  Vojens Lufthavn, Denmark – Jojens\nSLA –  Salta, Salta, Argentina – International\nSLC –  Salt Lake City, UT, USA – Salt Lake City International Arpt\nSLK –  Saranac Lake, NY, USA – Adirondack\nSLN –  Salina, KS, USA – Salina Municipal\nSLP –  San Luis Potosi, San Luis Potosi, Mexico\nSLU –  St Lucia, Saint Lucia – Vigie Field\nSLW –  Saltillo, Coahuila, Mexico – Saltillo\nSLZ –  Sao Luiz, Maranhao, Brazil – Tirirical\nSMF –  Sacramento, CA, USA – Sacramento Metropolitan\nSML –  Stella Maris, Bahamas\nSMM – Semporna, Sabah, Malaysia – Semporna\nSMS –  St Marie, Madagascar\nSMX –  Santa Maria, CA, USA – Santa Maria Public Airport\nSNA –  Santa Ana, CA, USA – John Wayne Airport\nSNB –  Snake Bay, Northern Territory, Australia\nSNN –  Shannon, Ireland – Shannon\nSNO –  Sakon Nakhon, Thailand\nSOF –  Sofia, Bulgaria – Sofia Intl\nSOG –  Sogndal, Norway – Haukasen\nSOM –  San Tome, Venezuela\nSOP –  Southern Pines, NC, USA – Pinehurst\nSOU –  Southampton, England, United Kingdom – Eastleigh\nSOW –  Show Low, AZ, USA\nSPB –  St Thomas Island, VI, USA – Seaplane Base\nSPC –  Santa Cruz La Palma, Canary Islands, Spain – La Palma\nSPD –  Saidpur, Bangladesh\nSPI –  Springfield, IL, USA – Capital Airport\nSPN –  Saipan, Northern Mariana Islands – Saipan Intl Northern Mariana Isles\nSPR –  San Pedro, Belize – San Pedro\nSPS –  Wichita Falls, TX, USA – Wichita Falls Municipal\nSPU –  Split, Croatia (Hrvatska) – Split\nSPW –  Spencer, IA, USA – Spencer Municipal Airport\nSRE –  Sucre, Bolivia – Sucre\nSRQ –  Sarasota/Bradenton, FL, USA – Sarasota-Bradenton\nSSA –  Salvador, Bahia, Brazil – Dois De Julho\nSSB –  St Croix Island, VI, USA – Sea Plane Base\nSSG –  Malabo, Equatorial Guinea – Santa Isabel\nSSH –  Sharm El Sheikh, Egypt – Ophira\nSSJ –  Sandnessjoen, Norway – Stokka\nSSQ –  La Sarre, Quebec, Canada\nSTC –  Saint Cloud, MN, USA – Saint Cloud\nSTD –  Santo Domingo, Venezuela – Mayor Humberto Vivas Guerrero\nSTI –  Santiago, Dominican Republic – Municipal\nSTL –  St Louis, MO, USA – Lambert-St Louis Internatl\nSTM –  Santarem, Para, Brazil\nSTN –  London, England, United Kingdom – Stansted\nSTP –  St Paul, MN, USA – Downtown Airport\nSTR –  Stuttgart, Germany – Echterdingen\nSTS –  Santa Rosa, CA, USA – Sonoma County Airport\nSTT –  St Thomas Island, VI, USA – Cyril E King Arpt\nSTX –  St Croix Island, VI, USA\nSUB –  Surabaya, Indonesia – Juanda Airport\nSUE –  Sturgeon Bay, WI, USA\nSUN –  Sun Valley/Hailey, ID, USA\nSUV –  Suva, Fiji – Nausori\nSVD –  St Vincent, St. Vincent And The Grenadines\nSVG –  Stavanger, Norway – Sola\nSVL –  Savonlinna, Finland – Savonlinna\nSVO –  Moscow, Russia – Sheremetyevo\nSVQ –  Sevilla, Spain\nSVU –  Savusavu, Fiji – Savusavu\nSVX –  Ekaterinburg, Russia\nSVZ –  San Antonio, Venezuela\nSWA –  Shantou, China\nSWF –  Newburgh/Poughkeepsie, NY, USA – Stewart\nSWP –  Swakopmund, Namibia\nSWQ –  Sumbawa Island, Indonesia – Brang Bidji\nSXB –  Strasbourg, France – Entzheim\nSXF –  Berlin, Germany – Schoenefeld\nSXL –  Sligo, Ireland – Collooney\nSXM –  St Maarten, Netherlands Antilles – Juliana\nSXR –  Srinagar, India\nSYD –  Sydney, New South Wales, Australia – Sydney /Kingsford-Smith/ Airport\nSYO –  Shonai, Japan – Shonai\nSYR –  Syracuse, NY, USA – Hancock International\nSYX –  Sanya, China\nSYY –  Stornoway, Scotland, United Kingdom – Stornoway\nSYZ –  Shiraz, Iran – Shiraz\nSZG –  Salzburg, Austria – Salzburg\nSZX –  Shenzhen, China – Shenzhen\nSZZ –  Szczecin, Poland – Goleniow\nTAB –  Tobago, Tobago, Trinidad And Tobago – Crown Point\nTAC –  Tacloban, Philippines – Dz Romualdez\nTAE –  Taegu, South Korea\nTAG –  Tagbilaran, Philippines – Tagbilaran\nTAI –  Taiz, Yemen – Al-Janad\nTAM –  Tampico, Tamaulipas, Mexico\nTAP –  Tapachula, Chiapas, Mexico – Tapachula International\nTAS –  Tashkent, Uzbekistan – Tashkent\nTAT –  Tatry/Poprad, Slovakia – Tatry/Poprad\nTBN –  Ft Leonard Wood, MO, USA – Forney Field\nTBP –  Tumbes, Peru – Tumbes\nTBS –  Tbilisi, Georgia – Novo Alexeyevka\nTBT –  Tabatinga, Amazonas, Brazil\nTBU –  Nuku Alofa/Tongatapu, Tonga – International\nTCI –  Tenerife, Canary Islands, Spain – Tenerife Norte Los Rodeos\nTCL –  Tuscaloosa, AL, USA – Van De Graff\nTDD –  Trinidad, Bolivia\nTED –  Thisted, Denmark\nTER –  Terceira Island, Azores Islands, Portugal – Lajes\nTEX –  Telluride, CO, USA – Telluride Municipal Airport\nTEZ –  Tezpur, India – Salonbari\nTFN – Tenerife, Canary Islands, Spain – Tenerife Norte Los Rodeos\nTFS –  Tenerife, Canary Islands, Spain – Reina Sofia\nTGD –  Podgorica, Yugoslavia – Golubovci\nTGG –  Kuala Terengganu, Malaysia – Sultan Mahmood\nTGM –  Tirgu Mures, Romania – Tirgu Mures\nTGU –  Tegucigalpa, Honduras – Toncontin\nTGZ –  Tuxtla Gutierrez, Chiapas, Mexico – Llano San Juan\nTHE –  Teresina, Piaui, Brazil – Teresina\nTHF –  Berlin, Germany – Tempelhof\nTHR –  Tehran, Iran – Mehrabad\nTHU –  Pituffik, Greenland – Thule Airport\nTIA –  Tirana, Albania – Rinas\nTIJ –  Tijuana, Baja California, Mexico – General Abelardo L Rodriguez\nTIQ –  Tinian, Northern Mariana Islands – Tinian\nTIS –  Thursday Island, Queensland, Australia – Horn Island\nTIV –  Tivat, Yugoslavia – Tivat\nTIZ –  Tari, Papua New Guinea\nTJA –  Tarija, Bolivia\nTJM –  Tyumen, Russia – Tyumen\nTKK –  Truk, Caroline Islands, Micronesia – Truk\nTKQ –  Kigoma, Tanzania\nTKS –  Tokushima, Japan – Tokushima\nTKU –  Turku, Finland – Turku\nTLH –  Tallahassee, FL, USA\nTLL –  Tallinn, Estonia – Ulemiste\nTLS –  Toulouse, France – Blagnac\nTLV –  Tel Aviv Yafo, Israel – Ben-Gurion International\nTMP –  Tampere, Finland – Tampere-Pirkkala\nTMW –  Tamworth, New South Wales, Australia – Tamworth\nTNG –  Tangier, Morocco – Boukhalef Souahel\nTNR –  Antananarivo, Madagascar – Ivato\nTOL –  Toledo, OH, USA – Toledo Express Airport\nTOS –  Tromso, Norway – Tromso/Langes\nTOY –  Toyama, Japan – Toyama\nTPA –  Tampa, FL, USA – Tampa International\nTPE –  Taipei, Taiwan – Chiang Kai Shek Airport\nTPL –  Temple, TX, USA\nTPP –  Tarapoto, Peru – Tarapoto\nTPQ –  Tepic, Nayarit, Mexico\nTPS –  Trapani, Sicily, Italy – Birgi\nTRC –  Torreon, Coahuila, Mexico\nTRD –  Trondheim, Norway – Trondheim-Vaernes\nTRE –  Tiree, Scotland, United Kingdom – Tiree Island\nTRF –  Sandefjord, Norway – Torf\nTRG –  Tauranga, New Zealand – Tauranga\nTRI – Bristol/Johnson City/Kingsport, TN, USA – Municipal Tri-City Airport\nTRK –  Tarakan, Indonesia – Tarakan\nTRN –  Turin, Italy – Caselle\nTRS –  Trieste, Italy – Ronchi Dei Legionari\nTRU –  Trujillo, Peru – Trujillo\nTRV –  Trivandrum, India – Trivandrum\nTRZ –  Tiruchirapally, India – Civil\nTSA –  Taipei, Taiwan – Sung Shan\nTSR –  Timisoara, Romania – Timisoara\nTSS –  New York, NY, USA – East 34Th Street Heliport\nTSV –  Townsville, Queensland, Australia – Townsville\nTTE –  Ternate, Indonesia – Babullah\nTTJ –  Tottori, Japan – Tottori\nTTN –  Trenton, NJ, USA – Mercer County\nTUC –  Tucuman, Tucuman, Argentina – Benjamin Matienzo\nTUF –  Tours, France – St Symphorien\nTUL –  Tulsa, OK, USA – Tulsa International\nTUN –  Tunis, Tunisia – Carthage\nTUO –  Taupo, New Zealand – Taupo\nTUP –  Tupelo, MS, USA – Cd Lemons Municipal\nTUS –  Tucson, AZ, USA – Tucson International Airport\nTVC –  Traverse City, MI, USA – Cherry Capital Airport\nTVF –  Thief River Falls, MN, USA – Thief River Falls Municipal\nTVL –  South Lake Tahoe, CA, USA – Lake Tahoe\nTWB –  Toowoomba, Queensland, Australia – Toowoomba\nTWF –  Twin Falls, ID, USA\nTXK –  Texarkana, AR, USA – Municipal\nTXL –  Berlin, Germany – Tegel\nTXN –  Tunxi, China\nTYN –  Taiyuan, China\nTYR –  Tyler, TX, USA – Pounds Field\nTYS –  Knoxville, TN, USA – Mcghee Tyson\nTZA –  Belize City, Belize – Belize Municipal\nTZN –  South Andros, Bahamas – Congo Town\nTZX –  Trabzon, Turkey – Trabzon\nUAK –  Narsarsuaq, Greenland – Narssarssuaq\nUAQ –  San Juan, San Juan, Argentina\nUBJ –  Ube, Japan\nUCA –  Utica, NY, USA – Oneida County\nUDR –  Udaipur, India\nUEL –  Quelimane, Mozambique\nUET –  Quetta, Pakistan\nUGC –  Urgench, Uzbekistan\nUIB –  Quibdo, Colombia\nUIN –  Quincy, IL, USA – Baldwin Field\nUIO –  Quito, Ecuador – Marshal\nUIP –  Quimper, France – Pluguffan\nULN –  Ulan Bator, Mongolia – Ulan Bator\nULY –  Ulyanovsk, Russia – Ulyanoysk\nUME –  Umea, Sweden – Umea\nUMR –  Woomera, South Australia, Australia – Woomera\nUNT –  Unst Shetland Islands, Scotland, United Kingdom\nUPG –  Ujung Pandang, Indonesia – Hasanudin\nUPN –  Uruapan, Michoacan, Mexico\nURC –  Urumqi, China\nURO –  Rouen, France – Rouen /Boos Airport\nURT –  Surat Thani, Thailand\nUSH –  Ushuaia, Tierra Del Fuego, Argentina\nUSM –  Koh Samui, Thailand\nUSN –  Ulsan, South Korea\nUTH –  Udon Thani, Thailand – Udon\nUTN –  Upington, South Africa – Municipal\nUUD –  Ulan-Ude, Russia\nUVF –  St Lucia, Saint Lucia – Hewanorra\nVAA –  Vaasa, Finland – Vaasa\nVAR –  Varna, Bulgaria – Varna\nVAS –  Sivas, Turkey – Sivas\nVBY –  Visby, Sweden – Visby\nVCE –  Venice, Italy – Marco Polo\nVCT –  Victoria, TX, USA\nVDA –  Ovda, Israel\nVDS –  Vadso, Norway – Vadso\nVDZ –  Valdez, AK, USA\nVER –  Veracruz, Veracruz, Mexico – Las Bajadas / General Heriberto Jara\nVEY –  Vestmannaeyjar, Iceland – Vestmannaeyjar\nVFA –  Victoria Falls, Zimbabwe\nVGO –  Vigo, Spain\nVGT –  Las Vegas, NV, USA – North Air Terminal\nVIE –  Vienna, Austria – Schwechat\nVIJ –  Virgin Gorda, Virgin Islands (British)\nVIS –  Visalia, CA, USA – Visalia Municipal Airport\nVIT –  Vitoria, Spain – Vitoria\nVIX –  Vitoria, Espirito Santo, Brazil – Eureco Sales\nVKO –  Moscow, Russia – Vnukovo\nVLC –  Valencia, Spain – Valencia\nVLD –  Valdosta, GA, USA – Valdosta Regional\nVLG –  Villa Gesell, Buenos Aires, Argentina – Villa Gesell\nVLI –  Port Vila, Vanuatu – Bauerfield\nVLL –  Valladolid, Spain – Valladolid\nVLN –  Valencia, Venezuela – Valencia\nVNO –  Vilnius, Lithuania – Vilnius Airport\nVNS –  Varanasi, India – Babatpur\nVOG –  Volgograd, Russia – Volgograd\nVPS –  Valparaiso, FL, USA – Fort Walton Beach\nVRA –  Varadero, Cuba – Juan Gualberto Gomez\nVRB –  Vero Beach, FL, USA – Vero Beach Municipal\nVRK – Varkaus, Finland – Varkaus\nVRN –  Verona, Italy – Verona\nVSA –  Villahermosa, Tabasco, Mexico – Carlos R Perez\nVSG –  Lugansk, Ukraine\nVST –  Vasteras, Sweden – Hasslo\nVTE –  Vientiane, Laos – Wattay\nVTZ –  Vishakhapatnam, India – Vishakhapatnam\nVUP –  Valledupar, Colombia\nVVI –  Santa Cruz, Bolivia – Viru Viru International\nVVO –  Vladivostok, Russia – Vladivostok Airport\nVXO –  Vaxjo, Sweden – Vaxjo\nWAT –  Waterford, Ireland\nWAW –  Warsaw, Poland – Okecie\nWBU –  Boulder, CO, USA\nWDG –  Enid, OK, USA – Woodring Municipal\nWDH –  Windhoek, Namibia – Jg Strijdom\nWGA –  Wagga-Wagga, New South Wales, Australia – Forest Hill\nWGE –  Walgett, New South Wales, Australia – Walgett\nWIC –  Wick, Scotland, United Kingdom – Wick\nWIL –  Nairobi, Kenya – Wilson Arpt\nWIN –  Winton, Queensland, Australia – Winton\nWLG –  Wellington, New Zealand – International\nWMH –  Mountain Home, AR, USA\nWNA –  Napakiak, AK, USA – Napakiak\nWRL –  Worland, WY, USA – Worland\nWRO –  Wroclaw, Poland – Strachowice\nXAW – \nCapreol  , Ontario , Canada – Capreol\n/  Via Rail Service Ontario, Canada\nXCI –  Chambord, Quebec, Canada – Chambord / Via Rail Service XCM\n–  Chatham  , Ontario, Canada XDL – \nChandler  ,  Quebec, Canada – Chandler  /  Via Rail Service Columbia, Canada – Langford / Via Rail Service XEK –  Melville, Saskatchewan, Canada – Melville / Via Rail Service XEL  –  New  Carlisle , Quebec ,  Canada – New Carlisle / Via  Rail Service\nXFG –  Perce, Quebec, Canada – Perce / Via Rail Service\nXFL – \nShawinigan  , Quebec, Canada – Shawinigan / Via Rail Service XFM –\nShawnigan \n,  British Columbia, Canada – Shawnigan\n/ \nVia  Rail Service Brantford / Via Rail Service\nXGJ –  Cobourg, Ontario, Canada – Cobourg / Via Rail Service XGK –  Coteau  ,\nQuebec  ,  Canada –  Coteau /  Via Rail Service Ingersoll, Ontario, Canada – Ingersoll / Via Rail Service XID –  Maxville, Ontario, Canada – Maxville / Via Rail Service XIM  – Saint  -  Hyacinthe, Quebec, Canada –  Saint Hyacinthe / Via Rail  Service / Via Rail Service XJQ –  Jonquiere, Quebec, Canada – Jonquiere / Via Rail Service XLV –  Niagara Falls, Ontario, Canada XLZ –  Truro  , Nova Scotia, Canada XMN –  Xiamen  ,  China – Xiamen International  Pointe-Aux-Trembles, Quebec, Canada – Pointe Aux Trembles / Via Rail Service XQP  – Quepos , Costa  Rica  XQU  –  Qualicum , British  Columbia , Canada  Rail Service XWY – Wyoming, Ontario, Canada – Wyoming / Via Rail Service \nXZB \n–  Casselman , Ontario , Canada\n–  Casselman  / Via Rail  Service  –  Campbell River /Campbell Rvr, British Columbia, Canada – Metropolitan Area YBR –  Brandon, Manitoba, Canada YBX –  Blanc Sablon, Quebec, Canada – Blanc Sablon Airport YCA –  Courtenay, British Columbia, Canada YCC –  Cornwall, Ontario, Canada – Regional YCD –  Nanaimo, British Columbia, Canada – Cassidy Airport YCG –  Castlegar, British Columbia, Canada YCM –  St Catharines, Ontario, Canada YCO –  Coppermine, Northwest Territories, Canada YDF –  Deer Lake, Newfoundland, Canada – Deer Lake YDN –  Dauphin, Manitoba, Canada YDQ –  Dawson Creek, British Columbia, Canada YEC –  Yechon, South Korea – Yechon YEG –  Edmonton, Alberta, Canada – Edmonton International YEL –  Elliot Lake, Ontario, Canada YEV –  Inuvik, Northwest Territories, Canada – Inuvik International Arpt YEY –  Amos, Quebec, Canada YFB –  Iqaluit, Northwest Territories, Canada YFC –  Fredericton, New Brunswick, Canada – Fredericton Municipal Apt YFS –  Fort Simpson, Northwest Territories, Canada – Fort Simpson Airport YGB –  Gillies Bay, British Columbia, Canada YGK –  Kingston, Ontario, Canada – Kingston Airport YGP –  Gaspe, Quebec, Canada YGR –  Iles De La Madeleine, Quebec, Canada – House Harbor Airport YGT –  Igloolik, Northwest Territories, Canada YGW –  Kuujjuarapik, Quebec, Canada – Kuujjuarapik YGX –  Gillam, Manitoba, Canada YHB –  Hudson Bay, Saskatchewan, Canada YHD –  Dryden, Ontario, Canada – Dryden Airport YHI –  Holman Island, Northwest Territories, Canada YHM –  Hamilton, Ontario, Canada – Hamilton Civic Airport YHN –  Hornepayne, Ontario, Canada YHY –  Hay River, Northwest Territories, Canada\nYHZ –  Halifax, Nova Scotia, Canada – Halifax International\nYIB –  Atikokan, Ontario, Canada\nYJA –  Jasper, Alberta, Canada\nYJT –  Stephenville, Newfoundland, Canada – Stephenville\nYKA –  Kamloops, British Columbia, Canada – Fulton Field\nYKF –  Kitchener, Ontario, Canada – Kitchener\nYKL –  Schefferville, Quebec, Canada – Schefferville\nYKM –  Yakima, WA, USA – Yakima Air Terminal\nYKQ –  Waskaganish, Quebec, Canada – Waskaganish\nYKS –  Yakutsk, Russia\nYLD –  Chapleau, Ontario, Canada\nYLQ –  La Tuque, Quebec, Canada – La Tuque\nYLW –  Kelowna, British Columbia, Canada – Ellison Field Airport\nYMM –  Fort Mcmurray, Alberta, Canada – Fort Mcmurray Municipal\nYMO –  Moosonee, Ontario, Canada – Moosonee\nYMT –  Chibougamau, Quebec, Canada – Chibougamau\nYMX –  Montreal, Quebec, Canada\nYND –  Gatineau, Quebec, Canada – Gatineau\nYNG –  Youngstown, OH, USA – Youngstown Municipal Airport\nYOJ –  High Level, Alberta, Canada – Footner Lake Muncpl\nYOO –  Oshawa, Ontario, Canada\nYOP –  Rainbow Lake, Alberta, Canada – Rainbow Lake\nYOW –  Ottawa, Ontario, Canada – Ottawa International\nYPE –  Peace River, Alberta, Canada – Peace River\nYPF –  Esquimalt, British Columbia, Canada\nYPR –  Prince Rupert /Princ Rupert, British Columbia, Canada – Digby Island\nYPW –  Powell River, British Columbia, Canada\nYPZ –  Burns Lake, British Columbia, Canada\nYQB –  Quebec, Quebec, Canada – Sainte Foy Airport\nYQC –  Quaqtaq, Quebec, Canada\nYQD –  The Pas, Manitoba, Canada – The Pas\nYQG –  Windsor, Ontario, Canada – Windsor International\nYQH –  Watson Lake, Yukon Territory, Canada – Watson Lake Airport\nYQI –  Yarmouth, Nova Scotia, Canada\nYQK –  Kenora, Ontario, Canada\nYQL –  Lethbridge, Alberta, Canada – Lethbridge Airport\nYQM –  Moncton, New Brunswick, Canada – Lakeburn Municipal Airpt\nYQQ –  Comox, British Columbia, Canada – Comox Civil Air Terminal\nYQR –  Regina, Saskatchewan, Canada – Regina International\nYQT –  Thunder Bay, Ontario, Canada\nYQU –  Grande Prairie, Alberta, Canada – Grande Prairie Airport\nYQX –  Gander, Newfoundland, Canada – Gander Intl Airport\nYQY –  Sydney, Nova Scotia, Canada – Sydney Municipal\nYQZ –  Quesnel, British Columbia, Canada\nYRB –  Resolute, Northwest Territories, Canada – Resolute Bay\nYRL –  Red Lake, Ontario, Canada\nYSB –  Sudbury, Ontario, Canada\nYSF –  Stony Rapids, Saskatchewan, Canada – Stony Rapids\nYSH –  Smith Falls, Ontario, Canada\nYSJ –  Saint John, New Brunswick, Canada – Turnbull Field\nYSL –  St Leonard, New Brunswick, Canada – St Leonard Apt\nYSM –  Fort Smith, Northwest Territories, Canada\nYSN –  Salmon Arm, British Columbia, Canada\nYSP –  Marathon, Ontario, Canada\nYTA –  Pembroke, Ontario, Canada – Pem And Area Apt\nYTD –  Thicket Portage, Manitoba, Canada\nYTH –  Thompson, Manitoba, Canada – Thompson\nYTS –  Timmins, Ontario, Canada – Timmins Municipal Airport\nYTZ –  Toronto, Ontario, Canada\nYUL –  Montreal, Quebec, Canada\nYUM –  Yuma, AZ, USA – Yuma International Airport\nYVA –  Moroni (Hahaya/Iconi)Comoros\nYVB –  Bonaventure, Quebec, Canada\nYVC –  La Ronge, Saskatchewan, Canada – La Ronge\nYVP –  Kuujjuaq, Quebec, Canada – Fort Chimo Airport\nYVR –  Vancouver, British Columbia, Canada – Vancouver International\nYVZ –  Deer Lake, Ontario, Canada\nYWG –  Winnipeg, Manitoba, Canada – Winnipeg International\nYWH –  Victoria, British Columbia, Canada – Victoria Inner Harbor\nYWK –  Wabush, Newfoundland, Canada – Wabush Municipal\nYWL –  Williams Lake, British Columbia, Canada\nYWR –  White River, Ontario, Canada – White River\nYXC –  Cranbrook, British Columbia, Canada – Cranbrook Airport\nYXD –  Edmonton, Alberta, Canada – Edmonton Municipal\nYXE –  Saskatoon, Saskatchewan, Canada – Saskatoon\nYXH –  Medicine Hat, Alberta, Canada – Medicine Hat Airport\nYXJ –  Fort St John, British Columbia, Canada – Fort St John\nYXL –  Sioux Lookout, Ontario, Canada\nYXS –  Prince George, British Columbia, Canada – Prince George BC\nYXT –  Terrace, British Columbia, Canada – Terrace\nYXU –  London, Ontario, Canada – London Municipal\nYXY – Whitehorse, Yukon Territory, Canada – Whitehorse Airport\nYXZ –  Wawa, Ontario, Canada\nYYB –  North Bay, Ontario, Canada – Jack Garland Airport\nYYC –  Calgary, Alberta, Canada – Calgary Intl Airport\nYYD –  Smithers, British Columbia, Canada – Smithers International\nYYF –  Penticton, British Columbia, Canada\nYYG –  Charlottetown, Prince Edward Island/, Canada – Charlottetown\nYYJ –  Victoria, British Columbia, Canada – Victoria Airport\nYYQ –  Churchill, Manitoba, Canada – Churchill Airport\nYYR –  Goose Bay, Newfoundland, Canada – Goose Bay Municipal Airpt\nYYT –  St Johns, Newfoundland, Canada – St John's International\nYYU –  Kapuskasing, Ontario, Canada\nYYY –  Mont Joli, Quebec, Canada\nYYZ –  Toronto, Ontario, Canada – Pearson International Airport\nYZF –  Yellowknife, Northwest Territories, Canada\nYZT –  Port Hardy, British Columbia, Canada – Port Hardy Airport\nYZV –  Sept-Iles, Quebec, Canada\nZAG –  Zagreb, Croatia (Hrvatska) – Zagreb\nZAH –  Zahedan, Iran – Zahedan\nZAL –  Valdivia, Chile – Pichoy\nZAM –  Zamboanga, Philippines – Zamboanga Airport\nZAZ –  Zaragoza, Spain – Zaragoza\nZBV –  Vail/Eagle, CO, USA\nZCL –  Zacatecas, Zacatecas, Mexico\nZCO –  Temuco, Chile – Manquehue\nZDJ –  Berne, Switzerland – Berne-Rr Station\nZGI –  Gods River, Manitoba, Canada\nZHA –  Zhanjiang, China\nZHO –  Houston, British Columbia, Canada\nZIH –  Ixtapa/Zihuatanejo, Guerrero, Mexico – International\nZLO –  Manzanillo, Colima, Mexico – International Airport\nZNA –  Nanaimo, British Columbia, Canada\nZNE –  Newman, Western Australia, Australia – Newman\nZNZ –  Zanzibar, Tanzania – Kisauni\nZQN –  Queenstown, New Zealand – Frankton\nZRF –  Rockford, IL, USA\nZRH –  Zurich, Switzerland – Zurich\nZSA –  San Salvador, Bahamas\nZTH –  Zakinthos, Greece – Zakinthos\n`;\n\n// Function to convert input string to array of objects\nfunction parseAirportDataToArray(input) {\n  const lines = input.trim().split('\\n');\n  const result = [];\n\n  lines.forEach(line => {\n    const parts = line.split('–').map(part => part.trim());\n\n    if (parts.length >= 2) {\n      result.push({\n        code: parts[0],\n        location: parts[1],\n        airport: parts[2] || \"\"\n      });\n    }\n  });\n\n  return result;\n}\n\n// Execute the function\nreturn {\n    \"IATA\": parseAirportDataToArray(input)\n};\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1776,
        -336
      ],
      "id": "101959bc-d25c-431b-90f2-4f58991b1203",
      "name": "IATA",
      "executeOnce": true
    },
    {
      "parameters": {
        "aggregate": "aggregateAllItemData",
        "destinationFieldName": "Flights",
        "options": {}
      },
      "type": "n8n-nodes-base.aggregate",
      "typeVersion": 1,
      "position": [
        2224,
        -336
      ],
      "id": "b6e0993f-7ba1-4212-81d1-74c8ab628679",
      "name": "Aggregate"
    },
    {
      "parameters": {
        "content": "Divide el arreglo de vuelos en elementos individuales para su procesamiento.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1296,
        -480
      ],
      "typeVersion": 1,
      "id": "5055592a-bb05-4bb3-aa8a-a489334cb5f9",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "content": "Códigos de aeropuertos IATA estáticos para el mapeo de ciudad a código.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1520,
        -480
      ],
      "typeVersion": 1,
      "id": "c4fc811a-2db1-4f95-bfd8-20b3addaa053",
      "name": "Sticky Note8"
    },
    {
      "parameters": {
        "content": "Transforma los datos de vuelo a un formato amigable para el usuario con nombres de ciudad y horarios.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1744,
        -480
      ],
      "typeVersion": 1,
      "id": "af3eea61-d3e4-46aa-b289-5ea565f0c7ac",
      "name": "Sticky Note9"
    },
    {
      "parameters": {
        "content": "Combina todos los vuelos procesados en la respuesta final agregada.\n\n\n\n\n\n\n\n\n\nAsk ChatGPT\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1968,
        -480
      ],
      "typeVersion": 1,
      "id": "fdf724ed-90f3-4e6c-8f40-46c80f1bdb62",
      "name": "Sticky Note10"
    },
    {
      "parameters": {
        "jsCode": "// Input: $json contains an array of fare objects\n// Params: departureRange and arrivalRange are in \"HH,HH\" format (e.g. \"6,16\")\n\nconst fares = $input.first().json.Fares || [];  // Replace with actual key if different\nreturn fares\nconst departureRangeRaw = $('Trigger').first().json.BookingData?.json?.Departure_Time_Range || \"\"; // Optional: e.g. \"6,16\"\nconst arrivalRangeRaw   = $('Trigger').first().json.BookingData?.json?.Return_Time_Range     || \"\"; // Optional: e.g. \"10,22\"\n\n// Validate and parse \"HH,HH\" where both are integers 0–23 and start <= end\nfunction parseHourRange(rangeStr) {\n  if (typeof rangeStr !== \"string\" || !rangeStr.includes(\",\")) return null;\n  const [startStr, endStr] = rangeStr.split(\",\");\n  const start = Number(startStr);\n  const end = Number(endStr);\n  const isInt = (n) => Number.isInteger(n);\n  if (!isInt(start) || !isInt(end)) return null;\n  if (start < 0 || start > 23 || end < 0 || end > 23) return null;\n  if (start > end) return null; // simple non-overnight window\n  return [start, end];\n}\n\nconst departureRange = parseHourRange(departureRangeRaw); // either [start,end] or null\nconst arrivalRange   = parseHourRange(arrivalRangeRaw);   // either [start,end] or null\n\n// If neither range is available/valid, return the original fares unchanged\nif (!departureRange && !arrivalRange) {\n  return [{ json: { filteredFares: fares } }];\n}\n\nfunction hourFromTimeString(timeStr) {\n  // expects \"HH:mm\" or \"HH:mm:ss\" etc.\n  if (typeof timeStr !== \"string\") return NaN;\n  const hh = timeStr.split(\":\")[0];\n  return parseInt(hh, 10);\n}\n\nfunction isWithinRange(hour, rangeTuple) {\n  if (!rangeTuple) return true; // if a specific range isn't provided, don't filter on it\n  const [start, end] = rangeTuple;\n  return hour >= start && hour <= end;\n}\n\nfunction filterFareByTimeWindows(fare, depRange, arrRange) {\n  const filteredLegs = (fare.Legs || []).map(leg => {\n    const filteredOptions = (leg.Options || []).filter(option =>\n      (option.Segments || []).every(segment => {\n        const depHour = hourFromTimeString(segment?.Departure?.Time);\n        const arrHour = hourFromTimeString(segment?.Arrival?.Time);\n        if (Number.isNaN(depHour) || Number.isNaN(arrHour)) return false; // drop malformed times\n        const depOk = isWithinRange(depHour, depRange);\n        const arrOk = isWithinRange(arrHour, arrRange);\n        return depOk && arrOk;\n      })\n    );\n\n    return filteredOptions.length > 0 ? { ...leg, Options: filteredOptions } : null;\n  }).filter(Boolean);\n\n  return filteredLegs.length > 0 ? { ...fare, Legs: filteredLegs } : null;\n}\n\n// Apply filters only for the ranges that are valid/present\nconst filteredFares = fares\n  .map(f => filterFareByTimeWindows(f, departureRange, arrivalRange))\n  .filter(f => f !== null);\n\n// Return result\nreturn [{ json: { filteredFares } }];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1104,
        -336
      ],
      "id": "3891c907-ad42-4f36-97d5-7df34da1906f",
      "name": "Code1"
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Get Token",
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
            "node": "Input",
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
    "API call": {
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
    "Input": {
      "main": [
        [
          {
            "node": "API call",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Token": {
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
    "Flights": {
      "main": [
        [
          {
            "node": "Split Out",
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
            "node": "Aggregate",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split Out": {
      "main": [
        [
          {
            "node": "IATA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IATA": {
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
    "Code1": {
      "main": [
        [
          {
            "node": "Flights",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "Trigger": [
      {
        "BookingData": {
          "json": {
            "Name": "Tomas",
            "Phone": 5492954602920,
            "Contact_Id": 5492954602920,
            "Time_Stamp": "2025-09-02 11:55",
            "Travel_Type": "Vuelo",
            "Origin": "EZE",
            "Flight_Destination": "GIG",
            "Departure_date": "2025-11-20",
            "Return_date": "2025-11-28",
            "Num_Adults": 2,
            "Num_Children": "",
            "Childrens_Ages": "",
            "Stopovers": "",
            "Luggage": true,
            "Airlines": "",
            "Departure_Time_Range": "",
            "Return_Time_Range": "",
            "Travel_Assistance": "",
            "Transfers": "",
            "Layover_Hours": "",
            "Max_Layover_Hours": 3,
            "Min_Layover_Hours": ""
          },
          "pairedItem": {
            "item": 0
          }
        }
      }
    ],
    "IATA": [
      {
        "IATA": [
          {
            "code": "AAE",
            "location": "Annaba, Algeria",
            "airport": "Les Salines"
          },
          {
            "code": "AAL",
            "location": "Aalborg, Denmark",
            "airport": "Aalborg"
          },
          {
            "code": "AAR",
            "location": "Aarhus, Denmark",
            "airport": "Tirstrup"
          },
          {
            "code": "ABE",
            "location": "Allentown, PA, USA",
            "airport": "Allentown-Bethlehem-Easton Airport"
          },
          {
            "code": "ABI",
            "location": "Abilene, TX, USA",
            "airport": "Municipal"
          },
          {
            "code": "ABJ",
            "location": "Abidjan, Cote D'ivoire",
            "airport": "Port Bouet"
          },
          {
            "code": "ABL",
            "location": "Ambler, AK, USA",
            "airport": ""
          },
          {
            "code": "ABM",
            "location": "Bamaga, Queensland, Australia",
            "airport": ""
          },
          {
            "code": "ABQ",
            "location": "Albuquerque, NM, USA",
            "airport": "Albuquerque International Airport"
          },
          {
            "code": "ABR",
            "location": "Aberdeen, SD, USA",
            "airport": "Aberdeen Regional Airport"
          },
          {
            "code": "ABS",
            "location": "Abu Simbel, Egypt",
            "airport": "Abu Simbel"
          },
          {
            "code": "ABX",
            "location": "Albury, New South Wales, Australia",
            "airport": "Albury"
          },
          {
            "code": "ABY",
            "location": "Albany, GA, USA",
            "airport": "Dougherty County"
          },
          {
            "code": "ABZ",
            "location": "Aberdeen, Scotland, United Kingdom",
            "airport": "Dyce"
          },
          {
            "code": "ACA",
            "location": "Acapulco, Guerrero, Mexico",
            "airport": "Alvarez International"
          },
          {
            "code": "ACC",
            "location": "Accra, Ghana",
            "airport": "Kotoka"
          },
          {
            "code": "ACE",
            "location": "Lanzarote, Canary Islands, Spain",
            "airport": "Lanzarote"
          },
          {
            "code": "ACI",
            "location": "Alderney, Channel Islands, United Kingdom",
            "airport": "The Blaye"
          },
          {
            "code": "ACK",
            "location": "Nantucket, MA, USA",
            "airport": ""
          },
          {
            "code": "ACT",
            "location": "Waco, TX, USA",
            "airport": "Madison Cooper"
          },
          {
            "code": "ACV",
            "location": "Arcata, CA, USA",
            "airport": "Arcata/Eureka Airport"
          },
          {
            "code": "ACY",
            "location": "Atlantic City /Atlantic Cty, NJ, USA",
            "airport": "Atlantic City International"
          },
          {
            "code": "ADA",
            "location": "Adana, Turkey",
            "airport": "Adana"
          },
          {
            "code": "ADB",
            "location": "Izmir, Turkey",
            "airport": "Adnam Menderes"
          },
          {
            "code": "ADD",
            "location": "Addis Ababa, Ethiopia",
            "airport": "Bole"
          },
          {
            "code": "ADJ",
            "location": "Amman, Jordan",
            "airport": "Civil"
          },
          {
            "code": "ADL",
            "location": "Adelaide, South Australia, Australia",
            "airport": "Adelaide"
          },
          {
            "code": "ADQ",
            "location": "Kodiak, AK, USA",
            "airport": ""
          },
          {
            "code": "ADZ",
            "location": "San Andres Island, Colombia",
            "airport": ""
          },
          {
            "code": "AEP",
            "location": "Buenos Aires, Buenos Aires, Argentina",
            "airport": "Jorge Newbery"
          },
          {
            "code": "AES",
            "location": "Aalesund, Norway",
            "airport": "Vigra"
          },
          {
            "code": "AET",
            "location": "Allakaket, AK, USA",
            "airport": ""
          },
          {
            "code": "AEX",
            "location": "Alexandria, LA, USA",
            "airport": "Alexandria Intl Airport"
          },
          {
            "code": "AEY",
            "location": "Akureyri, Iceland",
            "airport": "Akureyri"
          },
          {
            "code": "AGA",
            "location": "Agadir, Morocco",
            "airport": "Inezgane"
          },
          {
            "code": "AGB",
            "location": "Augsburg, Germany",
            "airport": "Muehlhausen"
          },
          {
            "code": "AGF",
            "location": "Agen, France",
            "airport": "La Garenne"
          },
          {
            "code": "AGH",
            "location": "Helsingborg, Sweden",
            "airport": "Angelholm/Helsingborg"
          },
          {
            "code": "AGP",
            "location": "Malaga, Spain",
            "airport": "Malaga"
          },
          {
            "code": "AGR",
            "location": "Agra, India",
            "airport": "Kheria"
          },
          {
            "code": "AGS",
            "location": "Augusta, GA, USA",
            "airport": "Bush Field"
          },
          {
            "code": "AGU",
            "location": "Aguascalientes, Aguascalientes, Mexico",
            "airport": ""
          },
          {
            "code": "AHN",
            "location": "Athens, GA, USA",
            "airport": ""
          },
          {
            "code": "AHO",
            "location": "Alghero, Sardinia, Italy",
            "airport": "Fertilia"
          },
          {
            "code": "AIA",
            "location": "Alliance, NE, USA",
            "airport": ""
          },
          {
            "code": "AIN",
            "location": "Wainwright, AK, USA",
            "airport": ""
          },
          {
            "code": "AJN",
            "location": "Anjouan, Comoros",
            "airport": ""
          },
          {
            "code": "AJA",
            "location": "Ajaccio, Corsica, France",
            "airport": "Campo Dell Oro"
          },
          {
            "code": "AJU",
            "location": "Aracaju, Sergipe, Brazil",
            "airport": ""
          },
          {
            "code": "AKJ",
            "location": "Asahikawa, Japan",
            "airport": "Asahikawa"
          },
          {
            "code": "AKL",
            "location": "Auckland, New Zealand",
            "airport": "Auckland International Airport"
          },
          {
            "code": "ALA",
            "location": "Almaty, Kazakhstan",
            "airport": "Almaty"
          },
          {
            "code": "ALB",
            "location": "Albany, NY, USA",
            "airport": "Albany County Airport"
          },
          {
            "code": "ALC",
            "location": "Alicante, Spain",
            "airport": "Alicante"
          },
          {
            "code": "ALE",
            "location": "Alpine, TX, USA",
            "airport": "Alpine Texas"
          },
          {
            "code": "ALF",
            "location": "Alta, Norway",
            "airport": "Elvebakken"
          },
          {
            "code": "ALG",
            "location": "Algiers, Algeria",
            "airport": "Houari Boumedienne"
          },
          {
            "code": "ALM",
            "location": "Alamogordo, NM, USA",
            "airport": ""
          },
          {
            "code": "ALO",
            "location": "Waterloo, IA, USA",
            "airport": "Waterloo Municipal Airport"
          },
          {
            "code": "ALP",
            "location": "Aleppo, Syria",
            "airport": "Nejrab"
          },
          {
            "code": "ALS",
            "location": "Alamosa, CO, USA",
            "airport": "Bergman Field"
          },
          {
            "code": "ALW",
            "location": "Walla Walla, WA, USA",
            "airport": ""
          },
          {
            "code": "ALY",
            "location": "Alexandria, Egypt",
            "airport": "Alexandria"
          },
          {
            "code": "AMA",
            "location": "Amarillo, TX, USA",
            "airport": "Amarillo International Airport"
          },
          {
            "code": "AMD",
            "location": "Ahmedabad, India",
            "airport": "Ahmedabad"
          },
          {
            "code": "AMI",
            "location": "Mataram, Indonesia",
            "airport": "Selaparang"
          },
          {
            "code": "AMM",
            "location": "Amman, Jordan",
            "airport": "Queen Alia International"
          },
          {
            "code": "AMQ",
            "location": "Ambon, Indonesia",
            "airport": "Pattimura"
          },
          {
            "code": "AMS",
            "location": "Amsterdam, Netherlands",
            "airport": "Schiphol"
          },
          {
            "code": "ANB",
            "location": "Anniston, AL, USA",
            "airport": "Municipal"
          },
          {
            "code": "ANC",
            "location": "Anchorage, AK, USA",
            "airport": "Anchorage International"
          },
          {
            "code": "ANF",
            "location": "Antofagasta, Chile",
            "airport": "Cerro Moreno"
          },
          {
            "code": "ANG",
            "location": "Angouleme, France",
            "airport": "Gel-Air"
          },
          {
            "code": "ANI",
            "location": "Aniak, AK, USA",
            "airport": ""
          },
          {
            "code": "ANR",
            "location": "Antwerp, Belgium",
            "airport": "Deurne"
          },
          {
            "code": "ANU",
            "location": "Saint Johns / Antigua, Antigua And Barbuda",
            "airport": "Vc Bird International"
          },
          {
            "code": "ANV",
            "location": "Anvik, AK, USA",
            "airport": ""
          },
          {
            "code": "AOI",
            "location": "Ancona, Italy",
            "airport": "Falconara"
          },
          {
            "code": "AOJ",
            "location": "Aomori, Japan",
            "airport": ""
          },
          {
            "code": "AOK",
            "location": "Karpathos, Greece",
            "airport": "Karpathos"
          },
          {
            "code": "AOO",
            "location": "Altoona / Martinsburg, PA, USA",
            "airport": "Blair County"
          },
          {
            "code": "AOR",
            "location": "Alor Setar, Malaysia",
            "airport": "Sultan Abdul Halim"
          },
          {
            "code": "APF",
            "location": "Naples, FL, USA",
            "airport": ""
          },
          {
            "code": "APL",
            "location": "NampulaMozambique",
            "airport": ""
          },
          {
            "code": "APN",
            "location": "Alpena, MI, USA",
            "airport": "Alpena Regional Airport"
          },
          {
            "code": "APW",
            "location": "Apia, Samoa",
            "airport": "Faleolo"
          },
          {
            "code": "AQJ",
            "location": "Aqaba, Jordan",
            "airport": "Aqaba"
          },
          {
            "code": "AQP",
            "location": "Arequipa, Peru",
            "airport": "Rodriguez Ballon"
          },
          {
            "code": "ARH",
            "location": "Arkhangelsk, Russia",
            "airport": "Arkhangelsk"
          },
          {
            "code": "ARI",
            "location": "Arica, Chile",
            "airport": "Chacalluta"
          },
          {
            "code": "ARM",
            "location": "Armidale, New South Wales, Australia",
            "airport": "Armidale"
          },
          {
            "code": "ARN",
            "location": "Stockholm, Sweden",
            "airport": "Arlanda International"
          },
          {
            "code": "ART",
            "location": "Watertown, NY, USA",
            "airport": "Watertown"
          },
          {
            "code": "ASD",
            "location": "Andros Town, Bahamas",
            "airport": ""
          },
          {
            "code": "ASE",
            "location": "Aspen, CO, USA",
            "airport": "Pitkin County Airport Sardy Field"
          },
          {
            "code": "ASM",
            "location": "Asmara, Eritrea",
            "airport": "Asmara Intl/Yohannes Iv"
          },
          {
            "code": "ASP",
            "location": "Alice Springs, Northern Territory, Australia",
            "airport": "Alice Springs"
          },
          {
            "code": "ASU",
            "location": "Asuncion, Paraguay",
            "airport": "Silvio Pettirossi"
          },
          {
            "code": "ASW",
            "location": "Aswan, Egypt",
            "airport": "Daraw"
          },
          {
            "code": "ATC",
            "location": "Arthurs Town, Bahamas",
            "airport": ""
          },
          {
            "code": "ATH",
            "location": "Athens, Greece",
            "airport": "Hellinikon"
          },
          {
            "code": "ATL",
            "location": "Atlanta, GA, USA",
            "airport": "Hartsfield International"
          },
          {
            "code": "ATW",
            "location": "Appleton, WI, USA",
            "airport": "Outagamie County Airport"
          },
          {
            "code": "ATY",
            "location": "Watertown, SD, USA",
            "airport": ""
          },
          {
            "code": "AUA",
            "location": "Aruba, Aruba",
            "airport": "Reina Beatrix"
          },
          {
            "code": "AUC",
            "location": "Arauca, Colombia",
            "airport": ""
          },
          {
            "code": "AUG",
            "location": "Augusta, ME, USA",
            "airport": "Maine State"
          },
          {
            "code": "AUH",
            "location": "Abu Dhabi, United Arab Emirates",
            "airport": "Abu Dhabi International"
          },
          {
            "code": "AUS",
            "location": "Austin, TX, USA",
            "airport": "Robert Mueller Municipal Airport"
          },
          {
            "code": "AVL",
            "location": "Asheville / Hendersonville, NC, USA",
            "airport": "Asheville Regional Airport"
          },
          {
            "code": "AVN",
            "location": "Avignon, France",
            "airport": "Caumont"
          },
          {
            "code": "AVP",
            "location": "Wilkes Barre/Scranton, PA, USA",
            "airport": "Wilkes-Barre/Scranton Intl"
          },
          {
            "code": "AXA",
            "location": "Anguilla, Anguilla",
            "airport": ""
          },
          {
            "code": "AXD",
            "location": "Alexandroupolis, Greece",
            "airport": "Alexandroupolis"
          },
          {
            "code": "AYQ",
            "location": "Ayers Rock, Northern Territory, Australia",
            "airport": "Connellan"
          },
          {
            "code": "AYT",
            "location": "Antalya, Turkey",
            "airport": "Antalya"
          },
          {
            "code": "AZO",
            "location": "Kalamazoo, MI, USA",
            "airport": "Kalamazoo/Battle Creek Intl"
          },
          {
            "code": "BAH",
            "location": "Bahrain, Bahrain",
            "airport": "Bahrain International Bahrain"
          },
          {
            "code": "BAK",
            "location": "Baku, Azerbaijan",
            "airport": "Baku"
          },
          {
            "code": "BAL",
            "location": "Batman, Turkey",
            "airport": "Nearest Air Service Through Diyarbakir"
          },
          {
            "code": "BAQ",
            "location": "Barranquilla, Colombia",
            "airport": "E Cortissoz"
          },
          {
            "code": "BAX",
            "location": "Barnaul, Russia",
            "airport": "Barnaul Airport"
          },
          {
            "code": "BBI",
            "location": "Bhubaneswar, India",
            "airport": "Bhubaneswar"
          },
          {
            "code": "BBK",
            "location": "Kasane, Botswana",
            "airport": "Kasane"
          },
          {
            "code": "BBU",
            "location": "Bucharest, Romania",
            "airport": "Baneasa"
          },
          {
            "code": "BCD",
            "location": "Bacolod, Philippines",
            "airport": "Bacolod"
          },
          {
            "code": "BCN",
            "location": "Barcelona, Spain",
            "airport": "Barcelona"
          },
          {
            "code": "BDA",
            "location": "Bermuda/Hamilton, Bermuda",
            "airport": "Kindley Airfield/Civil Air"
          },
          {
            "code": "BDJ  Terminal",
            "location": "Banjarmasin, Indonesia",
            "airport": "Syamsudin Noor"
          },
          {
            "code": "BDL",
            "location": "Hartford, CT, USA",
            "airport": "Bradley International Airport"
          },
          {
            "code": "BDO",
            "location": "Bandung, Indonesia",
            "airport": "Husein Sastranegara"
          },
          {
            "code": "BDQ",
            "location": "Vadodara, India",
            "airport": "Vadodara"
          },
          {
            "code": "BDR",
            "location": "Bridgeport, CT, USA",
            "airport": "Sikorsky Memorial"
          },
          {
            "code": "BED",
            "location": "Bedford, MA, USA",
            "airport": "Bedford"
          },
          {
            "code": "BEG",
            "location": "Belgrade, Yugoslavia",
            "airport": "Belgrade-Beograd"
          },
          {
            "code": "BEH",
            "location": "Benton Harbor, MI, USA",
            "airport": "Ross Field"
          },
          {
            "code": "EIB",
            "location": "Beica, Ethiopia",
            "airport": "Beica"
          },
          {
            "code": "BEL",
            "location": "Belem, Para, Brazil",
            "airport": "Val De Cans"
          },
          {
            "code": "BEO",
            "location": "Newcastle, New South Wales, Australia",
            "airport": "Belmont"
          },
          {
            "code": "BER",
            "location": "Berlin, Germany",
            "airport": "Schoenefeld"
          },
          {
            "code": "BES",
            "location": "Brest, France",
            "airport": "Guipavas"
          },
          {
            "code": "BET",
            "location": "Bethel, AK, USA",
            "airport": "Bethel"
          },
          {
            "code": "BEW",
            "location": "Beira, Mozambique",
            "airport": "Beira"
          },
          {
            "code": "BEY",
            "location": "Beirut, Lebanon",
            "airport": "International"
          },
          {
            "code": "BFD",
            "location": "Bradford, PA, USA",
            "airport": "Bradford Regional"
          },
          {
            "code": "BFF",
            "location": "Scottsbluff, NE, USA",
            "airport": "William B Heiling Field"
          },
          {
            "code": "BFL",
            "location": "Bakersfield, CA, USA",
            "airport": "Meadows Field"
          },
          {
            "code": "BFN",
            "location": "Bloemfontein, South Africa",
            "airport": "Jbm Hertzog"
          },
          {
            "code": "BFS",
            "location": "Belfast, Northern Ireland, United Kingdom",
            "airport": "Belfast International"
          },
          {
            "code": "BGA",
            "location": "Bucaramanga, Colombia",
            "airport": "Palo Negro"
          },
          {
            "code": "BGF",
            "location": "Bangui, Central African Republic",
            "airport": "Bangui"
          },
          {
            "code": "BGI",
            "location": "Bridgetown, Barbados",
            "airport": "Grantley Adams International"
          },
          {
            "code": "BGK",
            "location": "Big Creek, Belize",
            "airport": "Big Creek"
          },
          {
            "code": "BGM",
            "location": "Binghamton/Endicott/Johnson City, NY, USA",
            "airport": "Edwin Alink Field"
          },
          {
            "code": "BGO",
            "location": "Bergen, Norway",
            "airport": "Flesland"
          },
          {
            "code": "BGR",
            "location": "Bangor, ME, USA",
            "airport": "Bangor International Airport"
          },
          {
            "code": "BGY",
            "location": "Milan, Italy",
            "airport": "Orio Al Serio"
          },
          {
            "code": "BHB",
            "location": "Bar Harbor, ME, USA",
            "airport": ""
          },
          {
            "code": "BHD",
            "location": "Belfast, Northern Ireland, United Kingdom",
            "airport": "Belfast Harbor"
          },
          {
            "code": "BHI",
            "location": "Bahia Blanca, Buenos Aires, Argentina",
            "airport": "Commandante"
          },
          {
            "code": "BHK",
            "location": "Bukhara, Uzbekistan",
            "airport": ""
          },
          {
            "code": "BHM",
            "location": "Birmingham, AL, USA",
            "airport": "Seibels/Bryan Airport"
          },
          {
            "code": "BHQ",
            "location": "Broken Hill, New South Wales, Australia",
            "airport": "Broken Hill"
          },
          {
            "code": "BHS",
            "location": "Bathurst, New South Wales, Australia",
            "airport": "Raglan"
          },
          {
            "code": "BHX",
            "location": "Birmingham, England, United Kingdom",
            "airport": "International"
          },
          {
            "code": "BIA",
            "location": "Bastia, Corsica, France",
            "airport": "Poretta"
          },
          {
            "code": "BIK",
            "location": "Biak, Indonesia",
            "airport": "Mokmer"
          },
          {
            "code": "BIL",
            "location": "Billings, MT, USA",
            "airport": "Billings Logan Intnl Airport"
          },
          {
            "code": "BIM",
            "location": "Bimini, Bahamas",
            "airport": "Bimini Island International"
          },
          {
            "code": "BIO",
            "location": "Bilbao, Spain",
            "airport": "Sondica"
          },
          {
            "code": "BIQ",
            "location": "Biarritz, France",
            "airport": "Parme"
          },
          {
            "code": "BIS",
            "location": "Bismarck, ND, USA",
            "airport": "Bismarck Mannan Municipal"
          },
          {
            "code": "BJI",
            "location": "Bemidji, MN, USA",
            "airport": "Bemidji Municipal Airport"
          },
          {
            "code": "BJL",
            "location": "Banjul, Gambia",
            "airport": "Yundum International"
          },
          {
            "code": "BJX",
            "location": "Leon/Guanajuato, Guanajuato, Mexico",
            "airport": "Del Bajio"
          },
          {
            "code": "BKI",
            "location": "Kota Kinabalu, Sabah, Malaysia",
            "airport": "Kota Kinabalu"
          },
          {
            "code": "BKK",
            "location": "Bangkok, Thailand",
            "airport": "Bangkok International Airport"
          },
          {
            "code": "BKO",
            "location": "Bamako, Mali",
            "airport": "Senou"
          },
          {
            "code": "BKW",
            "location": "Beckley, WV, USA",
            "airport": ""
          },
          {
            "code": "BKX",
            "location": "Brookings, SD, USA",
            "airport": "Brookings Municipal Airport"
          },
          {
            "code": "BLA",
            "location": "Barcelona, Venezuela",
            "airport": "General Jose Antonio Anzoategui"
          },
          {
            "code": "BLF",
            "location": "Bluefield, WV, USA",
            "airport": ""
          },
          {
            "code": "BLI",
            "location": "Bellingham, WA, USA",
            "airport": "Bellingham International"
          },
          {
            "code": "BLK",
            "location": "Blackpool, England, United Kingdom",
            "airport": "Blackpool"
          },
          {
            "code": "BLL",
            "location": "Billund, Denmark",
            "airport": "Billund"
          },
          {
            "code": "BLQ",
            "location": "Bologna, Italy",
            "airport": "Guglielmo Marconi"
          },
          {
            "code": "BLR",
            "location": "Bangalore, India",
            "airport": "Hindustan"
          },
          {
            "code": "BLZ",
            "location": "Blantyre, Malawi",
            "airport": "Chileka"
          },
          {
            "code": "BMA",
            "location": "Stockholm, Sweden",
            "airport": "Bromma Arpt"
          },
          {
            "code": "BMG",
            "location": "Bloomington, IN, USA",
            "airport": "Monroe County Airport"
          },
          {
            "code": "BMI",
            "location": "Bloomington, IL, USA",
            "airport": "Normal"
          },
          {
            "code": "BNA",
            "location": "Nashville, TN, USA",
            "airport": "Nashville Metropolitan Airport"
          },
          {
            "code": "BNE",
            "location": "Brisbane, Queensland, Australia",
            "airport": "Brisbane International Airport"
          },
          {
            "code": "BNJ",
            "location": "Bonn, Germany",
            "airport": "Train Main Railroad Station"
          },
          {
            "code": "BNN",
            "location": "Bronnoysund, Norway",
            "airport": "Bronnoy"
          },
          {
            "code": "BNS",
            "location": "Barinas, Venezuela",
            "airport": "Barinas"
          },
          {
            "code": "BOD",
            "location": "Bordeaux, France",
            "airport": "Merignac"
          },
          {
            "code": "BOG",
            "location": "Bogota, Colombia",
            "airport": "Eldorado"
          },
          {
            "code": "BOI",
            "location": "Boise, ID, USA",
            "airport": "Boise Municipal Arpt (Gowen Field)"
          },
          {
            "code": "BOM",
            "location": "Bombay, India",
            "airport": "Bombay"
          },
          {
            "code": "BON",
            "location": "Bonaire, Netherlands Antilles",
            "airport": "Flamingo Field"
          },
          {
            "code": "BOO",
            "location": "Bodo, Norway",
            "airport": "Bodo"
          },
          {
            "code": "BOS",
            "location": "Boston, MA, USA",
            "airport": "Logan International Airport"
          },
          {
            "code": "BPS",
            "location": "Porto Seguro, Bahia, Brazil",
            "airport": "Porto Seguro"
          },
          {
            "code": "BPT",
            "location": "Beaumont, TX, USA",
            "airport": "Jefferson County"
          },
          {
            "code": "BQK",
            "location": "Brunswick, GA, USA",
            "airport": "Glynco Jetport"
          },
          {
            "code": "BQN",
            "location": "Aguadilla, PR, USA",
            "airport": ""
          },
          {
            "code": "BRC",
            "location": "San Carlos De Bariloche, Rio Negro, Argentina",
            "airport": "International"
          },
          {
            "code": "BRD",
            "location": "Brainerd, MN, USA",
            "airport": ""
          },
          {
            "code": "BRE",
            "location": "Bremen, Germany",
            "airport": "Bremen"
          },
          {
            "code": "BRI",
            "location": "Bari, Italy",
            "airport": ""
          },
          {
            "code": "BRL",
            "location": "Burlington, IA, USA",
            "airport": "Burlington Municipal Airport"
          },
          {
            "code": "BRM",
            "location": "Barquisimeto, Venezuela",
            "airport": "Barquisimeto"
          },
          {
            "code": "BRN",
            "location": "Berne, Switzerland",
            "airport": "Belp"
          },
          {
            "code": "BRO",
            "location": "Brownsville, TX, USA",
            "airport": "South Padre Island Intl"
          },
          {
            "code": "BRQ",
            "location": "Brno, Czech Republic",
            "airport": "Turany"
          },
          {
            "code": "BRR",
            "location": "Barra / Hebrides Islands, Scotland, United Kingdom",
            "airport": "North Bay"
          },
          {
            "code": "BRS",
            "location": "Bristol, England, United Kingdom",
            "airport": "Bristol"
          },
          {
            "code": "BRT",
            "location": "Bathurst Island, Northern Territory, Australia",
            "airport": ""
          },
          {
            "code": "BRU",
            "location": "Brussels, Belgium",
            "airport": "National"
          },
          {
            "code": "BRW",
            "location": "Barrow, AK, USA",
            "airport": "Barrow"
          },
          {
            "code": "BSB",
            "location": "Brasilia, Distrito Federal, Brazil",
            "airport": "International"
          },
          {
            "code": "BSK",
            "location": "Biskra, Algeria",
            "airport": "Biskra"
          },
          {
            "code": "BSL",
            "location": "Basel, Switzerland",
            "airport": "Basel"
          },
          {
            "code": "BTM",
            "location": "Butte, MT, USA",
            "airport": ""
          },
          {
            "code": "BTS",
            "location": "Bratislava, Slovakia",
            "airport": "Ivanka"
          },
          {
            "code": "BTU",
            "location": "Bintulu, Sarawak, Malaysia",
            "airport": "Bintulu"
          },
          {
            "code": "BTV",
            "location": "Burlington, VT, USA",
            "airport": "Burlington International Airport"
          },
          {
            "code": "BUD",
            "location": "Budapest, Hungary",
            "airport": "Ferihegy"
          },
          {
            "code": "BUF",
            "location": "Buffalo, NY, USA",
            "airport": "Greater Buffalo Intl Airport"
          },
          {
            "code": "BUQ",
            "location": "Bulawayo, Zimbabwe",
            "airport": "Bulawayo"
          },
          {
            "code": "BUR",
            "location": "Burbank, CA, USA",
            "airport": "Burbank Glendale Pasadena Airport"
          },
          {
            "code": "BUZ",
            "location": "Bushehr, Iran",
            "airport": "Bushehr"
          },
          {
            "code": "BVB",
            "location": "Boa Vista, Roraima, Brazil",
            "airport": ""
          },
          {
            "code": "BVE",
            "location": "Brive-La-Gaillarde, France",
            "airport": "Laroche"
          },
          {
            "code": "BVI",
            "location": "Birdsville, Queensland, Australia",
            "airport": "Birdsville"
          },
          {
            "code": "BWA",
            "location": "Bhairawa, Nepal",
            "airport": "Bhairawa"
          },
          {
            "code": "BWI",
            "location": "Baltimore, MD, USA",
            "airport": "Baltimore-Washington International"
          },
          {
            "code": "BWN",
            "location": "Bandar Seri Begawan, Brunei Darussalam",
            "airport": "Brunei International"
          },
          {
            "code": "BXN",
            "location": "Bodrum, Turkey",
            "airport": "Imsik Airport"
          },
          {
            "code": "BXU",
            "location": "Butuan, Philippines",
            "airport": "Butuan"
          },
          {
            "code": "BYU",
            "location": "Bayreuth, Germany",
            "airport": "Bindlacher Berg"
          },
          {
            "code": "BZE",
            "location": "Belize City, Belize",
            "airport": "Belize International"
          },
          {
            "code": "BZN",
            "location": "Bozeman, MT, USA",
            "airport": "Gallatin Field"
          },
          {
            "code": "BZR",
            "location": "Beziers, France",
            "airport": "Beziers-Vias"
          },
          {
            "code": "CAE",
            "location": "Columbia, SC, USA",
            "airport": "Columbia Sc Airport Metropolitan"
          },
          {
            "code": "CAG",
            "location": "Cagliari, Sardinia, Italy",
            "airport": "Elmas"
          },
          {
            "code": "CAI",
            "location": "Cairo, Egypt",
            "airport": "International"
          },
          {
            "code": "CAJ",
            "location": "Canaima, Venezuela",
            "airport": ""
          },
          {
            "code": "CAK",
            "location": "Akron/Canton, OH, USA",
            "airport": "Akron-Canton Regional Airport"
          },
          {
            "code": "CAN",
            "location": "Guangzhou, China",
            "airport": "Baiyun"
          },
          {
            "code": "CAS",
            "location": "Casablanca, Morocco",
            "airport": "Anfa"
          },
          {
            "code": "CAY",
            "location": "Cayenne, French Guiana",
            "airport": "Rochambeau"
          },
          {
            "code": "CBB",
            "location": "Cochabamba, Bolivia",
            "airport": "San Jose De La Banda"
          },
          {
            "code": "CBE",
            "location": "Cumberland, MD, USA",
            "airport": "Municipal"
          },
          {
            "code": "CBG",
            "location": "Cambridge, England, United Kingdom",
            "airport": "Cambridge"
          },
          {
            "code": "CBL",
            "location": "Ciudad Bolivar, Venezuela",
            "airport": ""
          },
          {
            "code": "CBR",
            "location": "Canberra, Australian Capital Territory, Australia",
            "airport": "Canberra"
          },
          {
            "code": "CCF",
            "location": "Carcassonne, France",
            "airport": "Salvaza Airport"
          },
          {
            "code": "CCJ",
            "location": "Calicut, India",
            "airport": ""
          },
          {
            "code": "CCP",
            "location": "Concepcion, Chile",
            "airport": "Carriel Sur"
          },
          {
            "code": "CCS",
            "location": "Caracas, Venezuela",
            "airport": "Simon Bolivar International"
          },
          {
            "code": "CCU",
            "location": "Calcutta, India",
            "airport": "Calcutta"
          },
          {
            "code": "CDC",
            "location": "Cedar City, UT, USA",
            "airport": ""
          },
          {
            "code": "CDG",
            "location": "Paris, France",
            "airport": "Charles De Gaulle"
          },
          {
            "code": "CDH",
            "location": "Camden, AR, USA",
            "airport": ""
          },
          {
            "code": "CDR",
            "location": "Chadron, NE, USA",
            "airport": ""
          },
          {
            "code": "CDV",
            "location": "Cordova, AK, USA",
            "airport": ""
          },
          {
            "code": "CEB",
            "location": "Cebu, Philippines",
            "airport": "International"
          },
          {
            "code": "CEC",
            "location": "Crescent City, CA, USA",
            "airport": "Crescent City Municipal Airport"
          },
          {
            "code": "CEI",
            "location": "Chiang Rai, Thailand",
            "airport": "Chiang Rai"
          },
          {
            "code": "CEN",
            "location": "Ciudad Obregon, Sonora, Mexico",
            "airport": ""
          },
          {
            "code": "CER",
            "location": "Cherbourg, France",
            "airport": "Maupertus"
          },
          {
            "code": "CEZ",
            "location": "Cortez, CO, USA",
            "airport": "Montezuma County"
          },
          {
            "code": "CFR",
            "location": "Caen, France",
            "airport": "Carpiquet"
          },
          {
            "code": "CFU",
            "location": "Kerkyra, Greece",
            "airport": "Kerkyra"
          },
          {
            "code": "CGA",
            "location": "Craig, AK, USA",
            "airport": ""
          },
          {
            "code": "CGB",
            "location": "Cuiaba, Mato Grosso, Brazil",
            "airport": ""
          },
          {
            "code": "CGH",
            "location": "Sao Paulo, Sao Paulo, Brazil",
            "airport": "Congonhas"
          },
          {
            "code": "CGI",
            "location": "Cape Girardeau, MO, USA",
            "airport": "Municipal Airport"
          },
          {
            "code": "CGK",
            "location": "Jakarta, Indonesia",
            "airport": "Soekarno Hatta International"
          },
          {
            "code": "CGN",
            "location": "Cologne/Bonn, Germany",
            "airport": "Koeln/Bonn"
          },
          {
            "code": "CGO",
            "location": "Zhengzhou, China",
            "airport": ""
          },
          {
            "code": "CGP",
            "location": "Chittagong, Bangladesh",
            "airport": "Patenga"
          },
          {
            "code": "CGQ",
            "location": "Changchun, China",
            "airport": ""
          },
          {
            "code": "CGR",
            "location": "Campo Grande, Mato Grosso Do Sul, Brazil",
            "airport": ""
          },
          {
            "code": "CGX",
            "location": "Chicago, IL, USA",
            "airport": "Meigs Field"
          },
          {
            "code": "CGX",
            "location": "Chicago, IL, USA",
            "airport": "Midway / Ohare / Meigs"
          },
          {
            "code": "CHA",
            "location": "Chattanooga, TN, USA",
            "airport": "Cha Lovell Field"
          },
          {
            "code": "CHC",
            "location": "Christchurch, New Zealand",
            "airport": "International"
          },
          {
            "code": "CHO",
            "location": "Charlottesville, VA, USA",
            "airport": "Charlottesville/Albemarle"
          },
          {
            "code": "CHQ",
            "location": "Chania, Crete Island, Greece",
            "airport": "Souda"
          },
          {
            "code": "CHS",
            "location": "Charleston, SC, USA",
            "airport": "Charleston International Airport"
          },
          {
            "code": "CIA",
            "location": "Rome, Italy",
            "airport": "Ciampino"
          },
          {
            "code": "CIC",
            "location": "Chico, CA, USA",
            "airport": "Chico Municipal Air Terminal"
          },
          {
            "code": "CID",
            "location": "Cedar Rapids, IA, USA",
            "airport": "Municipal"
          },
          {
            "code": "CIU",
            "location": "Sault Ste Marie, MI, USA",
            "airport": "Chippewa County Intl Airport"
          },
          {
            "code": "CIX",
            "location": "Chiclayo, Peru",
            "airport": "Cornel Ruiz"
          },
          {
            "code": "CJB",
            "location": "Coimbatore, India",
            "airport": "Peelamedu"
          },
          {
            "code": "CJS",
            "location": "Ciudad Juarez, Chihuahua, Mexico",
            "airport": "International Abraham Gonzalez"
          },
          {
            "code": "CJU",
            "location": "Cheju, South Korea",
            "airport": "Cheju"
          },
          {
            "code": "CKB",
            "location": "Clarksburg, WV, USA",
            "airport": "Clarksburg-Benedum Airport"
          },
          {
            "code": "CKS",
            "location": "Carajas, Para, Brazil",
            "airport": "International / Brasilia Brazil"
          },
          {
            "code": "CKY",
            "location": "Conakry, Guinea",
            "airport": "Conakry"
          },
          {
            "code": "CLD",
            "location": "Carlsbad, CA, USA",
            "airport": "Carlsbad/Palomar Airport"
          },
          {
            "code": "CLE",
            "location": "Cleveland, OH, USA",
            "airport": "Hopkins International Airport"
          },
          {
            "code": "CLJ",
            "location": "Cluj, Romania",
            "airport": "Cluj"
          },
          {
            "code": "CLL",
            "location": "College Station, TX, USA",
            "airport": ""
          },
          {
            "code": "CLM",
            "location": "Port Angeles, WA, USA",
            "airport": "Wm Fairchild Intl Airport"
          },
          {
            "code": "CLO",
            "location": "Cali, Colombia",
            "airport": "Alfonso Bonilla Aragon"
          },
          {
            "code": "CLQ",
            "location": "Colima, Colima, Mexico",
            "airport": ""
          },
          {
            "code": "CLT",
            "location": "Charlotte, NC, USA",
            "airport": "Charlotte/Douglas Intl Airport"
          },
          {
            "code": "CLY",
            "location": "Calvi, Corsica, France",
            "airport": "Ste Catherine"
          },
          {
            "code": "CMB",
            "location": "Colombo, Sri Lanka",
            "airport": "Katunayake International"
          },
          {
            "code": "CME",
            "location": "Ciudad Del Carmen, Campeche, Mexico",
            "airport": ""
          },
          {
            "code": "CMF",
            "location": "Chambery, France",
            "airport": "Chambery Aix-Les-Bains"
          },
          {
            "code": "CMG",
            "location": "Corumba, Mato Grosso Do Sul, Brazil",
            "airport": "Corumba"
          },
          {
            "code": "CMH",
            "location": "Columbus, OH, USA",
            "airport": "Port Columbus Intl Airport"
          },
          {
            "code": "CMI",
            "location": "Champaign, IL, USA",
            "airport": "Univ Of Illinois-Willard Airport"
          },
          {
            "code": "CMN",
            "location": "Casablanca, Morocco",
            "airport": "Mohamed V"
          },
          {
            "code": "CMX",
            "location": "Hancock, MI, USA",
            "airport": "Houghton County / Memorial"
          },
          {
            "code": "CND",
            "location": "Constanta, Romania",
            "airport": "Kogalniceanu"
          },
          {
            "code": "CNF",
            "location": "Belo Horizonte /Belo Horizon, Minas Gerais, Brazil",
            "airport": "Tancredo Neves International Airport"
          },
          {
            "code": "CNM",
            "location": "Carlsbad, NM, USA",
            "airport": ""
          },
          {
            "code": "CNS",
            "location": "Cairns, Queensland, Australia",
            "airport": "Cairns"
          },
          {
            "code": "CNX",
            "location": "Chiang Mai, Thailand",
            "airport": "International"
          },
          {
            "code": "CNY",
            "location": "Moab, UT, USA",
            "airport": ""
          },
          {
            "code": "COK",
            "location": "Cochin, India",
            "airport": "Naval Air Station"
          },
          {
            "code": "COO",
            "location": "Cotonou, Benin",
            "airport": "Cotonou"
          },
          {
            "code": "COR",
            "location": "Cordoba, Cordoba, Argentina",
            "airport": "Pajas Blancas"
          },
          {
            "code": "COS",
            "location": "Colorado Springs, CO, USA",
            "airport": "Colorado Springs Municipal"
          },
          {
            "code": "COU",
            "location": "Columbia, MO, USA",
            "airport": "Columbia Regional"
          },
          {
            "code": "CPC",
            "location": "San Martin De Los Andes, Neuquen, Argentina",
            "airport": ""
          },
          {
            "code": "CPH",
            "location": "Copenhagen, Denmark",
            "airport": "Copenhagen"
          },
          {
            "code": "CPQ",
            "location": "Campinas, Sao Paulo, Brazil",
            "airport": "Campinas International"
          },
          {
            "code": "CPR",
            "location": "Casper, WY, USA",
            "airport": "Natrona County Intl Airport"
          },
          {
            "code": "CPT",
            "location": "Cape Town, South Africa",
            "airport": "DF Malan"
          },
          {
            "code": "CRD",
            "location": "Comodoro Rivadavia, Chubut, Argentina",
            "airport": "Comodoro Rivadavia"
          },
          {
            "code": "CRI",
            "location": "Crooked Island, Bahamas",
            "airport": ""
          },
          {
            "code": "CRP",
            "location": "Corpus Christi, TX, USA",
            "airport": "Corpus Christi International Airport"
          },
          {
            "code": "CRU",
            "location": "Carriacou Island, Grenada",
            "airport": ""
          },
          {
            "code": "CRW",
            "location": "Charleston, WV, USA",
            "airport": "Yeager Airport"
          },
          {
            "code": "CSG",
            "location": "Columbus, GA, USA",
            "airport": "Columbus Metropolitan / Fort Benning"
          },
          {
            "code": "CSX",
            "location": "Changsha, China",
            "airport": ""
          },
          {
            "code": "CTA",
            "location": "Catania, Sicily, Italy",
            "airport": "Fontanarossa"
          },
          {
            "code": "CTG",
            "location": "Cartagena, Colombia",
            "airport": "Rafael Nunez"
          },
          {
            "code": "CTL",
            "location": "Charleville, Queensland, Australia",
            "airport": "Charleville"
          },
          {
            "code": "CTS",
            "location": "Sapporo, Japan",
            "airport": "Chitose"
          },
          {
            "code": "CTU",
            "location": "Chengdu, China",
            "airport": ""
          },
          {
            "code": "CUC",
            "location": "Cucuta, Colombia",
            "airport": "Camilo Daza"
          },
          {
            "code": "CUE",
            "location": "Cuenca, Ecuador",
            "airport": "Mariscal La Mar"
          },
          {
            "code": "CUL",
            "location": "Culiacan, Sinaloa, Mexico",
            "airport": ""
          },
          {
            "code": "CUM",
            "location": "Cumana, Venezuela",
            "airport": ""
          },
          {
            "code": "CUN",
            "location": "Cancun, Mexico",
            "airport": ""
          },
          {
            "code": "CUP",
            "location": "Carupano, Venezuela",
            "airport": "Carupano"
          },
          {
            "code": "CUR",
            "location": "Willemstad / Curacao Island, Netherlands Antilles",
            "airport": "Hato Airport"
          },
          {
            "code": "CUU",
            "location": "Chihuahua, Chihuahua, Mexico",
            "airport": "Genvillalobos"
          },
          {
            "code": "CUZ",
            "location": "Cuzco, Peru",
            "airport": "Lte Velazco Astete"
          },
          {
            "code": "CVG",
            "location": "Cincinnati, OH, USA",
            "airport": "Greater Cincinnati Intl Airport"
          },
          {
            "code": "CVN",
            "location": "Clovis, NM, USA",
            "airport": ""
          },
          {
            "code": "CWA",
            "location": "Wausau, WI, USA",
            "airport": "Central Wisconsin Airport"
          },
          {
            "code": "CWB",
            "location": "Curitiba, Parana, Brazil",
            "airport": "Afonso Pena"
          },
          {
            "code": "CWL",
            "location": "Cardiff, Wales, United Kingdom",
            "airport": "Cardiff-Wales"
          },
          {
            "code": "CWT",
            "location": "Cowra, New South Wales, Australia",
            "airport": "Cowra"
          },
          {
            "code": "CXH",
            "location": "Vancouver, British Columbia, Canada",
            "airport": "Vancouver Harbor Airport"
          },
          {
            "code": "CYB",
            "location": "Cayman Brac Island, Cayman Islands",
            "airport": ""
          },
          {
            "code": "CYR",
            "location": "Colonia, Uruguay",
            "airport": ""
          },
          {
            "code": "CYS",
            "location": "Cheyenne, WY, USA",
            "airport": "Cheyenne Municipal Airport"
          },
          {
            "code": "CZM",
            "location": "Cozumel, Quintana Roo, Mexico",
            "airport": "Aeropuerto Intl De Cozumel"
          },
          {
            "code": "DAB",
            "location": "Daytona Beach, FL, USA",
            "airport": "Daytona Beach International Airport"
          },
          {
            "code": "DAC",
            "location": "Dhaka, Bangladesh",
            "airport": "Zia International Airport"
          },
          {
            "code": "DAD",
            "location": "Da Nang, Vietnam",
            "airport": "Da Nang"
          },
          {
            "code": "DAL",
            "location": "Dallas, TX, USA",
            "airport": "Love Field"
          },
          {
            "code": "DAM",
            "location": "Damascus, Syria",
            "airport": "Damascus Intl"
          },
          {
            "code": "DAN",
            "location": "Danville, VA, USA",
            "airport": ""
          },
          {
            "code": "DAR",
            "location": "Dar Es Salaam, Tanzania",
            "airport": "International"
          },
          {
            "code": "DAY",
            "location": "Dayton, OH, USA",
            "airport": "James M Cox Dayton International"
          },
          {
            "code": "DBO",
            "location": "Dubbo, New South Wales, Australia",
            "airport": "Dubbo"
          },
          {
            "code": "DBQ",
            "location": "Dubuque, IA, USA",
            "airport": "Dubuque Municipal Airport"
          },
          {
            "code": "DCA",
            "location": "Washington, DC, USA",
            "airport": "Washington National Airport"
          },
          {
            "code": "DCF",
            "location": "Dominica, Dominica",
            "airport": "Cane Field"
          },
          {
            "code": "DDC",
            "location": "Dodge City, KS, USA",
            "airport": "Dodge City Municipal"
          },
          {
            "code": "DEC",
            "location": "Decatur, IL, USA",
            "airport": "Decatur Municiple Airport"
          },
          {
            "code": "DEL",
            "location": "Delhi, India",
            "airport": "Delhi International Airport"
          },
          {
            "code": "DEM",
            "location": "Dembidollo, Ethiopia",
            "airport": "Dembidollo"
          },
          {
            "code": "DEN",
            "location": "Denver, CO, USA",
            "airport": "Denver International"
          },
          {
            "code": "DFW",
            "location": "Dallas/Ft Worth, TX, USA",
            "airport": "Dallas Ft Worth International"
          },
          {
            "code": "DGA",
            "location": "Dangriga, Belize",
            "airport": "Dangriga"
          },
          {
            "code": "DGO",
            "location": "Durango, Durango, Mexico",
            "airport": "Gen Guadalupe Victoria"
          },
          {
            "code": "DHA",
            "location": "Dhahran, Saudi Arabia",
            "airport": "Dhahran Intl"
          },
          {
            "code": "DHN",
            "location": "Dothan, AL, USA",
            "airport": "Municipal"
          },
          {
            "code": "DIB",
            "location": "Dibrugarh, India",
            "airport": "Chabua"
          },
          {
            "code": "DIJ",
            "location": "Dijon, France",
            "airport": "Longvic"
          },
          {
            "code": "DIL",
            "location": "Dili, Indonesia",
            "airport": "Comoro"
          },
          {
            "code": "DIY",
            "location": "Diyarbakir, Turkey",
            "airport": "Diyarbakia"
          },
          {
            "code": "DKR",
            "location": "Dakar, Senegal",
            "airport": "Yoff"
          },
          {
            "code": "DLA",
            "location": "Douala, Cameroon",
            "airport": "Douala"
          },
          {
            "code": "DLC",
            "location": "Dalian, China",
            "airport": ""
          },
          {
            "code": "DLH",
            "location": "Duluth, MN, USA",
            "airport": "Duluth International Airport"
          },
          {
            "code": "DLM",
            "location": "Dalaman, Turkey",
            "airport": "Dalaman"
          },
          {
            "code": "DME",
            "location": "Moscow, Russia",
            "airport": "Domodedovo"
          },
          {
            "code": "DND",
            "location": "Dundee, Scotland, United Kingdom",
            "airport": "Dundee"
          },
          {
            "code": "DNM",
            "location": "Denham, Western Australia, Australia",
            "airport": ""
          },
          {
            "code": "DNV",
            "location": "Danville, IL, USA",
            "airport": "Vermilion County Airport"
          },
          {
            "code": "DOH",
            "location": "Doha, Qatar",
            "airport": "Doha"
          },
          {
            "code": "DOK",
            "location": "Donetsk, Ukraine",
            "airport": "Donetsk"
          },
          {
            "code": "DOL",
            "location": "Deauville, France",
            "airport": "Saint Gatien"
          },
          {
            "code": "DOM",
            "location": "Dominica, Dominica",
            "airport": "Melville Hal-Dom"
          },
          {
            "code": "DPL",
            "location": "Dipolog, Philippines",
            "airport": "Dipolog"
          },
          {
            "code": "DPO",
            "location": "Devonport, Tasmania, Australia",
            "airport": "Devonport"
          },
          {
            "code": "DPS",
            "location": "Denpasar Bali, Indonesia",
            "airport": "Ngurah Rai"
          },
          {
            "code": "DRO",
            "location": "Durango, CO, USA",
            "airport": "Durango La Plata County Airport"
          },
          {
            "code": "DRS",
            "location": "Dresden, Germany",
            "airport": "Dresden"
          },
          {
            "code": "DRT",
            "location": "Del Rio, TX, USA",
            "airport": ""
          },
          {
            "code": "DRW",
            "location": "Darwin, Northern Territory, Australia",
            "airport": ""
          },
          {
            "code": "DSI",
            "location": "Destin, FL, USA",
            "airport": ""
          },
          {
            "code": "DSM",
            "location": "Des Moines, IA, USA",
            "airport": ""
          },
          {
            "code": "DTM",
            "location": "Dortmund, Germany",
            "airport": "Wickede"
          },
          {
            "code": "DTW",
            "location": "Detroit, MI, USA",
            "airport": "Detroit Metropolitan Airport"
          },
          {
            "code": "DUB",
            "location": "Dublin, Ireland",
            "airport": "Dublin"
          },
          {
            "code": "DUD",
            "location": "Dunedin, New Zealand",
            "airport": "Momona"
          },
          {
            "code": "DUJ",
            "location": "Du Bois, PA, USA",
            "airport": "Jefferson County"
          },
          {
            "code": "DUQ",
            "location": "Duncan / Quam, British Columbia, Canada",
            "airport": "Quamichan Lake"
          },
          {
            "code": "DUR",
            "location": "Durban, South Africa",
            "airport": "Louis Botha"
          },
          {
            "code": "DUS",
            "location": "Dusseldorf, Germany",
            "airport": "Dusseldorf"
          },
          {
            "code": "DUT",
            "location": "Dutch Harbor, AK, USA",
            "airport": "Dutch Harbor"
          },
          {
            "code": "DVO",
            "location": "Davao, Philippines",
            "airport": "Mati"
          },
          {
            "code": "DXB",
            "location": "Dubai, United Arab Emirates",
            "airport": "Dubai International Airport"
          },
          {
            "code": "EAP",
            "location": ", Switzerland",
            "airport": ""
          },
          {
            "code": "EAR",
            "location": "Kearney, NE, USA",
            "airport": "Kearney Municipal Airport"
          },
          {
            "code": "EAS",
            "location": "San Sebastian, Spain",
            "airport": "Fuenterrabia"
          },
          {
            "code": "EAT",
            "location": "Wenatchee, WA, USA",
            "airport": "Pangborn Memorial Field"
          },
          {
            "code": "UAE",
            "location": "Eau Claire, WI, USA",
            "airport": "Eau Claire Municipal"
          },
          {
            "code": "EBA",
            "location": "Elba Island, Italy",
            "airport": "Marina Di Campo"
          },
          {
            "code": "EBB",
            "location": "Entebbe/Kampala, Uganda",
            "airport": "Entebbe"
          },
          {
            "code": "EBJ",
            "location": "Esbjerg, Denmark",
            "airport": "Esbjerg"
          },
          {
            "code": "EDI",
            "location": "Edinburgh, Scotland, United Kingdom",
            "airport": "Turnhouse"
          },
          {
            "code": "EDR",
            "location": "Edward River, Queensland, Australia",
            "airport": "Edward River"
          },
          {
            "code": "EEN",
            "location": "Keene / Brattleboro, NH, USA",
            "airport": "Dillant Hopkins"
          },
          {
            "code": "EFD",
            "location": "Houston, TX, USA",
            "airport": "Ellington Field"
          },
          {
            "code": "EGE",
            "location": "Vail/Eagle, CO, USA",
            "airport": "Eagle County Regional"
          },
          {
            "code": "EIN",
            "location": "Eindhoven, Netherlands",
            "airport": "Welschap"
          },
          {
            "code": "EIS",
            "location": "Tortola/Beef Island, Virgin Islands (British)",
            "airport": "Beef Island"
          },
          {
            "code": "EJA",
            "location": "Barrancabermeja, Colombia",
            "airport": "Variguies"
          },
          {
            "code": "EKO",
            "location": "Elko, NV, USA",
            "airport": "JC Harris Field"
          },
          {
            "code": "ELD",
            "location": "El Dorado, AR, USA",
            "airport": ""
          },
          {
            "code": "ELH",
            "location": "North Eleuthera, Bahamas",
            "airport": ""
          },
          {
            "code": "ELM",
            "location": "Elmira / Corning, NY, USA",
            "airport": "Elmira Corning Regional Arpt"
          },
          {
            "code": "ELP",
            "location": "El Paso, TX, USA",
            "airport": "El Paso International Airport"
          },
          {
            "code": "ELS",
            "location": "East London, South Africa",
            "airport": "Ben Shoeman"
          },
          {
            "code": "ELY",
            "location": "Ely, NV, USA",
            "airport": "Yelland Field"
          },
          {
            "code": "EMA",
            "location": "East Midlands, England, United Kingdom",
            "airport": "East Midlands"
          },
          {
            "code": "EMD",
            "location": "Emerald, Queensland, Australia",
            "airport": "Emerald"
          },
          {
            "code": "ENA",
            "location": "Kenai, AK, USA",
            "airport": "Kenai Municipal Airport"
          },
          {
            "code": "ENS",
            "location": "Enschede, Netherlands",
            "airport": "Twente"
          },
          {
            "code": "EOH",
            "location": "Medellin, Colombia",
            "airport": "Enrique Olaya Herrara"
          },
          {
            "code": "EPR",
            "location": "Esperance, Western Australia, Australia",
            "airport": "Esperance"
          },
          {
            "code": "ERF",
            "location": "Erfurt, Germany",
            "airport": "Erfurt"
          },
          {
            "code": "ERI",
            "location": "Erie, PA, USA",
            "airport": "Erie International"
          },
          {
            "code": "ERS",
            "location": "Windhoek, Namibia",
            "airport": "Eros"
          },
          {
            "code": "ERZ",
            "location": "Erzurum, Turkey",
            "airport": "Erzurum"
          },
          {
            "code": "ESB",
            "location": "Ankara, Turkey",
            "airport": "Esenboga"
          },
          {
            "code": "ESC",
            "location": "Escanaba, MI, USA",
            "airport": "Delta County Airport"
          },
          {
            "code": "ESD",
            "location": "Eastsound, WA, USA",
            "airport": "Eastsound/Orcas Island Airport"
          },
          {
            "code": "ESR",
            "location": "El Salvador, Chile",
            "airport": ""
          },
          {
            "code": "ETH",
            "location": "Elat, Israel",
            "airport": "Elat"
          },
          {
            "code": "ETZ",
            "location": "Metz/Nancy, France",
            "airport": "Frescaty"
          },
          {
            "code": "EUG",
            "location": "Eugene, OR, USA",
            "airport": "Eugene Airport"
          },
          {
            "code": "EUN",
            "location": "Laayoune, Morocco",
            "airport": "Laayoune-Hassan I Morocco"
          },
          {
            "code": "EVE",
            "location": "Evenes, Norway",
            "airport": "Evenes"
          },
          {
            "code": "EVN",
            "location": "Yerevan, Armenia",
            "airport": ""
          },
          {
            "code": "EVV",
            "location": "Evansville, IN, USA",
            "airport": "Evansville Regional Airport"
          },
          {
            "code": "EWB",
            "location": "New Bedford/Fall River, MA, USA",
            "airport": "New Bedford Municipal"
          },
          {
            "code": "EWN",
            "location": "New Bern, NC, USA",
            "airport": "Simmons-Nott Airport"
          },
          {
            "code": "EWR",
            "location": "Newark, NJ, USA",
            "airport": "Newark International Airport"
          },
          {
            "code": "EXT",
            "location": "Exeter, England, United Kingdom",
            "airport": "Exeter"
          },
          {
            "code": "EYW",
            "location": "Key West, FL, USA",
            "airport": ""
          },
          {
            "code": "EZE",
            "location": "Buenos Aires, Buenos Aires, Argentina",
            "airport": "Eze"
          },
          {
            "code": "FAE",
            "location": "Faroe Islands, Faroe Islands",
            "airport": "Faeroe Islands"
          },
          {
            "code": "FAI",
            "location": "Fairbanks, AK, USA",
            "airport": "Fairbanks International Airport"
          },
          {
            "code": "FAO",
            "location": "Faro, Portugal",
            "airport": "Faro"
          },
          {
            "code": "FAR",
            "location": "Fargo, ND, USA",
            "airport": "Hector Airport"
          },
          {
            "code": "FAT",
            "location": "Fresno, CA, USA",
            "airport": "Fresno Air Terminal"
          },
          {
            "code": "FAY",
            "location": "Fayetteville, NC, USA",
            "airport": "Fayetteville Municipal"
          },
          {
            "code": "FBU",
            "location": "Oslo, Norway",
            "airport": "Fornebu"
          },
          {
            "code": "FCA",
            "location": "Kalispell, MT, USA",
            "airport": "Glacier Park International"
          },
          {
            "code": "FCO",
            "location": "Rome, Italy",
            "airport": "Leonardo Da Vinci/Fiumicino"
          },
          {
            "code": "FDE",
            "location": "Forde, Norway",
            "airport": "Forde"
          },
          {
            "code": "FDF",
            "location": "Fort De France, Martinique",
            "airport": "Fort De France"
          },
          {
            "code": "FDH",
            "location": "Friedrichshafen, Germany",
            "airport": "Friedrichshafen"
          },
          {
            "code": "FEZ",
            "location": "Fez, Morocco",
            "airport": "Fez"
          },
          {
            "code": "FFM",
            "location": "Fergus Falls, MN, USA",
            "airport": "Fergus Falls Municipal Airport"
          },
          {
            "code": "FHU",
            "location": "Fort Huachuca/Sierra Vista, AZ, USA",
            "airport": ""
          },
          {
            "code": "FIH",
            "location": "Kinshasa, Zaire",
            "airport": "Kinshasa"
          },
          {
            "code": "FKL",
            "location": "Franklin, PA, USA",
            "airport": "Chess Lamberton"
          },
          {
            "code": "FLG",
            "location": "Flagstaff, AZ, USA",
            "airport": "Flagstaff"
          },
          {
            "code": "FLL",
            "location": "Ft Lauderdale, FL, USA",
            "airport": "Ft Lauderdale/Hollywood Intl Apt"
          },
          {
            "code": "FLN",
            "location": "Florianopolis, Santa Catarina, Brazil",
            "airport": "Florianopolis"
          },
          {
            "code": "FLO",
            "location": "Florence, SC, USA",
            "airport": "Gilbert Field"
          },
          {
            "code": "FLR",
            "location": "Florence, Italy",
            "airport": ""
          },
          {
            "code": "FMA",
            "location": "Formosa, Formosa, Argentina",
            "airport": "Formosa"
          },
          {
            "code": "FMN",
            "location": "Farmington, NM, USA",
            "airport": "Four Corners Regional Airport"
          },
          {
            "code": "FMO",
            "location": "Muenster, Germany",
            "airport": "Muenster"
          },
          {
            "code": "FNC",
            "location": "Funchal, Madeira Islands, Portugal",
            "airport": "Funchal"
          },
          {
            "code": "FNL",
            "location": "Fort Collins/Loveland, CO, USA",
            "airport": "Fort Collins / Loveland Airport"
          },
          {
            "code": "FNT",
            "location": "Flint, MI, USA",
            "airport": "Bishop Int'l Airport"
          },
          {
            "code": "FOD",
            "location": "Fort Dodge, IA, USA",
            "airport": "Fort Dodge Regional Airport"
          },
          {
            "code": "FOE",
            "location": "Topeka, KS, USA",
            "airport": "Forbes Field"
          },
          {
            "code": "FOR",
            "location": "Fortaleza, Ceara, Brazil",
            "airport": "Fortaleza"
          },
          {
            "code": "FPO",
            "location": "Freeport, Bahamas",
            "airport": "Freeport Intl Airport"
          },
          {
            "code": "FRA",
            "location": "Frankfurt, Germany",
            "airport": "Frankfurt International"
          },
          {
            "code": "FRD",
            "location": "Friday Harbor, WA, USA",
            "airport": "Friday Harbor Airport"
          },
          {
            "code": "FRM",
            "location": "Fairmont, MN, USA",
            "airport": "Fairmont Municipal"
          },
          {
            "code": "FRO",
            "location": "Floro, Norway",
            "airport": "Floro"
          },
          {
            "code": "FRS",
            "location": "Flores, Guatemala",
            "airport": "Flores"
          },
          {
            "code": "FRU",
            "location": "Bishkek, Kyrgyzstan",
            "airport": "Bishkek Airport"
          },
          {
            "code": "FSD",
            "location": "Sioux Falls, SD, USA",
            "airport": "Joe Foss Field"
          },
          {
            "code": "FSM",
            "location": "Fort Smith, AR, USA",
            "airport": "Fort Smith Municipal"
          },
          {
            "code": "FSP",
            "location": "St Pierre, St. Pierre And Miquelon",
            "airport": ""
          },
          {
            "code": "FUE",
            "location": "Fuerteventura / Puerto Del Rosario, Canary Islands/Fuerteventura Island, Spain",
            "airport": "Fuerteventura"
          },
          {
            "code": "FUK",
            "location": "Fukuoka, Japan",
            "airport": "Itazuke"
          },
          {
            "code": "FWA",
            "location": "Fort Wayne, IN, USA",
            "airport": "Baer Field"
          },
          {
            "code": "FYV",
            "location": "Fayetteville, AR, USA",
            "airport": "Municipal"
          },
          {
            "code": "GAJ",
            "location": "Yamagata, Japan",
            "airport": "Junmachi"
          },
          {
            "code": "GAL",
            "location": "Galena, AK, USA",
            "airport": ""
          },
          {
            "code": "GAU",
            "location": "Gauhati, India",
            "airport": "Borjhar"
          },
          {
            "code": "GBE",
            "location": "Gaborone, Botswana",
            "airport": "Gaborone"
          },
          {
            "code": "GBG",
            "location": "Galesburg, IL, USA",
            "airport": "Galesburg Municiple Airport"
          },
          {
            "code": "GCC",
            "location": "Gillette, WY, USA",
            "airport": "Campbell County Airport"
          },
          {
            "code": "GCI",
            "location": "Guernsey, Channel Islands, United Kingdom",
            "airport": "Guernsey"
          },
          {
            "code": "GCK",
            "location": "Garden City, KS, USA",
            "airport": "Garden City Municipal Airport"
          },
          {
            "code": "GCM",
            "location": "Grand Cayman Island, Cayman Islands",
            "airport": "Owen Roberts Intl Airport"
          },
          {
            "code": "GCN",
            "location": "Grand Canyon, AZ, USA",
            "airport": ""
          },
          {
            "code": "GDL",
            "location": "Guadalajara, Jalisco, Mexico",
            "airport": "Miguel Hidalgo Intl"
          },
          {
            "code": "GDN",
            "location": "Gdansk, Poland",
            "airport": "Rebiechowo"
          },
          {
            "code": "GDT",
            "location": "Grand Turk Is, Turks And Caicos Islands",
            "airport": ""
          },
          {
            "code": "GDV",
            "location": "Glendive, MT, USA",
            "airport": ""
          },
          {
            "code": "GDX",
            "location": "Magadan, Russia",
            "airport": "Magadan"
          },
          {
            "code": "GEG",
            "location": "Spokane, WA, USA",
            "airport": "International/Geiger Field"
          },
          {
            "code": "GEN",
            "location": "Oslo, Norway",
            "airport": "Garderm OEN"
          },
          {
            "code": "GEO",
            "location": "Georgetown, Guyana",
            "airport": "Timehri"
          },
          {
            "code": "GET",
            "location": "Geraldton, Western Australia, Australia",
            "airport": "Geraldton"
          },
          {
            "code": "GFK",
            "location": "Grand Forks, ND, USA",
            "airport": "Grand Forks International Airport"
          },
          {
            "code": "GGG",
            "location": "Longview/Gladewater/Kilgore, TX, USA",
            "airport": "Gregg County"
          },
          {
            "code": "GGT",
            "location": "George Town, Bahamas",
            "airport": "Exuma International"
          },
          {
            "code": "GGW",
            "location": "Glasgow, MT, USA",
            "airport": ""
          },
          {
            "code": "GHB",
            "location": "Governors Harbour, Bahamas",
            "airport": ""
          },
          {
            "code": "GIB",
            "location": "Gibraltar, Gibraltar",
            "airport": "Gibraltar"
          },
          {
            "code": "GIG",
            "location": "Rio De Janeiro, Rio De Janeiro, Brazil",
            "airport": "International Airport"
          },
          {
            "code": "GJT",
            "location": "Grand Junction, CO, USA",
            "airport": "Walker Field"
          },
          {
            "code": "GKA",
            "location": "Goroka, Papua New Guinea",
            "airport": "Goroka"
          },
          {
            "code": "GLA",
            "location": "Glasgow, Scotland, United Kingdom",
            "airport": "Glasgow Scotland"
          },
          {
            "code": "GLD",
            "location": "Goodland, KS, USA",
            "airport": "Renner Field"
          },
          {
            "code": "GLF",
            "location": "Golfito, Costa Rica",
            "airport": "Golfito"
          },
          {
            "code": "GLS",
            "location": "Galveston, TX, USA",
            "airport": "Scholes Field"
          },
          {
            "code": "GLV",
            "location": "Golovin, AK, USA",
            "airport": ""
          },
          {
            "code": "GNB",
            "location": "Grenoble, France",
            "airport": "St Geoirs"
          },
          {
            "code": "GND",
            "location": "St Georges/Grenada, Grenada",
            "airport": "Pt Saline"
          },
          {
            "code": "GNV",
            "location": "Gainesville, FL, USA",
            "airport": "Jr Alison Municipal"
          },
          {
            "code": "GOA",
            "location": "Genoa, Italy",
            "airport": "Christoforo Colombo"
          },
          {
            "code": "GOH",
            "location": "Nuuk, Greenland",
            "airport": ""
          },
          {
            "code": "GOI",
            "location": "Goa, India",
            "airport": "Dabolim"
          },
          {
            "code": "GOJ",
            "location": "Nizhniy Novgorod, Russia",
            "airport": "Nizhniy"
          },
          {
            "code": "GON",
            "location": "Groton / New London, CT, USA",
            "airport": "Groton-New London"
          },
          {
            "code": "GOT",
            "location": "Gothenburg, Sweden",
            "airport": "Landvetter"
          },
          {
            "code": "GOV",
            "location": "Gove, Northern Territory, Australia",
            "airport": "Nhulunbuy"
          },
          {
            "code": "GPS",
            "location": "Galapagos Islands, Ecuador",
            "airport": "Baltra"
          },
          {
            "code": "GPT",
            "location": "Gulfport, MS, USA",
            "airport": "Gulfport/Biloxi"
          },
          {
            "code": "GRB",
            "location": "Green Bay, WI, USA",
            "airport": "Austin/Straybel Field"
          },
          {
            "code": "GRI",
            "location": "Grand Island, NE, USA",
            "airport": "Central Nebraska Regional Airport"
          },
          {
            "code": "GRJ",
            "location": "George, South Africa",
            "airport": "George"
          },
          {
            "code": "GRO",
            "location": "Gerona, Spain",
            "airport": "Costa Brava"
          },
          {
            "code": "GRQ",
            "location": "Groningen, Netherlands",
            "airport": "Eelde"
          },
          {
            "code": "GRR",
            "location": "Grand Rapids, MI, USA",
            "airport": "Kent County International Airport"
          },
          {
            "code": "GRU",
            "location": "Sao Paulo, Sao Paulo, Brazil",
            "airport": "Guarulhos"
          },
          {
            "code": "GRU",
            "location": "Sao Paulo, Sao Paulo, Brazil",
            "airport": "Guarulhos International"
          },
          {
            "code": "GRX",
            "location": "Granada, Spain",
            "airport": "Granada"
          },
          {
            "code": "GRZ",
            "location": "Graz, Austria",
            "airport": "Thalerhof"
          },
          {
            "code": "GSO",
            "location": "Greensboro / High Point, NC, USA",
            "airport": "Piedmont Triad Intl Airport"
          },
          {
            "code": "GTF",
            "location": "Great Falls, MT, USA",
            "airport": "Great Falls International"
          },
          {
            "code": "GTO",
            "location": "Gorontalo, Indonesia",
            "airport": "Tolotio"
          },
          {
            "code": "GTR",
            "location": "Columbus, MS, USA",
            "airport": "Golden"
          },
          {
            "code": "GUA",
            "location": "Guatemala City, Guatemala",
            "airport": "La Aurora Intl Airport"
          },
          {
            "code": "GUB",
            "location": "Guerrero Negro, Baja California Sur, Mexico",
            "airport": "Guerrero Negro Airport"
          },
          {
            "code": "GUC",
            "location": "Gunnison, CO, USA",
            "airport": "Gunnison County Airport"
          },
          {
            "code": "GUM",
            "location": "Guam, Guam",
            "airport": "Ab Wonpat Intl Airport"
          },
          {
            "code": "GUP",
            "location": "Gallup, NM, USA",
            "airport": "Gallup Municipal"
          },
          {
            "code": "GUR",
            "location": "Alotau, Papua New Guinea",
            "airport": "Gurney"
          },
          {
            "code": "GVA",
            "location": "Geneva, Switzerland",
            "airport": "Geneva"
          },
          {
            "code": "GWD",
            "location": "Gwadar, Pakistan",
            "airport": ""
          },
          {
            "code": "GWT",
            "location": "Westerland, Germany",
            "airport": "Westerland"
          },
          {
            "code": "GWY",
            "location": "Galway, Ireland",
            "airport": "Carnmore"
          },
          {
            "code": "GXQ",
            "location": "Coyhaique, Chile",
            "airport": "Teniente Vidal"
          },
          {
            "code": "GYE",
            "location": "Guayaquil, Ecuador",
            "airport": "Simon Bolivar"
          },
          {
            "code": "GYM",
            "location": "Guaymas, Sonora, Mexico",
            "airport": ""
          },
          {
            "code": "GYY",
            "location": "Gary, IN, USA",
            "airport": ""
          },
          {
            "code": "HAD",
            "location": "Halmstad, Sweden",
            "airport": "Halmstad"
          },
          {
            "code": "HAG",
            "location": "The Hague, Netherlands",
            "airport": ""
          },
          {
            "code": "HAH",
            "location": "Moroni (Hahaya), Comoros",
            "airport": ""
          },
          {
            "code": "HAJ",
            "location": "Hanover, Germany",
            "airport": "Langenhagen"
          },
          {
            "code": "HAK",
            "location": "Haikou, China",
            "airport": "Haikou"
          },
          {
            "code": "HAM",
            "location": "Hamburg, Germany",
            "airport": "Fuhlsbuttel"
          },
          {
            "code": "HAN",
            "location": "Hanoi, Vietnam",
            "airport": "Noibai Airport"
          },
          {
            "code": "HAU",
            "location": "Haugesund, Norway",
            "airport": "Karmoy"
          },
          {
            "code": "HAV",
            "location": "Havana, Cuba",
            "airport": "Jose Marti"
          },
          {
            "code": "HBA",
            "location": "Hobart, Tasmania, Australia",
            "airport": "Hobart"
          },
          {
            "code": "HDB",
            "location": "Heidelberg, Germany",
            "airport": ""
          },
          {
            "code": "HDN",
            "location": "Hayden, CO, USA",
            "airport": "Yampa Valley Regional Airport"
          },
          {
            "code": "HDY",
            "location": "Hat Yai, Thailand",
            "airport": ""
          },
          {
            "code": "HEL",
            "location": "Helsinki, Finland",
            "airport": "Helsinki"
          },
          {
            "code": "HER",
            "location": "Heraklion, Crete Island, Greece",
            "airport": "Heraklion"
          },
          {
            "code": "HET",
            "location": "Hohhot, China",
            "airport": ""
          },
          {
            "code": "HFT",
            "location": "Hammerfest, Norway",
            "airport": ""
          },
          {
            "code": "HGH",
            "location": "Hangzhou, China",
            "airport": ""
          },
          {
            "code": "HGN",
            "location": "Mae Hong Son, Thailand",
            "airport": "Mae Hong Son"
          },
          {
            "code": "HGR",
            "location": "Hagerstown, MD, USA",
            "airport": "Washington County Regional Airport"
          },
          {
            "code": "HHH",
            "location": "Hilton Head, SC, USA",
            "airport": "Municipal"
          },
          {
            "code": "HIB",
            "location": "Hibbing / Chisholm, MN, USA",
            "airport": "Hibbing-Chisholm"
          },
          {
            "code": "HIJ",
            "location": "Hiroshima, Japan",
            "airport": "Hiroshima"
          },
          {
            "code": "HIR",
            "location": "Honiara/Guadalcanal, Solomon Islands",
            "airport": "Henderson International"
          },
          {
            "code": "HIS",
            "location": "Hayman Island, Queensland, Australia",
            "airport": "Hayman Island Airport"
          },
          {
            "code": "HKD",
            "location": "Hakodate, Japan",
            "airport": "Hakodate"
          },
          {
            "code": "HKG",
            "location": "Hong Kong, Hong Kong",
            "airport": ""
          },
          {
            "code": "HKK",
            "location": "Hokitika, New Zealand",
            "airport": "Hokitika"
          },
          {
            "code": "HKN",
            "location": "Hoskins, Papua New Guinea",
            "airport": "Hoskins"
          },
          {
            "code": "HKT",
            "location": "Phuket, Thailand",
            "airport": "Phuket"
          },
          {
            "code": "HKY",
            "location": "Hickory, NC, USA",
            "airport": ""
          },
          {
            "code": "HLN",
            "location": "Helena, MT, USA",
            "airport": ""
          },
          {
            "code": "HLP",
            "location": "Jakarta, Indonesia",
            "airport": "Halim Perdana Kusama"
          },
          {
            "code": "HLZ",
            "location": "Hamilton, New Zealand",
            "airport": "Hamilton"
          },
          {
            "code": "HMA",
            "location": "Malmo, Sweden",
            "airport": "Malmo Harbor"
          },
          {
            "code": "HMO",
            "location": "Hermosillo, Sonora, Mexico",
            "airport": "General Ignacio Pesqueira Garcia"
          },
          {
            "code": "HNA",
            "location": "Morioka, Japan",
            "airport": "Hanamaki"
          },
          {
            "code": "HNH",
            "location": "Hoonah, AK, USA",
            "airport": ""
          },
          {
            "code": "HNL",
            "location": "Honolulu, HI, USA",
            "airport": "Honolulu International"
          },
          {
            "code": "HNS",
            "location": "Haines, AK, USA",
            "airport": ""
          },
          {
            "code": "HOB",
            "location": "Hobbs, NM, USA",
            "airport": "Lea County"
          },
          {
            "code": "HOM",
            "location": "Homer, AK, USA",
            "airport": "Homer Airport"
          },
          {
            "code": "HON",
            "location": "Huron, SD, USA",
            "airport": "Huron Regional Airport"
          },
          {
            "code": "HOT",
            "location": "Hot Springs, AR, USA",
            "airport": "Memorial Field"
          },
          {
            "code": "HOU",
            "location": "Houston, TX, USA",
            "airport": "Houston Hobby Airport"
          },
          {
            "code": "HOU",
            "location": "Houston, TX, USA",
            "airport": "Houston Hobby Airport"
          },
          {
            "code": "HPB",
            "location": "Hooper Bay, AK, USA",
            "airport": ""
          },
          {
            "code": "HPN",
            "location": "Westchester County, NY, USA",
            "airport": "Westchester County Airport"
          },
          {
            "code": "HPV",
            "location": "Kauai Island, HI, USA",
            "airport": "Princeville"
          },
          {
            "code": "HRB",
            "location": "Harbin, China",
            "airport": ""
          },
          {
            "code": "HRE",
            "location": "Harare, Zimbabwe",
            "airport": "Harare"
          },
          {
            "code": "HRG",
            "location": "Hurghada, Egypt",
            "airport": ""
          },
          {
            "code": "HRK",
            "location": "Kharkov, Ukraine",
            "airport": "Kharkov"
          },
          {
            "code": "HRL",
            "location": "Harlingen, TX, USA",
            "airport": ""
          },
          {
            "code": "HRO",
            "location": "Harrison, AR, USA",
            "airport": "Boone County"
          },
          {
            "code": "HSI",
            "location": "Hastings, NE, USA",
            "airport": ""
          },
          {
            "code": "HSV",
            "location": "Huntsville/Decatur, AL, USA",
            "airport": "Huntsville-Madison County Jetplex"
          },
          {
            "code": "HTI",
            "location": "Hamilton Island, Queensland, Australia",
            "airport": ""
          },
          {
            "code": "HTS",
            "location": "Huntington / Ashland, WV, USA",
            "airport": "Tri-State"
          },
          {
            "code": "HUF",
            "location": "Terre Haute, IN, USA",
            "airport": "Hulman Field"
          },
          {
            "code": "HUI",
            "location": "Hue, Vietnam",
            "airport": ""
          },
          {
            "code": "HUM",
            "location": "Houma, LA, USA",
            "airport": "Terrebonne"
          },
          {
            "code": "HUN",
            "location": "Hualien, Taiwan",
            "airport": "Hualien"
          },
          {
            "code": "HUX",
            "location": "Huatulco, Oaxaca, Mexico",
            "airport": ""
          },
          {
            "code": "HUY",
            "location": "Humberside, England, United Kingdom",
            "airport": "Humberside"
          },
          {
            "code": "HVB",
            "location": "Hervey Bay, Queensland, Australia",
            "airport": ""
          },
          {
            "code": "HVN",
            "location": "New Haven, CT, USA",
            "airport": "Tweed New Haven"
          },
          {
            "code": "HVR",
            "location": "Havre, MT, USA",
            "airport": "City County"
          },
          {
            "code": "HWN",
            "location": "Hwange National Park, Zimbabwe",
            "airport": "Hwange National Park"
          },
          {
            "code": "HYA",
            "location": "Hyannis, MA, USA",
            "airport": "Barnstable County"
          },
          {
            "code": "HYD",
            "location": "Hyderabad, India",
            "airport": "Begumpet"
          },
          {
            "code": "HYG",
            "location": "Hydaburg, AK, USA",
            "airport": ""
          },
          {
            "code": "HYS",
            "location": "Hays, KS, USA",
            "airport": "Hays Municipal Airport"
          },
          {
            "code": "IAD",
            "location": "Washington, DC, USA",
            "airport": "Dulles"
          },
          {
            "code": "IAD",
            "location": "Washington, DC, USA",
            "airport": "Washington-Dulles International"
          },
          {
            "code": "IAH",
            "location": "Houston, TX, USA",
            "airport": ""
          },
          {
            "code": "IAH",
            "location": "Houston, TX, USA",
            "airport": "Houston Intercontinental"
          },
          {
            "code": "IAS",
            "location": "Iasi, Romania",
            "airport": "Iasi"
          },
          {
            "code": "IBZ",
            "location": "Ibiza, Spain",
            "airport": "Ibiza"
          },
          {
            "code": "ICT",
            "location": "Wichita, KS, USA",
            "airport": "Mid-Continent Airport"
          },
          {
            "code": "IDA",
            "location": "Idaho Falls, ID, USA",
            "airport": ""
          },
          {
            "code": "IEV",
            "location": "Kiev, Ukraine",
            "airport": "Zhulhany"
          },
          {
            "code": "IFP",
            "location": "Bullhead City, AZ, USA",
            "airport": "Bullhead"
          },
          {
            "code": "IGA",
            "location": "Inagua, Bahamas",
            "airport": ""
          },
          {
            "code": "IGM",
            "location": "Kingman, AZ, USA",
            "airport": "Mohave County"
          },
          {
            "code": "IGR",
            "location": "Iguazu, Misiones, Argentina",
            "airport": "Iguazu International"
          },
          {
            "code": "IGU",
            "location": "Iguassu Falls, Parana, Brazil",
            "airport": ""
          },
          {
            "code": "IJK",
            "location": "Izhevsk, Russia",
            "airport": ""
          },
          {
            "code": "IKT",
            "location": "Irkutsk, Russia",
            "airport": "Irkutsk"
          },
          {
            "code": "ILE",
            "location": "Killeen, TX, USA",
            "airport": ""
          },
          {
            "code": "ILF",
            "location": "Ilford, Manitoba, Canada",
            "airport": ""
          },
          {
            "code": "ILI",
            "location": "Iliamna, AK, USA",
            "airport": ""
          },
          {
            "code": "ILM",
            "location": "Wilmington, NC, USA",
            "airport": "New Hanover County Airport"
          },
          {
            "code": "ILO",
            "location": "Iloilo, Philippines",
            "airport": "Mandurriao"
          },
          {
            "code": "ILQ",
            "location": "Ilo, Moquegua, Peru",
            "airport": "Ilo Airport"
          },
          {
            "code": "ILY",
            "location": "Islay, Scotland, United Kingdom",
            "airport": "Glenegedale"
          },
          {
            "code": "IMF",
            "location": "Imphal, India",
            "airport": "Municipal"
          },
          {
            "code": "IMP",
            "location": "Imperatriz, Maranhao, Brazil",
            "airport": ""
          },
          {
            "code": "IMT",
            "location": "Iron Mountain, MI, USA",
            "airport": "Ford Airport"
          },
          {
            "code": "IND",
            "location": "Indianapolis, IN, USA",
            "airport": "Indianapolis International Airport"
          },
          {
            "code": "INL",
            "location": "International Falls, MN, USA",
            "airport": "Falls International"
          },
          {
            "code": "INN",
            "location": "Innsbruck, Austria",
            "airport": "Kranebitten"
          },
          {
            "code": "INT",
            "location": "Winston-Salem, NC, USA",
            "airport": "Smith Reynolds"
          },
          {
            "code": "INU",
            "location": "Nauru, Nauru",
            "airport": ""
          },
          {
            "code": "INV",
            "location": "Inverness, Scotland, United Kingdom",
            "airport": "Inverness"
          },
          {
            "code": "IOA",
            "location": "Ioannina, Greece",
            "airport": "Ioannina"
          },
          {
            "code": "IOM",
            "location": "Isle Of Man, Isle Of Man, United Kingdom",
            "airport": "Ronaldsway"
          },
          {
            "code": "IOS",
            "location": "Ilheus, Bahia, Brazil",
            "airport": "Eduardo Gomes"
          },
          {
            "code": "IPC",
            "location": "Easter Island, Chile",
            "airport": "Mataveri"
          },
          {
            "code": "IPH",
            "location": "Ipoh, Malaysia",
            "airport": "Ipoh"
          },
          {
            "code": "IPI",
            "location": "Ipiales, Colombia",
            "airport": "San Luis"
          },
          {
            "code": "IPT",
            "location": "Williamsport, PA, USA",
            "airport": "Williamsport Lycoming Municipal"
          },
          {
            "code": "IQQ",
            "location": "Iquique, Chile",
            "airport": "Chucumata"
          },
          {
            "code": "IQT",
            "location": "Iquitos, Peru",
            "airport": "Cf Secada"
          },
          {
            "code": "ISB",
            "location": "Islamabad, Pakistan",
            "airport": "International"
          },
          {
            "code": "ISC",
            "location": "Isles Of Scilly, Isles Of Scilly, United Kingdom",
            "airport": "Tresco"
          },
          {
            "code": "ISN",
            "location": "Williston, ND, USA",
            "airport": "Sloulin Field International"
          },
          {
            "code": "ISO",
            "location": "Kinston, NC, USA",
            "airport": ""
          },
          {
            "code": "ISP",
            "location": "Islip, NY, USA",
            "airport": "Long Island-Macarthur Airport"
          },
          {
            "code": "IST",
            "location": "Istanbul, Turkey",
            "airport": "Ataturk"
          },
          {
            "code": "ITH",
            "location": "Ithaca, NY, USA",
            "airport": "Tompkins County"
          },
          {
            "code": "ITM",
            "location": "Osaka, Japan",
            "airport": "Itami International Was Osaka"
          },
          {
            "code": "ITO",
            "location": "Hilo, HI, USA",
            "airport": "Hilo Hawaii:Hawaii-International Usa"
          },
          {
            "code": "IWD",
            "location": "Ironwood, MI, USA",
            "airport": "Gogebic County Airport"
          },
          {
            "code": "IXB",
            "location": "Bagdogra, India",
            "airport": "Bagdogra"
          },
          {
            "code": "IXE",
            "location": "Mangalore, India",
            "airport": "Bajpe"
          },
          {
            "code": "IXJ",
            "location": "Jammu, India",
            "airport": "Satwari"
          },
          {
            "code": "IXM",
            "location": "Madurai, India",
            "airport": "Madurai"
          },
          {
            "code": "IXU",
            "location": "Aurangabad, India",
            "airport": "Chikkalthana"
          },
          {
            "code": "IXZ",
            "location": "Port Blair, India",
            "airport": "Port Blair"
          },
          {
            "code": "IYK",
            "location": "Inyokern, CA, USA",
            "airport": "Inyokern Airport"
          },
          {
            "code": "IZO",
            "location": "Izumo, Japan",
            "airport": ""
          },
          {
            "code": "JAC",
            "location": "Jackson Hole, WY, USA",
            "airport": "Jackson Hole Airport"
          },
          {
            "code": "JAI",
            "location": "Jaipur, India",
            "airport": "Sanganeer"
          },
          {
            "code": "JAN",
            "location": "Jackson, MS, USA",
            "airport": "Allen C Thompson Field"
          },
          {
            "code": "JAT",
            "location": "Jabat, Marshall Islands",
            "airport": "Jabat Intl"
          },
          {
            "code": "JAV",
            "location": "Ilulissat, Greenland",
            "airport": ""
          },
          {
            "code": "JAX",
            "location": "Jacksonville, FL, USA",
            "airport": "Jacksonville International Airport"
          },
          {
            "code": "JBR",
            "location": "Jonesboro, AR, USA",
            "airport": "Municipal"
          },
          {
            "code": "JCA",
            "location": "Cannes, France",
            "airport": "Mandelieu"
          },
          {
            "code": "JDH",
            "location": "Jodhpur, India",
            "airport": ""
          },
          {
            "code": "JDP",
            "location": "Paris, France",
            "airport": "Issy Les Moulineaux"
          },
          {
            "code": "JED",
            "location": "Jeddah, Saudi Arabia",
            "airport": "Jeddah International"
          },
          {
            "code": "JER",
            "location": "Jersey, Channel Islands, United Kingdom",
            "airport": "States"
          },
          {
            "code": "JFK",
            "location": "New York, NY, USA",
            "airport": "John F Kennedy Intl Airport"
          },
          {
            "code": "JGA",
            "location": "Jamnagar, India",
            "airport": ""
          },
          {
            "code": "JHB",
            "location": "Johor Bahru, Malaysia",
            "airport": "Sultan Ismail International"
          },
          {
            "code": "JHE",
            "location": "Helsingborg, Sweden",
            "airport": "Heliport"
          },
          {
            "code": "JHM",
            "location": "Kapalua, HI, USA",
            "airport": "Kapalua"
          },
          {
            "code": "JHW",
            "location": "Jamestown, NY, USA",
            "airport": "Chautauqua County Airport"
          },
          {
            "code": "JIB",
            "location": "Djibouti, Djibouti",
            "airport": "Ambouli"
          },
          {
            "code": "JKG",
            "location": "Jonkoping, Sweden",
            "airport": "Axamo"
          },
          {
            "code": "JLN",
            "location": "Joplin, MO, USA",
            "airport": "Municipal Airport"
          },
          {
            "code": "JMC",
            "location": "Sausalito, CA, USA",
            "airport": "Marin County"
          },
          {
            "code": "JMK",
            "location": "Mikonos, Greece",
            "airport": "Mikonos"
          },
          {
            "code": "JMM",
            "location": "Malmo, Sweden",
            "airport": "Malmo Harbor Heliport"
          },
          {
            "code": "JMO",
            "location": "Jomsom, Nepal",
            "airport": ""
          },
          {
            "code": "JMS",
            "location": "Jamestown, ND, USA",
            "airport": "Jamestown Municipal Airport"
          },
          {
            "code": "JNB",
            "location": "Johannesburg, South Africa",
            "airport": "Jan Smuts"
          },
          {
            "code": "JNS",
            "location": "Narssaq, Greenland",
            "airport": ""
          },
          {
            "code": "JNU",
            "location": "Juneau, AK, USA",
            "airport": "Juneau"
          },
          {
            "code": "JNX",
            "location": "Naxos, Cyclades Islands, Greece",
            "airport": "Naxos Airport"
          },
          {
            "code": "JOG",
            "location": "Yogyakarta, Indonesia",
            "airport": ""
          },
          {
            "code": "JOI",
            "location": "Joinville, Santa Catarina, Brazil",
            "airport": "Federal"
          },
          {
            "code": "JON",
            "location": "Johnston Island, US, Outlying Islands",
            "airport": ""
          },
          {
            "code": "JRA",
            "location": "New York City, NY, USA",
            "airport": ""
          },
          {
            "code": "JRO",
            "location": "Kilimanjaro, Tanzania",
            "airport": "Kilimanjaro"
          },
          {
            "code": "JSI",
            "location": "Skiathos, Greece",
            "airport": "Skiathos"
          },
          {
            "code": "JST",
            "location": "Johnstown, PA, USA",
            "airport": "Johnstown Cambria"
          },
          {
            "code": "JTR",
            "location": "Santorini/Thira Is, Greece",
            "airport": "Santorini"
          },
          {
            "code": "JUJ",
            "location": "Jujuy, Provincia Jujuy, Argentina",
            "airport": "El Cadillal"
          },
          {
            "code": "JUL",
            "location": "Juliaca, Peru",
            "airport": "Juliaca"
          },
          {
            "code": "KAB",
            "location": "Kariba, Zimbabwe",
            "airport": "Kariba"
          },
          {
            "code": "KAE",
            "location": "Kake, AK, USA",
            "airport": ""
          },
          {
            "code": "KAL",
            "location": "Kaltag, AK, USA",
            "airport": ""
          },
          {
            "code": "KAN",
            "location": "Kano, Nigeria",
            "airport": "Aminu Kano International"
          },
          {
            "code": "KAT",
            "location": "Kaitaia, New Zealand",
            "airport": "Kaitaia"
          },
          {
            "code": "KBP",
            "location": "Kiev, Ukraine",
            "airport": "Borispol"
          },
          {
            "code": "KBR",
            "location": "Kota Bharu, Malaysia",
            "airport": "Sultan Ismail Petra"
          },
          {
            "code": "KCG",
            "location": "Chignik, AK, USA",
            "airport": "Fisheries"
          },
          {
            "code": "KCH",
            "location": "Kuching, Sarawak, Malaysia",
            "airport": "Kuching"
          },
          {
            "code": "KCL",
            "location": "Chignik, AK, USA",
            "airport": "Lagoon"
          },
          {
            "code": "KEF",
            "location": "Reykjavik, Iceland",
            "airport": "Keflavik"
          },
          {
            "code": "KEH",
            "location": "Kenmore Air Harbor, WA, USA",
            "airport": ""
          },
          {
            "code": "KEJ",
            "location": "Kemerovo, Russia",
            "airport": "Kemerovo"
          },
          {
            "code": "KEL",
            "location": "Kiel, Germany",
            "airport": "Holtenau"
          },
          {
            "code": "KEM",
            "location": "Kemi/Tornio, Finland",
            "airport": "Kemi"
          },
          {
            "code": "KEP",
            "location": "Nepalganj, Nepal",
            "airport": "Nepalganj"
          },
          {
            "code": "KER",
            "location": "Kerman, Iran",
            "airport": "Kerman"
          },
          {
            "code": "KGC",
            "location": "Kingscote, South Australia, Australia",
            "airport": ""
          },
          {
            "code": "KGD",
            "location": "Kaliningrad, Russia",
            "airport": "Kaliningrad Airport"
          },
          {
            "code": "KHH",
            "location": "Kaohsiung, Taiwan",
            "airport": ""
          },
          {
            "code": "KHI",
            "location": "Karachi, Pakistan",
            "airport": "Karachi"
          },
          {
            "code": "KHV",
            "location": "Khabarovsk, Russia",
            "airport": "Novy"
          },
          {
            "code": "KIN",
            "location": "Kingston, Jamaica",
            "airport": ""
          },
          {
            "code": "KIR",
            "location": "Kerry County, Ireland",
            "airport": "Kerry County"
          },
          {
            "code": "KIV",
            "location": "Kishinev, Moldova",
            "airport": "Kishinev"
          },
          {
            "code": "KIX",
            "location": "Osaka, Japan",
            "airport": "Kansai International"
          },
          {
            "code": "KJA",
            "location": "Krasnojarsk, Russia",
            "airport": ""
          },
          {
            "code": "KKN",
            "location": "Kirkenes, Norway",
            "airport": "Hoeyburtmoen"
          },
          {
            "code": "KLO",
            "location": "Kalibo, Philippines",
            "airport": "Kalibo"
          },
          {
            "code": "KLR",
            "location": "Kalmar, Sweden",
            "airport": "Kalmar"
          },
          {
            "code": "KLU",
            "location": "Klagenfurt, Austria",
            "airport": "Klagenfurt"
          },
          {
            "code": "KLW",
            "location": "Klawock, AK, USA",
            "airport": ""
          },
          {
            "code": "KMG",
            "location": "Kunming, China",
            "airport": "Kunming"
          },
          {
            "code": "KMI",
            "location": "Miyazaki, Japan",
            "airport": "Miyazaki"
          },
          {
            "code": "KMJ",
            "location": "Kumamoto, Japan",
            "airport": "Kumamoto"
          },
          {
            "code": "KNS",
            "location": "King Island, Tasmania, Australia",
            "airport": "King Island"
          },
          {
            "code": "KOA",
            "location": "Kona, HI, USA",
            "airport": "Keahole"
          },
          {
            "code": "KOI",
            "location": "Kirkwall / Orkney Island, Scotland, United Kingdom",
            "airport": "Kirkwall"
          },
          {
            "code": "KOJ",
            "location": "Kagoshima, Japan",
            "airport": "Kagoshima"
          },
          {
            "code": "KOK",
            "location": "Kokkola/Pietarsaari, Finland",
            "airport": "Kruunupyy"
          },
          {
            "code": "KPN",
            "location": "Kipnuk, AK, USA",
            "airport": ""
          },
          {
            "code": "KPO",
            "location": "Pohang, South Korea",
            "airport": "Na"
          },
          {
            "code": "KRF",
            "location": "Kramfors, Sweden",
            "airport": "Kramfors"
          },
          {
            "code": "KRK",
            "location": "Krakow, Poland",
            "airport": "Balice"
          },
          {
            "code": "KRN",
            "location": "Kiruna, Sweden",
            "airport": "Kiruna"
          },
          {
            "code": "KRP",
            "location": "Karup, Denmark",
            "airport": "Karup"
          },
          {
            "code": "KRR",
            "location": "Krasnodar, Russia",
            "airport": "Krasnodar"
          },
          {
            "code": "KRS",
            "location": "Kristiansand, Norway",
            "airport": "Kjevik"
          },
          {
            "code": "KRT",
            "location": "Khartoum, Sudan",
            "airport": "Civil"
          },
          {
            "code": "KSA",
            "location": "Kosrae, Caroline Islands, Micronesia",
            "airport": ""
          },
          {
            "code": "KSC",
            "location": "Kosice, Slovakia",
            "airport": "Barca"
          },
          {
            "code": "KSH",
            "location": "Kermanshah, Iran",
            "airport": "Bakhtaran Iran"
          },
          {
            "code": "KSJ",
            "location": "Kasos Island, Greece",
            "airport": "Kasos Island"
          },
          {
            "code": "KSU",
            "location": "Kristiansund, Norway",
            "airport": "Kvernberget"
          },
          {
            "code": "KTM",
            "location": "Kathmandu, Nepal",
            "airport": "Tribhuvan"
          },
          {
            "code": "KTN",
            "location": "Ketchikan, AK, USA",
            "airport": "Ketchikan International"
          },
          {
            "code": "KTR",
            "location": "Katherine, Northern Territory, Australia",
            "airport": "Tindal"
          },
          {
            "code": "KTW",
            "location": "Katowice, Poland",
            "airport": "Pyrzowice"
          },
          {
            "code": "KUA",
            "location": "Kuantan, Malaysia",
            "airport": "Padang Geroda"
          },
          {
            "code": "KUF",
            "location": "Samara, Russia",
            "airport": "Samara"
          },
          {
            "code": "KUL",
            "location": "Kuala Lumpur, Malaysia",
            "airport": "Subang Kuala Lumpur International"
          },
          {
            "code": "KUN",
            "location": "Kaunas, Lithuania",
            "airport": "Kaunas"
          },
          {
            "code": "KUO",
            "location": "Kuopio, Finland",
            "airport": "Kuopio"
          },
          {
            "code": "KUS",
            "location": "Kulusuk, Greenland",
            "airport": "Metropolitan Area"
          },
          {
            "code": "KUV",
            "location": "Kunsan, South Korea",
            "airport": ""
          },
          {
            "code": "KVA",
            "location": "Kavala, Greece",
            "airport": "Kavala"
          },
          {
            "code": "KWA",
            "location": "Kwajalein, Marshall Islands",
            "airport": ""
          },
          {
            "code": "KWI",
            "location": "Kuwait, Kuwait",
            "airport": "International"
          },
          {
            "code": "KWL",
            "location": "Guilin, China",
            "airport": ""
          },
          {
            "code": "KZN",
            "location": "Kazan, Russia",
            "airport": "Kazan"
          },
          {
            "code": "LAD",
            "location": "Luanda, Angola",
            "airport": "Fevereiro"
          },
          {
            "code": "LAF",
            "location": "Lafayette, IN, USA",
            "airport": "Purdue University Airport"
          },
          {
            "code": "LAN",
            "location": "Lansing, MI, USA",
            "airport": "Capital City Airport"
          },
          {
            "code": "LAP",
            "location": "La Paz, Baja California Sur, Mexico",
            "airport": "General Marquez De Leon Airport"
          },
          {
            "code": "LAR",
            "location": "Laramie, WY, USA",
            "airport": "General Brees Field"
          },
          {
            "code": "LAS",
            "location": "Las Vegas, NV, USA",
            "airport": "Mccarran International Airport"
          },
          {
            "code": "LAW",
            "location": "Lawton, OK, USA",
            "airport": "Municipal"
          },
          {
            "code": "LAX",
            "location": "Los Angeles, CA, USA",
            "airport": "Los Angeles Intl Airport"
          },
          {
            "code": "LAX",
            "location": "Los Angeles, CA, USA",
            "airport": "Los Angeles Intl Airport"
          },
          {
            "code": "LBA",
            "location": "Leeds/Bradford, England, United Kingdom",
            "airport": ""
          },
          {
            "code": "LBB",
            "location": "Lubbock, TX, USA",
            "airport": "Lubbock International Airport"
          },
          {
            "code": "LBE",
            "location": "Latrobe, PA, USA",
            "airport": "Westmoreland County"
          },
          {
            "code": "LBF",
            "location": "North Platte, NE, USA",
            "airport": "Lee Bird Field"
          },
          {
            "code": "LBL",
            "location": "Liberal, KS, USA",
            "airport": "Glenn L Martin Terminal"
          },
          {
            "code": "LBU",
            "location": "Labuan, Sabah, Malaysia",
            "airport": ""
          },
          {
            "code": "LBV",
            "location": "Libreville, Gabon",
            "airport": "Libreville"
          },
          {
            "code": "LCA",
            "location": "Larnaca, Cyprus",
            "airport": "Intl"
          },
          {
            "code": "LCE",
            "location": "La Ceiba, Honduras",
            "airport": "International"
          },
          {
            "code": "LCG",
            "location": "La Coruna, Spain",
            "airport": "La Coruna"
          },
          {
            "code": "LCH",
            "location": "Lake Charles, LA, USA",
            "airport": "Municipal"
          },
          {
            "code": "LCY",
            "location": "London, England, United Kingdom",
            "airport": "London City"
          },
          {
            "code": "LDB",
            "location": "Londrina, Parana, Brazil",
            "airport": "Londrina"
          },
          {
            "code": "LDE",
            "location": "Lourdes/Tarbes, France",
            "airport": "Tarbes International"
          },
          {
            "code": "LDU",
            "location": "Lahad Datu, Sabah, Malaysia",
            "airport": "Lahad Datu"
          },
          {
            "code": "LEA",
            "location": "Learmonth, Western Australia, Australia",
            "airport": ""
          },
          {
            "code": "LEB",
            "location": "Lebanon/Hanover/White River, NH, USA",
            "airport": "Lebanon Regional"
          },
          {
            "code": "LED",
            "location": "St Petersburg, Russia",
            "airport": "Pulkovo"
          },
          {
            "code": "LEH",
            "location": "Le Havre, France",
            "airport": "Le Havre"
          },
          {
            "code": "LEI",
            "location": "Almeria, Spain",
            "airport": "Almeria"
          },
          {
            "code": "LEJ",
            "location": "Leipzig, Germany",
            "airport": "Leipzig"
          },
          {
            "code": "LET",
            "location": "Leticia, Colombia",
            "airport": "Gen Av Cob0"
          },
          {
            "code": "LEX",
            "location": "Lexington, KY, USA",
            "airport": "Blue Grass Field"
          },
          {
            "code": "LFT",
            "location": "Lafayette / New Iberia, LA, USA",
            "airport": "Municipal"
          },
          {
            "code": "LFW",
            "location": "Lome, Togo",
            "airport": "Lome"
          },
          {
            "code": "LGA",
            "location": "New York, NY, USA",
            "airport": "Laguardia"
          },
          {
            "code": "LGB",
            "location": "Long Beach, CA, USA",
            "airport": "Long Beach Municipal Airport"
          },
          {
            "code": "LGG",
            "location": "Liege, Belgium",
            "airport": "Bierset"
          },
          {
            "code": "LGI",
            "location": "Deadmans Cay / Long Island, Bahamas",
            "airport": "Deadmans Cay"
          },
          {
            "code": "LGK",
            "location": "Langkawi, Malaysia",
            "airport": ""
          },
          {
            "code": "LGP",
            "location": "Legaspi, Philippines",
            "airport": "Legaspi"
          },
          {
            "code": "LGW",
            "location": "London, England, United Kingdom",
            "airport": "Gatwick"
          },
          {
            "code": "LHE",
            "location": "Lahore, Pakistan",
            "airport": "Lahore"
          },
          {
            "code": "LHR",
            "location": "London, England, United Kingdom",
            "airport": "Heathrow"
          },
          {
            "code": "LIG",
            "location": "Limoges, France",
            "airport": "Bellegarde"
          },
          {
            "code": "LIH",
            "location": "Kauai Island, HI, USA",
            "airport": "Lihue Municipal Airport"
          },
          {
            "code": "LIM",
            "location": "Lima, Peru",
            "airport": "Jorge Chavez"
          },
          {
            "code": "Intl LIN",
            "location": "Milan, Italy",
            "airport": "Linate"
          },
          {
            "code": "LIR",
            "location": "Liberia, Costa Rica",
            "airport": "Liberia"
          },
          {
            "code": "LIS",
            "location": "Lisbon, Portugal",
            "airport": "Lisbon"
          },
          {
            "code": "LIT",
            "location": "Little Rock, AR, USA",
            "airport": "Little Rock Regional Airport"
          },
          {
            "code": "LJU",
            "location": "Ljubljana, Slovenia",
            "airport": "Brnik"
          },
          {
            "code": "LKE",
            "location": "Seattle, WA, USA",
            "airport": "Lake Union Sea Plane Base"
          },
          {
            "code": "LKL",
            "location": "",
            "airport": ""
          },
          {
            "code": "LKN",
            "location": "Leknes, Norway",
            "airport": "Leknes"
          },
          {
            "code": "LKO",
            "location": "Lucknow, India",
            "airport": ""
          },
          {
            "code": "LLA",
            "location": "Lulea, Sweden",
            "airport": "Kallax"
          },
          {
            "code": "LLW",
            "location": "Lilongwe, Malawi",
            "airport": "Kamuzu Intl"
          },
          {
            "code": "LLY",
            "location": "Mount Holly, NJ, USA",
            "airport": "Mt Holly"
          },
          {
            "code": "LMM",
            "location": "Los Mochis, Sinaloa, Mexico",
            "airport": ""
          },
          {
            "code": "LMN",
            "location": "Limbang, Sarawak, Malaysia",
            "airport": "Limbang"
          },
          {
            "code": "LMT",
            "location": "Klamath Falls, OR, USA",
            "airport": "Kingsley Field Airport"
          },
          {
            "code": "LNK",
            "location": "Lincoln, NE, USA",
            "airport": "Municipal Airport"
          },
          {
            "code": "LNS",
            "location": "Lancaster, PA, USA",
            "airport": "Lancaster"
          },
          {
            "code": "LNV",
            "location": "Londolovit, Papua New Guinea",
            "airport": "Londolovit"
          },
          {
            "code": "LNY",
            "location": "Lanai City, HI, USA",
            "airport": "Lanai"
          },
          {
            "code": "LNZ",
            "location": "Linz, Austria",
            "airport": "Linz"
          },
          {
            "code": "LOS",
            "location": "Lagos, Nigeria",
            "airport": "Murtala Muhammed"
          },
          {
            "code": "LOV",
            "location": "Monclova, Coahuila, Mexico",
            "airport": "Monclova Airport"
          },
          {
            "code": "LPA",
            "location": "Gran Canaria, Canary Islands, Spain",
            "airport": "Aeropuerto De Gran Canaria"
          },
          {
            "code": "LPB",
            "location": "La Paz, Bolivia",
            "airport": "El Alto"
          },
          {
            "code": "LPI",
            "location": "Linkoping, Sweden",
            "airport": "Saab"
          },
          {
            "code": "LPL",
            "location": "Liverpool, England, United Kingdom",
            "airport": "Liverpool"
          },
          {
            "code": "LRD",
            "location": "Laredo, TX, USA",
            "airport": "International"
          },
          {
            "code": "LRH",
            "location": "La Rochelle, France",
            "airport": "Laleu"
          },
          {
            "code": "LRM",
            "location": "Casa De Campo, Dominican Republic",
            "airport": ""
          },
          {
            "code": "LRS",
            "location": "Leros, Greece",
            "airport": "Leros"
          },
          {
            "code": "LRT",
            "location": "Lorient, France",
            "airport": "Lann-Bihoue"
          },
          {
            "code": "LRU",
            "location": "Las Cruces, NM, USA",
            "airport": ""
          },
          {
            "code": "LSC",
            "location": "La Serena, Chile",
            "airport": "La Florida"
          },
          {
            "code": "LSE",
            "location": "La Crosse, WI, USA",
            "airport": "La Crosse Municipal"
          },
          {
            "code": "LSI",
            "location": "Shetland Islands /Shetland Isd, Scotland, United Kingdom",
            "airport": "Shetland Islands"
          },
          {
            "code": "LSP",
            "location": "Las Piedras, Venezuela",
            "airport": "Josefa Camejo"
          },
          {
            "code": "LSQ",
            "location": "Los Angeles, Chile",
            "airport": "Maria Dolores"
          },
          {
            "code": "LSS",
            "location": "Terre-De-Haut, Guadeloupe",
            "airport": ""
          },
          {
            "code": "LST",
            "location": "Launceston, Tasmania, Australia",
            "airport": "Launceston"
          },
          {
            "code": "LSY",
            "location": "Lismore, New South Wales, Australia",
            "airport": "Lismore"
          },
          {
            "code": "LTN",
            "location": "London, England, United Kingdom",
            "airport": "Luton International"
          },
          {
            "code": "LTO",
            "location": "Loreto, Baja California Sur, Mexico",
            "airport": ""
          },
          {
            "code": "LUA",
            "location": "Lukla, Nepal",
            "airport": "Lukla"
          },
          {
            "code": "LUD",
            "location": "Luderitz, Namibia",
            "airport": "Luderitz"
          },
          {
            "code": "LUG",
            "location": "Lugano, Switzerland",
            "airport": "Agno"
          },
          {
            "code": "LUN",
            "location": "Lusaka, Zambia",
            "airport": "Lusaka"
          },
          {
            "code": "LUX",
            "location": "Luxembourg, Luxembourg",
            "airport": "Findel"
          },
          {
            "code": "LVI",
            "location": "Livingstone, Zambia",
            "airport": "Livingstone"
          },
          {
            "code": "LWB",
            "location": "Greenbrier, WV, USA",
            "airport": "Greenbrier Valley Airport"
          },
          {
            "code": "LWK",
            "location": "Shetland Islands /Shetland Isd, Scotland, United Kingdom",
            "airport": "Tingwall"
          },
          {
            "code": "LWO",
            "location": "Lvov, Ukraine",
            "airport": "Snilow"
          },
          {
            "code": "LWS",
            "location": "Lewiston, ID, USA",
            "airport": "Lewiston-Nez Perce Airport"
          },
          {
            "code": "LWT",
            "location": "Lewistown, MT, USA",
            "airport": "Municipal"
          },
          {
            "code": "LWY",
            "location": "Lawas, Sarawak, Malaysia",
            "airport": "Lawas"
          },
          {
            "code": "LXR",
            "location": "Luxor, Egypt",
            "airport": "Luxor"
          },
          {
            "code": "LYH",
            "location": "Lynchburg, VA, USA",
            "airport": "Municipal Airport"
          },
          {
            "code": "LYP",
            "location": "Faisalabad, Pakistan",
            "airport": "Lyallpur"
          },
          {
            "code": "LYR",
            "location": "Longyearbyen, Norway",
            "airport": "Svalbard"
          },
          {
            "code": "LYS",
            "location": "Lyon, France",
            "airport": "Satolas"
          },
          {
            "code": "LZC",
            "location": "Lazaro Cardenas, Michoacan, Mexico",
            "airport": "Na"
          },
          {
            "code": "MAA",
            "location": "Madras, India",
            "airport": "Meenambarkkam"
          },
          {
            "code": "MAD",
            "location": "Madrid, Spain",
            "airport": "Barajas"
          },
          {
            "code": "MAF",
            "location": "Midland/Odessa, TX, USA",
            "airport": "Midland Intl Airport"
          },
          {
            "code": "MAG",
            "location": "Madang, Papua New Guinea",
            "airport": "Madang"
          },
          {
            "code": "MAH",
            "location": "Menorca, Spain",
            "airport": "Aerop De Menorca"
          },
          {
            "code": "MAJ",
            "location": "Majuro, Marshall Islands",
            "airport": "International"
          },
          {
            "code": "MAM",
            "location": "Matamoros, Tamaulipas, Mexico",
            "airport": "Servando Canales"
          },
          {
            "code": "MAN",
            "location": "Manchester, England, United Kingdom",
            "airport": "International"
          },
          {
            "code": "MAO",
            "location": "Manaus, Amazonas, Brazil",
            "airport": "Eduardo Gomes"
          },
          {
            "code": "MAR",
            "location": "Maracaibo, Venezuela",
            "airport": "La Chinita"
          },
          {
            "code": "MAY",
            "location": "Mangrove Cay, Bahamas",
            "airport": ""
          },
          {
            "code": "MAZ",
            "location": "Mayaguez, PR, USA",
            "airport": "El Maui"
          },
          {
            "code": "MBA",
            "location": "Mombasa, Kenya",
            "airport": "Moi International"
          },
          {
            "code": "MBJ",
            "location": "Montego Bay, Jamaica",
            "airport": "Sangster"
          },
          {
            "code": "MBL",
            "location": "Manistee, MI, USA",
            "airport": "Manistee Blacker Airport"
          },
          {
            "code": "MBS",
            "location": "Midland / Bay City / Saginaw, MI, USA",
            "airport": "Tri-City Airport"
          },
          {
            "code": "MCG",
            "location": "Mc Grath, AK, USA",
            "airport": "Mc Grath"
          },
          {
            "code": "MCI",
            "location": "Kansas City, MO, USA",
            "airport": "Kansas City International Airport"
          },
          {
            "code": "MCK",
            "location": "Mc Cook, NE, USA",
            "airport": "Municipal"
          },
          {
            "code": "MCM",
            "location": "Monte Carlo, Monaco",
            "airport": "Hel De Monte Carlo"
          },
          {
            "code": "MCN",
            "location": "Macon, GA, USA",
            "airport": "Lewis B Wilson"
          },
          {
            "code": "MCO",
            "location": "Orlando, FL, USA",
            "airport": "Orlando International Airport"
          },
          {
            "code": "MCP",
            "location": "Macapa, Amapa, Brazil",
            "airport": ""
          },
          {
            "code": "MCT",
            "location": "Muscat, Oman",
            "airport": "Seeb"
          },
          {
            "code": "MCW",
            "location": "Mason City, IA, USA",
            "airport": "Mason City Municipal Airport"
          },
          {
            "code": "MCY",
            "location": "Sunshine Coast, Queensland, Australia",
            "airport": "Maroochydore"
          },
          {
            "code": "MDC",
            "location": "Manado, Indonesia",
            "airport": "Samratulang"
          },
          {
            "code": "MDE",
            "location": "Medellin, Colombia",
            "airport": "La Playas"
          },
          {
            "code": "MDH",
            "location": "Carbondale, IL, USA",
            "airport": "Southern Illinois Airport"
          },
          {
            "code": "MDQ",
            "location": "Mar Del Plata, Buenos Aires, Argentina",
            "airport": ""
          },
          {
            "code": "MDT",
            "location": "Harrisburg, PA, USA",
            "airport": "Harrisburg International Airport"
          },
          {
            "code": "MDW",
            "location": "Chicago, IL, USA",
            "airport": "Midway"
          },
          {
            "code": "MDZ",
            "location": "Mendoza, Mendoza, Argentina",
            "airport": "El Plumerillo"
          },
          {
            "code": "MED",
            "location": "Medinah, Saudi Arabia",
            "airport": "Madinah-Prince Mohammad Bin Abdulaziz"
          },
          {
            "code": "MEI",
            "location": "Meridian, MS, USA",
            "airport": "Key Field"
          },
          {
            "code": "MEL",
            "location": "Melbourne, Victoria, Australia",
            "airport": "Tullamarine"
          },
          {
            "code": "MEM",
            "location": "Memphis, TN, USA",
            "airport": "Memphis International Airport"
          },
          {
            "code": "MES",
            "location": "Medan, Indonesia",
            "airport": "Poland"
          },
          {
            "code": "MEX",
            "location": "Mexico City, Distrito Federal, Mexico",
            "airport": "Juarez Intl Airport"
          },
          {
            "code": "MEY",
            "location": "Meghauli, Nepal",
            "airport": "Meghauli"
          },
          {
            "code": "MFE",
            "location": "Mc Allen/Mission, TX, USA",
            "airport": ""
          },
          {
            "code": "MFN",
            "location": "Milford Sound, New Zealand",
            "airport": ""
          },
          {
            "code": "MFR",
            "location": "Medford, OR, USA",
            "airport": "Medford-Jackson County Airport"
          },
          {
            "code": "MGA",
            "location": "Managua, Nicaragua",
            "airport": ""
          },
          {
            "code": "MGM",
            "location": "Montgomery, AL, USA",
            "airport": "Dannelly Field"
          },
          {
            "code": "MGQ",
            "location": "Mogadishu, Somalia",
            "airport": ""
          },
          {
            "code": "MGW",
            "location": "Morgantown, WV, USA",
            "airport": "Morgantown Municipal Airport"
          },
          {
            "code": "MHH",
            "location": "Marsh Harbour, Bahamas",
            "airport": ""
          },
          {
            "code": "MHK",
            "location": "Manhattan, KS, USA",
            "airport": "Manhattan Municipal"
          },
          {
            "code": "MHQ",
            "location": "Mariehamn, Aland Island, Finland",
            "airport": ""
          },
          {
            "code": "MHT",
            "location": "Manchester, NH, USA",
            "airport": "Manchester"
          },
          {
            "code": "MIA",
            "location": "Miami, FL, USA",
            "airport": "Miami International Airport"
          },
          {
            "code": "MID",
            "location": "Merida, Yucatan, Mexico",
            "airport": "Merida Internationl"
          },
          {
            "code": "MIE",
            "location": "Muncie, IN, USA",
            "airport": "Delaware County Airport"
          },
          {
            "code": "MIR",
            "location": "Monastir, Tunisia",
            "airport": "Skanes"
          },
          {
            "code": "MJT",
            "location": "Mytilene, Greece",
            "airport": "Mytilene"
          },
          {
            "code": "MJV",
            "location": "Murcia, Spain",
            "airport": "San Javier"
          },
          {
            "code": "MKC",
            "location": "Kansas City, MO, USA",
            "airport": "Downtown"
          },
          {
            "code": "MKE",
            "location": "Milwaukee, WI, USA",
            "airport": "General Mitchell Field"
          },
          {
            "code": "MKG",
            "location": "Muskegon, MI, USA",
            "airport": "Muskegon County Intl Airport"
          },
          {
            "code": "MKK",
            "location": "Hoolehua, HI, USA",
            "airport": "Municipal"
          },
          {
            "code": "MKL",
            "location": "Jackson, TN, USA",
            "airport": "Mc Kellar Field"
          },
          {
            "code": "MKM",
            "location": "Mukah, Sarawak, Malaysia",
            "airport": ""
          },
          {
            "code": "MKW",
            "location": "Manokwari, Indonesia",
            "airport": "Rendani"
          },
          {
            "code": "MKY",
            "location": "Mackay, Queensland, Australia",
            "airport": "Mackay"
          },
          {
            "code": "MLA",
            "location": "Malta, Malta",
            "airport": "Luqa"
          },
          {
            "code": "MLB",
            "location": "Melbourne, FL, USA",
            "airport": "Melbourne Regional Airport"
          },
          {
            "code": "MLE",
            "location": "Male, Maldives",
            "airport": "Male International"
          },
          {
            "code": "MLG",
            "location": "Malang, Indonesia",
            "airport": ""
          },
          {
            "code": "MLH",
            "location": "Mulhouse, France",
            "airport": "Mulhouse"
          },
          {
            "code": "MLI",
            "location": "Moline, IL, USA",
            "airport": "Quad City Airport"
          },
          {
            "code": "MLM",
            "location": "Morelia, Michoacan, Mexico",
            "airport": "Municipal"
          },
          {
            "code": "MLO",
            "location": "Milos, Greece",
            "airport": "Milos"
          },
          {
            "code": "MLS",
            "location": "Miles City, MT, USA",
            "airport": "Miles City"
          },
          {
            "code": "MLU",
            "location": "Monroe, LA, USA",
            "airport": ""
          },
          {
            "code": "MMB",
            "location": "Memanbetsu, Japan",
            "airport": ""
          },
          {
            "code": "MME",
            "location": "Teesside, England, United Kingdom",
            "airport": "Tees-Side"
          },
          {
            "code": "MMH",
            "location": "Mammoth Lakes, CA, USA",
            "airport": "Mammoth Lakes Airport"
          },
          {
            "code": "MMK",
            "location": "Murmansk, Russia",
            "airport": "Murmansk"
          },
          {
            "code": "MMU",
            "location": "Morristown, NJ, USA",
            "airport": "Morristown"
          },
          {
            "code": "MMX",
            "location": "Malmo, Sweden",
            "airport": "Sturup"
          },
          {
            "code": "MNI",
            "location": "Montserrat, Montserrat",
            "airport": "Blackburne"
          },
          {
            "code": "MNL",
            "location": "Manila, Philippines",
            "airport": "Ninoy Aquino International"
          },
          {
            "code": "MNM",
            "location": "Menominee, MI, USA",
            "airport": "Twin County Airport"
          },
          {
            "code": "MOB",
            "location": "Mobile, AL, USA",
            "airport": "Mobile Municipal"
          },
          {
            "code": "MOD",
            "location": "Modesto, CA, USA",
            "airport": "Harry Sham Feild"
          },
          {
            "code": "MOL",
            "location": "Molde, Norway",
            "airport": "Aro"
          },
          {
            "code": "MOT",
            "location": "Minot, ND, USA",
            "airport": "Minot International Airport"
          },
          {
            "code": "MOW",
            "location": "Moscow, Russia",
            "airport": ""
          },
          {
            "code": "MPA",
            "location": "Mpacha, Namibia",
            "airport": ""
          },
          {
            "code": "MPB",
            "location": "Miami, FL, USA",
            "airport": "Miami Public Seaplane Base"
          },
          {
            "code": "MPL",
            "location": "Montpellier, France",
            "airport": "Frejorgues"
          },
          {
            "code": "MPM",
            "location": "Maputo, Mozambique",
            "airport": "Maputo International"
          },
          {
            "code": "MQL",
            "location": "Mildura, Victoria, Australia",
            "airport": "Mildura"
          },
          {
            "code": "MQN",
            "location": "Mo I Rana, Norway",
            "airport": "Rossvoll"
          },
          {
            "code": "MQT",
            "location": "Marquette, MI, USA",
            "airport": "Marquette County Airport"
          },
          {
            "code": "MRD",
            "location": "Merida, Venezuela",
            "airport": "Alberto Carnevalli"
          },
          {
            "code": "MRK",
            "location": "Marco Island, FL, USA",
            "airport": ""
          },
          {
            "code": "MRS",
            "location": "Marseille, France",
            "airport": "Marseille-Provence"
          },
          {
            "code": "MRU",
            "location": "Mauritius, Mauritius",
            "airport": "Plaisance"
          },
          {
            "code": "MRY",
            "location": "Monterey / Carmel, CA, USA",
            "airport": "Monterey Peninsula Airport"
          },
          {
            "code": "MSJ",
            "location": "Misawa, Japan",
            "airport": ""
          },
          {
            "code": "MSL",
            "location": "Muscle Shoals / Florence / Sheffield, AL, USA",
            "airport": "Muscle Shoals"
          },
          {
            "code": "MSN",
            "location": "Madison, WI, USA",
            "airport": "Dane County Regional Airport"
          },
          {
            "code": "MSO",
            "location": "Missoula, MT, USA",
            "airport": "Missoula International"
          },
          {
            "code": "MSP",
            "location": "Minneapolis, MN, USA",
            "airport": "Minneapolis/St Paul Intl Airport"
          },
          {
            "code": "MSQ",
            "location": "Minsk, Belarus",
            "airport": "Minsk"
          },
          {
            "code": "MSS",
            "location": "Massena, NY, USA",
            "airport": ""
          },
          {
            "code": "MST",
            "location": "Maastricht, Netherlands",
            "airport": "Zuid-Limburg"
          },
          {
            "code": "MSU",
            "location": "Maseru, Lesotho",
            "airport": "Maseru"
          },
          {
            "code": "MSY",
            "location": "New Orleans, LA, USA",
            "airport": "Moisant International Airport"
          },
          {
            "code": "MTH",
            "location": "Marathon, FL, USA",
            "airport": ""
          },
          {
            "code": "MTJ",
            "location": "Montrose, CO, USA",
            "airport": "Montrose County Airport"
          },
          {
            "code": "MTY",
            "location": "Monterrey, Nuevo Leon, Mexico",
            "airport": "Escobedo"
          },
          {
            "code": "MUB",
            "location": "Maun, Botswana",
            "airport": ""
          },
          {
            "code": "MUC",
            "location": "Munich, Germany",
            "airport": "Franz Josef Strauss"
          },
          {
            "code": "MUN",
            "location": "Maturin, Venezuela",
            "airport": ""
          },
          {
            "code": "MVD",
            "location": "Montevideo, Uruguay",
            "airport": "Carrasco"
          },
          {
            "code": "MVN",
            "location": "Mount Vernon, IL, USA",
            "airport": "Mount Vernon Outland Airport"
          },
          {
            "code": "MVY",
            "location": "Marthas Vineyard, MA, USA",
            "airport": ""
          },
          {
            "code": "MWA",
            "location": "Marion, IL, USA",
            "airport": ""
          },
          {
            "code": "MXL",
            "location": "Mexicali, Baja California, Mexico",
            "airport": "Rodolfo Sanchez Taboada"
          },
          {
            "code": "MXP",
            "location": "Milan, Italy",
            "airport": "Malpensa"
          },
          {
            "code": "MYA",
            "location": "Moruya, New South Wales, Australia",
            "airport": "Moruya"
          },
          {
            "code": "MYJ",
            "location": "Matsuyama, Japan",
            "airport": "Matsuyama"
          },
          {
            "code": "MYR",
            "location": "Myrtle Beach, SC, USA",
            "airport": ""
          },
          {
            "code": "MYY",
            "location": "Miri, Sarawak, Malaysia",
            "airport": "Miri"
          },
          {
            "code": "MZL",
            "location": "Manizales, Colombia",
            "airport": "Santaguida"
          },
          {
            "code": "MZT",
            "location": "Mazatlan, Sinaloa, Mexico",
            "airport": "Buelna"
          },
          {
            "code": "MZV",
            "location": "Mulu, Malaysia",
            "airport": "Mulu Airport"
          },
          {
            "code": "NAG",
            "location": "Nagpur, India",
            "airport": "Sonegaon"
          },
          {
            "code": "NAH",
            "location": "Naha, Indonesia",
            "airport": ""
          },
          {
            "code": "NAK",
            "location": "Nakhon Ratchasima, Thailand",
            "airport": "Nakhon Ratchasima"
          },
          {
            "code": "NAN",
            "location": "Nadi, Fiji",
            "airport": "International"
          },
          {
            "code": "NAP",
            "location": "Naples, Italy",
            "airport": "Capodichino"
          },
          {
            "code": "NAS",
            "location": "Nassau, Bahamas",
            "airport": "Nassau International Airport"
          },
          {
            "code": "NAT",
            "location": "Natal, Rio Grande Do Norte, Brazil",
            "airport": "Agusto Severo"
          },
          {
            "code": "NAY",
            "location": "Beijing, China",
            "airport": ""
          },
          {
            "code": "NBO",
            "location": "Nairobi, Kenya",
            "airport": "Jomo Kenyatta Internatonal"
          },
          {
            "code": "NCA",
            "location": "North Caicos, Turks And Caicos Islands",
            "airport": ""
          },
          {
            "code": "NCE",
            "location": "Nice, France",
            "airport": "Cote D'azur"
          },
          {
            "code": "NCL",
            "location": "Newcastle, England, United Kingdom",
            "airport": "International"
          },
          {
            "code": "NCY",
            "location": "Annecy, France",
            "airport": "Annecy-Meythe"
          },
          {
            "code": "NDJ",
            "location": "N Djamena, Chad",
            "airport": "N'djamena"
          },
          {
            "code": "NEC",
            "location": "Necochea, Buenos Aires, Argentina",
            "airport": "Necochea"
          },
          {
            "code": "NEV",
            "location": "Nevis, Leeward Islands, Saint Kitts And Nevis",
            "airport": ""
          },
          {
            "code": "NGO",
            "location": "Nagoya, Japan",
            "airport": "Komaki"
          },
          {
            "code": "NGS",
            "location": "Nagasaki, Japan",
            "airport": "Nagasaki"
          },
          {
            "code": "NJC",
            "location": "Nizhnevartovsk, Russia",
            "airport": "Nizhnevartovsk"
          },
          {
            "code": "NKC",
            "location": "Nouakchott, Mauritania",
            "airport": "Nouakchott"
          },
          {
            "code": "NKG",
            "location": "Nanjing, China",
            "airport": ""
          },
          {
            "code": "NLA",
            "location": "Ndola, Zambia",
            "airport": "Ndola"
          },
          {
            "code": "NLD",
            "location": "Nuevo Laredo, Tamaulipas, Mexico",
            "airport": ""
          },
          {
            "code": "NLP",
            "location": "Nelspruit, South Africa",
            "airport": ""
          },
          {
            "code": "NNG",
            "location": "Nanning, China",
            "airport": ""
          },
          {
            "code": "NOC",
            "location": "Connaught, Ireland",
            "airport": "Rep Of Ireland"
          },
          {
            "code": "NOU",
            "location": "Noumea, New Caledonia",
            "airport": "Tontouta"
          },
          {
            "code": "NPL",
            "location": "New Plymouth, New Zealand",
            "airport": "New Plymouth"
          },
          {
            "code": "NQY",
            "location": "Newquay, England, United Kingdom",
            "airport": "Newquay Civil"
          },
          {
            "code": "NRT",
            "location": "Tokyo, Japan",
            "airport": "Narita"
          },
          {
            "code": "NRT",
            "location": "Tokyo, Japan",
            "airport": ""
          },
          {
            "code": "NSB",
            "location": "Bimini, Bahamas",
            "airport": "North Seaplane Base"
          },
          {
            "code": "NSI",
            "location": "Yaounde, Cameroon",
            "airport": "Nsimalen"
          },
          {
            "code": "NSN",
            "location": "Nelson, New Zealand",
            "airport": "Nelson"
          },
          {
            "code": "NTE",
            "location": "Nantes, France",
            "airport": "Nantes-Chateau Bougon"
          },
          {
            "code": "NTL",
            "location": "Newcastle, New South Wales, Australia",
            "airport": "Williamtown"
          },
          {
            "code": "NUE",
            "location": "Nuremberg, Germany",
            "airport": "Nuremberg"
          },
          {
            "code": "NVT",
            "location": "Navegantes, Santa Catarina, Brazil",
            "airport": ""
          },
          {
            "code": "NWA",
            "location": "Moheli, Comoros",
            "airport": ""
          },
          {
            "code": "NWI",
            "location": "Norwich, England, United Kingdom",
            "airport": "Norwich"
          },
          {
            "code": "OAG",
            "location": "Orange, New South Wales, Australia",
            "airport": "Springhill"
          },
          {
            "code": "OAJ",
            "location": "Jacksonville, NC, USA",
            "airport": ""
          },
          {
            "code": "OAK",
            "location": "Oakland, CA, USA",
            "airport": "Metropolitan Oakland Intl Apt"
          },
          {
            "code": "OAX",
            "location": "Oaxaca, Oaxaca, Mexico",
            "airport": "Xoxocotlan"
          },
          {
            "code": "OBO",
            "location": "Obihiro, Japan",
            "airport": "Obihiro"
          },
          {
            "code": "ODE",
            "location": "Odense, Denmark",
            "airport": "Odense"
          },
          {
            "code": "ODS",
            "location": "Odessa, Ukraine",
            "airport": "Central"
          },
          {
            "code": "ODW",
            "location": "Oak Harbor, WA, USA",
            "airport": ""
          },
          {
            "code": "OFK",
            "location": "Norfolk, NE, USA",
            "airport": "Karl Stefan Memorial Airport"
          },
          {
            "code": "OGG",
            "location": "Kahului, HI, USA",
            "airport": "Kahului Airport"
          },
          {
            "code": "OGS",
            "location": "Ogdensburg, NY, USA",
            "airport": ""
          },
          {
            "code": "OHD",
            "location": "Ohrid, Macedonia",
            "airport": "Ohrid"
          },
          {
            "code": "OIT",
            "location": "Oita, Japan",
            "airport": "Oita"
          },
          {
            "code": "OKA",
            "location": "Okinawa, Ryukyu Islands, Japan",
            "airport": "Naha Field"
          },
          {
            "code": "OKC",
            "location": "Oklahoma City, OK, USA",
            "airport": "Will Rogers World Airport"
          },
          {
            "code": "OKJ",
            "location": "Okayama, Japan",
            "airport": "Okayama"
          },
          {
            "code": "OLF",
            "location": "Wolf Point, MT, USA",
            "airport": ""
          },
          {
            "code": "OMA",
            "location": "Omaha, NE, USA",
            "airport": "Eppley Airfield"
          },
          {
            "code": "OME",
            "location": "Nome, AK, USA",
            "airport": ""
          },
          {
            "code": "OMR",
            "location": "Oradea, Romania",
            "airport": "Oradea"
          },
          {
            "code": "NGO",
            "location": "Mornington, Queensland, Australia",
            "airport": "Mornington Is"
          },
          {
            "code": "ONT",
            "location": "Ontario, CA, USA",
            "airport": "Ontario International"
          },
          {
            "code": "OOK",
            "location": "Toksook Bay, AK, USA",
            "airport": ""
          },
          {
            "code": "OOL",
            "location": "Gold Coast, Queensland, Australia",
            "airport": "Coolangatta"
          },
          {
            "code": "OOM",
            "location": "Cooma, New South Wales, Australia",
            "airport": ""
          },
          {
            "code": "OPF",
            "location": "Miami, FL, USA",
            "airport": "Opa Locka"
          },
          {
            "code": "OPO",
            "location": "Porto, Portugal",
            "airport": "Porto"
          },
          {
            "code": "ORB",
            "location": "Orebro, Sweden",
            "airport": "Orebro"
          },
          {
            "code": "ORD",
            "location": "Chicago, IL, USA",
            "airport": "O'hare International Airport"
          },
          {
            "code": "ORF",
            "location": "Norfolk, VA, USA",
            "airport": "Norfolk International Airport"
          },
          {
            "code": "ORH",
            "location": "Worcester, MA, USA",
            "airport": "Worcester /James D O'brien Field"
          },
          {
            "code": "ORK",
            "location": "Cork, Ireland",
            "airport": "Cork"
          },
          {
            "code": "ORL",
            "location": "Orlando, FL, USA",
            "airport": "Herndon"
          },
          {
            "code": "ORN",
            "location": "Oran, Algeria",
            "airport": "Es Senia"
          },
          {
            "code": "ORY",
            "location": "Paris, France",
            "airport": "Orly"
          },
          {
            "code": "OSA",
            "location": "Osaka, Japan",
            "airport": "Osaka International"
          },
          {
            "code": "OSD",
            "location": "Ostersund, Sweden",
            "airport": "Froesoe"
          },
          {
            "code": "OSH",
            "location": "Oshkosh, WI, USA",
            "airport": "Wittman Field"
          },
          {
            "code": "OTH",
            "location": "North Bend, OR, USA",
            "airport": ""
          },
          {
            "code": "OTM",
            "location": "Ottumwa, IA, USA",
            "airport": "Ottumwa Industrial Airport"
          },
          {
            "code": "OTP",
            "location": "Bucharest, Romania",
            "airport": "Otopeni"
          },
          {
            "code": "OTZ",
            "location": "Kotzebue, AK, USA",
            "airport": ""
          },
          {
            "code": "OUA",
            "location": "Ouagadougou, Burkina Faso",
            "airport": "Ouagadougou"
          },
          {
            "code": "OUL",
            "location": "Oulu, Finland",
            "airport": "Oulu"
          },
          {
            "code": "OVB",
            "location": "Novosibirsk, Russia",
            "airport": "Tolmachevo"
          },
          {
            "code": "OVD",
            "location": "Asturias, Spain",
            "airport": "Asturias"
          },
          {
            "code": "OWB",
            "location": "Owensboro, KY, USA",
            "airport": ""
          },
          {
            "code": "OWD",
            "location": "Norwood, MA, USA",
            "airport": "Memorial Code: Owd"
          },
          {
            "code": "OXB",
            "location": "Bissau, Guinea-Bissau",
            "airport": "Osvaldo Vieira"
          },
          {
            "code": "OXR",
            "location": "Oxnard / Ventura, CA, USA",
            "airport": "Oxnard Airport"
          },
          {
            "code": "OZZ",
            "location": "Ouarzazate, Morocco",
            "airport": "Ouarzazate"
          },
          {
            "code": "PAD",
            "location": "Paderborn, Germany",
            "airport": "Paderborn"
          },
          {
            "code": "PAH",
            "location": "Paducah, KY, USA",
            "airport": ""
          },
          {
            "code": "PAP",
            "location": "Port Au Prince, Haiti",
            "airport": "Mais Gate"
          },
          {
            "code": "PAR",
            "location": "Paris, France",
            "airport": ""
          },
          {
            "code": "PAS",
            "location": "Paros, Greece",
            "airport": "Paros Community"
          },
          {
            "code": "PAT",
            "location": "Patna, India",
            "airport": "Patna"
          },
          {
            "code": "PEACE",
            "location": "Poza Rica, Veracruz, Mexico",
            "airport": ""
          },
          {
            "code": "PBC",
            "location": "Puebla, Puebla, Mexico",
            "airport": ""
          },
          {
            "code": "PBI",
            "location": "West Palm Beach, FL, USA",
            "airport": "Palm Beach International Airport"
          },
          {
            "code": "PBM",
            "location": "Paramaribo, Suriname",
            "airport": "Zanderij Intl"
          },
          {
            "code": "PBO",
            "location": "Paraburdoo, Western Australia, Australia",
            "airport": "Paraburdoo"
          },
          {
            "code": "PCL",
            "location": "Pucallpa, Peru",
            "airport": "Captain Rolden"
          },
          {
            "code": "PCT",
            "location": "Princeton, NJ, USA",
            "airport": "Princeton Municipal"
          },
          {
            "code": "PDG",
            "location": "Padang, Indonesia",
            "airport": "Tabing"
          },
          {
            "code": "PDL",
            "location": "Ponta Delgada, Azores Islands, Portugal",
            "airport": "Nordela"
          },
          {
            "code": "PDT",
            "location": "Pendleton, OR, USA",
            "airport": ""
          },
          {
            "code": "PDX",
            "location": "Portland, OR, USA",
            "airport": "Portland International Airport"
          },
          {
            "code": "PEE",
            "location": "Perm, Russia",
            "airport": "Perm"
          },
          {
            "code": "PEG",
            "location": "Perugia, Italy",
            "airport": "Na"
          },
          {
            "code": "PEI",
            "location": "Pereira, Colombia",
            "airport": "Matecana"
          },
          {
            "code": "PEK",
            "location": "Beijing, China",
            "airport": "Peking Capital Airport"
          },
          {
            "code": "PEN",
            "location": "Penang, Malaysia",
            "airport": "Penang International"
          },
          {
            "code": "PER",
            "location": "Perth, Western Australia, Australia",
            "airport": "Perth"
          },
          {
            "code": "PES",
            "location": "Petrozavodsk, Russia",
            "airport": "Petrozavodsk Airport"
          },
          {
            "code": "PEW",
            "location": "Peshawar, Pakistan",
            "airport": "Peshawar"
          },
          {
            "code": "PFN",
            "location": "Panama City, FL, USA",
            "airport": ""
          },
          {
            "code": "PFO",
            "location": "Paphos, Cyprus",
            "airport": "International"
          },
          {
            "code": "PGA",
            "location": "Page, AZ, USA",
            "airport": ""
          },
          {
            "code": "PGF",
            "location": "Perpignan, France",
            "airport": "Llabanere"
          },
          {
            "code": "PGV",
            "location": "Greenville, NC, USA",
            "airport": ""
          },
          {
            "code": "PGX",
            "location": "Perigueux, France",
            "airport": ""
          },
          {
            "code": "PHE",
            "location": "Port Hedland, Western Australia, Australia",
            "airport": "Port Hedlan"
          },
          {
            "code": "PHF",
            "location": "Newport News/Williamsburg/Hampton, VA, USA",
            "airport": "Patrick Henry Intl"
          },
          {
            "code": "PHL",
            "location": "Philadelphia, PA, USA",
            "airport": "Philadelphia International Airport"
          },
          {
            "code": "PHO",
            "location": "Point Hope, AK, USA",
            "airport": "Point Hope"
          },
          {
            "code": "PHS",
            "location": "Phitsanulok, Thailand",
            "airport": ""
          },
          {
            "code": "PHX",
            "location": "Phoenix, AZ, USA",
            "airport": "Sky Harbor International Airport"
          },
          {
            "code": "PIA",
            "location": "Peoria, IL, USA",
            "airport": "Greater Peoria Airport"
          },
          {
            "code": "PIB",
            "location": "Laurel, MS, USA",
            "airport": "Laurel Hattiesburg/Camp Shelby"
          },
          {
            "code": "PID",
            "location": "Nassau, Bahamas",
            "airport": "Paradise Island"
          },
          {
            "code": "PIE",
            "location": "St Petersburg/Clearwater, FL, USA",
            "airport": "St Petersburg/Clearwater Intl"
          },
          {
            "code": "PIH",
            "location": "Pocatello, ID, USA",
            "airport": ""
          },
          {
            "code": "PIK",
            "location": "Glasgow, Scotland, United Kingdom",
            "airport": "Prestwick"
          },
          {
            "code": "PIR",
            "location": "Pierre, SD, USA",
            "airport": "Pierre Municipal Airport"
          },
          {
            "code": "PIT",
            "location": "Pittsburgh, PA, USA",
            "airport": "Greater Pit Intnl Airport"
          },
          {
            "code": "PIW",
            "location": "Pikwitonei, Manitoba, Canada",
            "airport": ""
          },
          {
            "code": "PJG",
            "location": "Panjgur, Pakistan",
            "airport": ""
          },
          {
            "code": "PKB",
            "location": "Parkersburg / Marietta, WV, USA",
            "airport": "Wood County"
          },
          {
            "code": "PKC",
            "location": "Petropavlovsk-Kamchatsky, Russia",
            "airport": "Petropavlovsk-Kamchatsky"
          },
          {
            "code": "PKE",
            "location": "Parkes, New South Wales, Australia",
            "airport": "Parkes"
          },
          {
            "code": "PKR",
            "location": "Pokhara, Nepal",
            "airport": "Pokhara"
          },
          {
            "code": "PKU",
            "location": "Pekanbaru, Indonesia",
            "airport": "Simpang Tiga"
          },
          {
            "code": "PLB",
            "location": "Plattsburgh, NY, USA",
            "airport": ""
          },
          {
            "code": "PLH",
            "location": "Plymouth, England, United Kingdom",
            "airport": "Plymouth Airport"
          },
          {
            "code": "PLM",
            "location": "Palembang, Indonesia",
            "airport": "Sultan Mahmud Badaruddin Ii"
          },
          {
            "code": "PLN",
            "location": "Pellston, MI, USA",
            "airport": "Pellston Regional Airport"
          },
          {
            "code": "PLO",
            "location": "Port Lincoln, South Australia, Australia",
            "airport": "Port Lincoln"
          },
          {
            "code": "PLQ",
            "location": "Palanga, Lithuania",
            "airport": "Palanga"
          },
          {
            "code": "PLS",
            "location": "Providenciales, Turks And Caicos Islands",
            "airport": ""
          },
          {
            "code": "PLU",
            "location": "Belo Horizonte /Belo Horizon, Minas Gerais, Brazil",
            "airport": "Confins/Pampulha"
          },
          {
            "code": "PLW",
            "location": "Palu, Indonesia",
            "airport": "Mutiara"
          },
          {
            "code": "PLZ",
            "location": "Port Elizabeth, South Africa",
            "airport": "Hf Verwoerd"
          },
          {
            "code": "PMC",
            "location": "Puerto Montt, Chile",
            "airport": "Tepual"
          },
          {
            "code": "PMD",
            "location": "Palmdale, CA, USA",
            "airport": "Air Force 42"
          },
          {
            "code": "PMI",
            "location": "Palma Mallorca, Mallorca Island, Spain",
            "airport": "Palma Mallorca"
          },
          {
            "code": "PMO",
            "location": "Palermo, Sicily, Italy",
            "airport": "Punta Raisi"
          },
          {
            "code": "PMR",
            "location": "Palmerston North, New Zealand",
            "airport": "Palmerstown North"
          },
          {
            "code": "PMV",
            "location": "Porlamar, Venezuela",
            "airport": "Gral Santiago Marino"
          },
          {
            "code": "PNA",
            "location": "Pamplona, Spain",
            "airport": "Pamplona"
          },
          {
            "code": "PNC",
            "location": "Ponca City, OK, USA",
            "airport": ""
          },
          {
            "code": "PNH",
            "location": "Phnom Penh, Cambodia",
            "airport": "Pochentong"
          },
          {
            "code": "PNI",
            "location": "Pohnpei, Caroline Islands, Micronesia",
            "airport": "Pohnpei International"
          },
          {
            "code": "PNK",
            "location": "Pontianak, Indonesia",
            "airport": "Supadio"
          },
          {
            "code": "PNL",
            "location": "Pantelleria, Italy",
            "airport": "Pantelleria"
          },
          {
            "code": "PNQ",
            "location": "Poona, India",
            "airport": "Lohegaon Poona"
          },
          {
            "code": "PNR",
            "location": "Pointe Noire, Congo",
            "airport": "Pointe Noire"
          },
          {
            "code": "PNS",
            "location": "Pensacola, FL, USA",
            "airport": ""
          },
          {
            "code": "POA",
            "location": "Porto Alegre, Rio Grande Do Sul, Brazil",
            "airport": "Salgado Filho"
          },
          {
            "code": "POG",
            "location": "Port Gentil, Gabon",
            "airport": "Port Gentil"
          },
          {
            "code": "POM",
            "location": "Port Moresby, Papua New Guinea",
            "airport": "Jackson"
          },
          {
            "code": "POP",
            "location": "Puerto Plata, Dominican Republic",
            "airport": "La Union"
          },
          {
            "code": "POR",
            "location": "Pori, Finland",
            "airport": "Pori"
          },
          {
            "code": "POS",
            "location": "Port Of Spain, Trinidad, Trinidad And Tobago",
            "airport": "Piarco International Airport"
          },
          {
            "code": "POU",
            "location": "Poughkeepsie, NY, USA",
            "airport": "Dutchess County"
          },
          {
            "code": "POZ",
            "location": "Poznan, Poland",
            "airport": "Lawica"
          },
          {
            "code": "PPG",
            "location": "Pago Pago, American Samoa",
            "airport": "International"
          },
          {
            "code": "PPS",
            "location": "Puerto Princesa, Philippines",
            "airport": "Puerto Princesa"
          },
          {
            "code": "PPT",
            "location": "Papeete, French Polynesia",
            "airport": "Intl Tahiti-Faaa"
          },
          {
            "code": "PQI",
            "location": "Presque Isle, ME, USA",
            "airport": ""
          },
          {
            "code": "PQQ",
            "location": "Port Macquarie, New South Wales, Australia",
            "airport": "Port Macquarie"
          },
          {
            "code": "PRC",
            "location": "Prescott, AZ, USA",
            "airport": ""
          },
          {
            "code": "PRG",
            "location": "Prague, Czech Republic",
            "airport": "Ruzyne"
          },
          {
            "code": "PRI",
            "location": "Praslin Island, Seychelles",
            "airport": ""
          },
          {
            "code": "PSA",
            "location": "Pisa, Italy",
            "airport": "G Galilei"
          },
          {
            "code": "PSE",
            "location": "Ponce, PR, USA",
            "airport": "Mercedita"
          },
          {
            "code": "PSG",
            "location": "Petersburg, AK, USA",
            "airport": "Municipal"
          },
          {
            "code": "PSM",
            "location": "Portsmouth, NH, USA",
            "airport": "Pease Intl Tradeport"
          },
          {
            "code": "PSO",
            "location": "Pasto, Colombia",
            "airport": "Cano"
          },
          {
            "code": "PSP",
            "location": "Palm Springs, CA, USA",
            "airport": "Palm Springs Municipal"
          },
          {
            "code": "PSR",
            "location": "Pescara, Italy",
            "airport": "Liberi"
          },
          {
            "code": "PSZ",
            "location": "Puerto Suarez, Bolivia",
            "airport": ""
          },
          {
            "code": "PTF",
            "location": "Malololailai, Fiji",
            "airport": "Malololailai"
          },
          {
            "code": "PTG",
            "location": "Pietersburg, South Africa",
            "airport": ""
          },
          {
            "code": "PTP",
            "location": "Pointe A Pitre, Guadeloupe",
            "airport": "Le Raizet"
          },
          {
            "code": "PTY",
            "location": "Panama City, Panama",
            "airport": "Tocumen International Airport"
          },
          {
            "code": "PUB",
            "location": "Pueblo, CO, USA",
            "airport": "Pueblo Memorial Airport"
          },
          {
            "code": "PUJ",
            "location": "Punta Cana, Dominican Republic",
            "airport": ""
          },
          {
            "code": "PUQ",
            "location": "Punta Arenas, Chile",
            "airport": "Presidente Ibanez"
          },
          {
            "code": "PUS",
            "location": "Pusan, South Korea",
            "airport": "Kimhae"
          },
          {
            "code": "PUW",
            "location": "Pullman, WA, USA",
            "airport": "Pullman"
          },
          {
            "code": "PUY",
            "location": "Pula, Croatia (Hrvatska)",
            "airport": "Pula"
          },
          {
            "code": "PUZ",
            "location": "Port Cabezas, Nicaragua",
            "airport": "Puerto Cabezas"
          },
          {
            "code": "PVC",
            "location": "Provincetown, MA, USA",
            "airport": "Provincetown Municipal Airport"
          },
          {
            "code": "PVD",
            "location": "Providence, RI, USA",
            "airport": "Tf Green State Airport"
          },
          {
            "code": "PVR",
            "location": "Puerto Vallarta, Jalisco, Mexico",
            "airport": "Gustavo Diaz Ordaz"
          },
          {
            "code": "PVU",
            "location": "Provo, UT, USA",
            "airport": "Provo"
          },
          {
            "code": "PWK",
            "location": "Chicago, IL, USA",
            "airport": "Pal-Waukee Airport"
          },
          {
            "code": "PWM",
            "location": "Portland, ME, USA",
            "airport": "Portland International Jetport"
          },
          {
            "code": "PWT",
            "location": "Bremerton, WA, USA",
            "airport": "Municipal"
          },
          {
            "code": "PXM",
            "location": "Puerto Escondido, Oaxaca, Mexico",
            "airport": ""
          },
          {
            "code": "PXO",
            "location": "Porto Santo, Madeira Islands, Portugal",
            "airport": "Porto Santo"
          },
          {
            "code": "PZE",
            "location": "Penzance, England, United Kingdom",
            "airport": "Penzance"
          },
          {
            "code": "PZO",
            "location": "Puerto Ordaz, Venezuela",
            "airport": "Puerto Ordaz"
          },
          {
            "code": "QBF",
            "location": "Vail/Eagle, CO, USA",
            "airport": ""
          },
          {
            "code": "QDU",
            "location": "Duesseldorf, Germany",
            "airport": "Main Train Station"
          },
          {
            "code": "QKB",
            "location": "Breckenridge, CO, USA",
            "airport": ""
          },
          {
            "code": "QKL",
            "location": "Cologne, Germany",
            "airport": "Train Main Railroad Station"
          },
          {
            "code": "QRO",
            "location": "Queretaro, Queretaro, Mexico",
            "airport": ""
          },
          {
            "code": "QSY",
            "location": "Sydney, New South Wales, Australia",
            "airport": ""
          },
          {
            "code": "RAB",
            "location": "Rabaul, Papua New Guinea",
            "airport": "Lakunai"
          },
          {
            "code": "RAJ",
            "location": "Rajkot, India",
            "airport": "Rajkot"
          },
          {
            "code": "RAK",
            "location": "Marrakech, Morocco",
            "airport": "Menara"
          },
          {
            "code": "RAP",
            "location": "Rapid City, SD, USA",
            "airport": "Rapid City Regional Airport"
          },
          {
            "code": "RAR",
            "location": "Rarotonga, Cook Islands",
            "airport": "Rarotonga"
          },
          {
            "code": "RBA",
            "location": "Rabat, Morocco",
            "airport": "Sale"
          },
          {
            "code": "RCB",
            "location": "Richards Bay, South Africa",
            "airport": "Richards Bay"
          },
          {
            "code": "RCE",
            "location": "Roche Harbor, WA, USA",
            "airport": "Roche Harbor"
          },
          {
            "code": "RDD",
            "location": "Redding, CA, USA",
            "airport": "Redding Municipal Airport"
          },
          {
            "code": "RDG",
            "location": "Reading, PA, USA",
            "airport": "Municipal / Spaatz Field"
          },
          {
            "code": "RDU",
            "location": "Raleigh/Durham, NC, USA",
            "airport": "Raleigh Durham International Arpt"
          },
          {
            "code": "REC",
            "location": "Recife, Pernambuco, Brazil",
            "airport": "Guararapes International"
          },
          {
            "code": "REG",
            "location": "Reggio Calabria, Italy",
            "airport": "Tito Menniti"
          },
          {
            "code": "REL",
            "location": "Trelew, Chubut, Argentina",
            "airport": ""
          },
          {
            "code": "RES",
            "location": "Resistencia, Chaco, Argentina",
            "airport": ""
          },
          {
            "code": "REU",
            "location": "Reus, Spain",
            "airport": "Reus"
          },
          {
            "code": "REX",
            "location": "Reynosa, Tamaulipas, Mexico",
            "airport": "General Lucio Blanco Airport"
          },
          {
            "code": "RFD",
            "location": "Rockford, IL, USA",
            "airport": "Greater Rockford"
          },
          {
            "code": "RGA",
            "location": "Rio Grande, Tierra Del Fuego, Argentina",
            "airport": ""
          },
          {
            "code": "RGL",
            "location": "Rio Gallegos, Santa Cruz, Argentina",
            "airport": "Rio Gallegos-Internacional"
          },
          {
            "code": "RGN",
            "location": "Yangon, Myanmar",
            "airport": "Mingaladon"
          },
          {
            "code": "RHI",
            "location": "Rhinelander, WI, USA",
            "airport": "Rhinelander Oneida County Airport"
          },
          {
            "code": "RHO",
            "location": "Rhodes, Greece",
            "airport": "Paradisi"
          },
          {
            "code": "RIC",
            "location": "Richmond, VA, USA",
            "airport": "Richmond International Airport"
          },
          {
            "code": "RIO",
            "location": "Rio De Janeiro, Rio De Janeiro, Brazil",
            "airport": ""
          },
          {
            "code": "RIW",
            "location": "Riverton, WY, USA",
            "airport": "Riverton Regional Airport"
          },
          {
            "code": "RIX",
            "location": "Riga, Latvia",
            "airport": "Riga"
          },
          {
            "code": "RKD",
            "location": "Rockland, ME, USA",
            "airport": "Rockland"
          },
          {
            "code": "RKS",
            "location": "Rock Springs, WY, USA",
            "airport": "Rock Springs Sweetwater Cty Arpt"
          },
          {
            "code": "RKV",
            "location": "Reykjavik, Iceland",
            "airport": "Reykjavik Domestic Airport"
          },
          {
            "code": "RMA",
            "location": "Roma, Queensland, Australia",
            "airport": "Roma"
          },
          {
            "code": "RNB",
            "location": "Ronneby, Sweden",
            "airport": "Kallinge"
          },
          {
            "code": "RNN",
            "location": "Bornholm, Denmark",
            "airport": "Arnager"
          },
          {
            "code": "RNO",
            "location": "Reno, NV, USA",
            "airport": "Reno-Cannon International Apt"
          },
          {
            "code": "RNS",
            "location": "Rennes, France",
            "airport": "St Jacques"
          },
          {
            "code": "ROA",
            "location": "Roanoke, VA, USA",
            "airport": "Roanoke Regional Airport"
          },
          {
            "code": "ROC",
            "location": "Rochester, NY, USA",
            "airport": "Monroe County Airport"
          },
          {
            "code": "ROM",
            "location": "Rome, Italy",
            "airport": "Leonardo Da Vinci / Fiumicino"
          },
          {
            "code": "ROP",
            "location": "Rota, Northern Mariana Islands",
            "airport": "Rota"
          },
          {
            "code": "ROR",
            "location": "Koror, Palau",
            "airport": "Airai"
          },
          {
            "code": "ROS",
            "location": "Rosario, Santa Fe, Argentina",
            "airport": "Fisherton"
          },
          {
            "code": "ROV",
            "location": "Rostov, Russia",
            "airport": "Rostov"
          },
          {
            "code": "ROW",
            "location": "Roswell, NM, USA",
            "airport": "Industrial Air Center"
          },
          {
            "code": "RPR",
            "location": "Raipur, India",
            "airport": ""
          },
          {
            "code": "RRG",
            "location": "Rodrigues Island, Mauritius",
            "airport": "Rodrigues"
          },
          {
            "code": "RSA",
            "location": "Santa Rosa, La Pampa, Argentina",
            "airport": ""
          },
          {
            "code": "RSD",
            "location": "Rock Sound, Bahamas",
            "airport": ""
          },
          {
            "code": "RST",
            "location": "Rochester, MN, USA",
            "airport": "Rochester Municipal"
          },
          {
            "code": "RSU",
            "location": "Yosu, South Korea",
            "airport": "Yosu Airport"
          },
          {
            "code": "RSW",
            "location": "Fort Myers, FL, USA",
            "airport": "Southwest Regional Airport"
          },
          {
            "code": "RTB",
            "location": "Roatan, Honduras",
            "airport": "Roatan"
          },
          {
            "code": "RTM",
            "location": "Rotterdam, Netherlands",
            "airport": "Rotterdam"
          },
          {
            "code": "RUH",
            "location": "Riyadh, Saudi Arabia",
            "airport": "King Khaled Intl"
          },
          {
            "code": "RUI",
            "location": "Ruidoso, NM, USA",
            "airport": ""
          },
          {
            "code": "RUN",
            "location": "St-Denis De La Reunion, Reunion",
            "airport": "Gillot"
          },
          {
            "code": "RUT",
            "location": "Rutland, VT, USA",
            "airport": ""
          },
          {
            "code": "RWI",
            "location": "Rocky Mount, NC, USA",
            "airport": "Wilson"
          },
          {
            "code": "SAB",
            "location": "Saba Island, Netherlands Antilles",
            "airport": ""
          },
          {
            "code": "SAF",
            "location": "Santa Fe, NM, USA",
            "airport": "Santa Fe Municipal Airport"
          },
          {
            "code": "SAH",
            "location": "Sanaa, Yemen",
            "airport": "International"
          },
          {
            "code": "SAL",
            "location": "San Salvador, El Salvador",
            "airport": "El Salvadore Intl Airport"
          },
          {
            "code": "SAN",
            "location": "San Diego, CA, USA",
            "airport": "Lindbergh International Airport"
          },
          {
            "code": "SAP",
            "location": "San Pedro Sula, Honduras",
            "airport": "La Mesa"
          },
          {
            "code": "SAT",
            "location": "San Antonio, TX, USA",
            "airport": "San Antonio International"
          },
          {
            "code": "SAV",
            "location": "Savannah, GA, USA",
            "airport": "Travis Field"
          },
          {
            "code": "SBA",
            "location": "Santa Barbara, CA, USA",
            "airport": "Santa Barbara Airport"
          },
          {
            "code": "SBH",
            "location": "St Barthelemy, Guadeloupe",
            "airport": ""
          },
          {
            "code": "SBN",
            "location": "South Bend, IN, USA",
            "airport": "Michiana Regional Airport"
          },
          {
            "code": "SBP",
            "location": "San Luis Obispo, CA, USA",
            "airport": "San Luis Bishop County Airport"
          },
          {
            "code": "SBW",
            "location": "Sibu, Sarawak, Malaysia",
            "airport": "Sibu"
          },
          {
            "code": "SBY",
            "location": "Salisbury, MD, USA",
            "airport": "Salisbury-Wicomico County Arpt"
          },
          {
            "code": "SCE",
            "location": "State College, PA, USA",
            "airport": "University Park Arpt"
          },
          {
            "code": "SCL",
            "location": "Santiago, Chile",
            "airport": "Comodoro Arturo Merino Benitez Airport"
          },
          {
            "code": "SCN",
            "location": "Saarbruecken, Germany",
            "airport": "Ensheim"
          },
          {
            "code": "SCQ",
            "location": "Santiago De Compostela, Spain",
            "airport": "Santiago"
          },
          {
            "code": "SCU",
            "location": "Santiago, Cuba",
            "airport": "Santiago-Antonio Maceo Cuba"
          },
          {
            "code": "SDF",
            "location": "Louisville, KY, USA",
            "airport": "Standiford Field"
          },
          {
            "code": "SDJ",
            "location": "Sendai, Japan",
            "airport": "Sendai"
          },
          {
            "code": "SDK",
            "location": "Sandakan, Sabah, Malaysia",
            "airport": ""
          },
          {
            "code": "SDL",
            "location": "Sundsvall, Sweden",
            "airport": "Sundsvall"
          },
          {
            "code": "SDN",
            "location": "Sandane, Norway",
            "airport": ""
          },
          {
            "code": "SDQ",
            "location": "Santo Domingo, Dominican Republic",
            "airport": "Las Americas"
          },
          {
            "code": "SDR",
            "location": "Santander, Spain",
            "airport": "Santander"
          },
          {
            "code": "SDU",
            "location": "Rio De Janeiro, Rio De Janeiro, Brazil",
            "airport": "Santos Dumont"
          },
          {
            "code": "SDX",
            "location": "Sedona, AZ, USA",
            "airport": ""
          },
          {
            "code": "SDY",
            "location": "Sidney, MT, USA",
            "airport": ""
          },
          {
            "code": "SEA",
            "location": "Seattle, WA, USA",
            "airport": "Seattle Tacoma Intl Airport"
          },
          {
            "code": "SEL",
            "location": "Seoul, South Korea",
            "airport": "Kimpo International"
          },
          {
            "code": "SEZ",
            "location": "Mahe Island, Seychelles",
            "airport": "Mahe Island Seychelles Intl"
          },
          {
            "code": "SFA",
            "location": "Sfax, Tunisia",
            "airport": "Sfax Airport"
          },
          {
            "code": "SFG",
            "location": "St Martin, Netherlands Antilles",
            "airport": "Esperance"
          },
          {
            "code": "SFJ",
            "location": "Kangerlussuaq, Greenland",
            "airport": "Sondre Stromfjord"
          },
          {
            "code": "SFN",
            "location": "Santa Fe, Santa Fe, Argentina",
            "airport": ""
          },
          {
            "code": "SFO",
            "location": "San Francisco, CA, USA",
            "airport": "San Francisco Intl Airport"
          },
          {
            "code": "SFT",
            "location": "Skelleftea, Sweden",
            "airport": "Skelleftea"
          },
          {
            "code": "SGC",
            "location": "Surgut, Russia",
            "airport": ""
          },
          {
            "code": "SGD",
            "location": "Sonderborg, Denmark",
            "airport": "Sonderborg"
          },
          {
            "code": "SGF",
            "location": "Springfield, MO, USA",
            "airport": "Springfield Regional Airport"
          },
          {
            "code": "SGN",
            "location": "Ho Chi Minh City, Vietnam",
            "airport": "Tan Son Nhut"
          },
          {
            "code": "SGO",
            "location": "St George, Queensland, Australia",
            "airport": "St George"
          },
          {
            "code": "SGU",
            "location": "Saint George, UT, USA",
            "airport": "St George"
          },
          {
            "code": "SGY",
            "location": "Skagway, AK, USA",
            "airport": ""
          },
          {
            "code": "SHA",
            "location": "Shanghai, China",
            "airport": "Shanghai Intl /Hongqiao/"
          },
          {
            "code": "SHC",
            "location": "Indaselassie, Ethiopia",
            "airport": ""
          },
          {
            "code": "SHD",
            "location": "Staunton, VA, USA",
            "airport": "Shenandoah Valley Regional"
          },
          {
            "code": "SHE",
            "location": "Shenyang, China",
            "airport": "Shenyang"
          },
          {
            "code": "SHJ",
            "location": "Sharjah, United Arab Emirates",
            "airport": "Sharjah"
          },
          {
            "code": "SHO",
            "location": "Sokcho, South Korea",
            "airport": ""
          },
          {
            "code": "SHR",
            "location": "Sheridan, WY, USA",
            "airport": "Sheridan County Airport"
          },
          {
            "code": "SHV",
            "location": "Shreveport, LA, USA",
            "airport": "Regional Airport"
          },
          {
            "code": "SID",
            "location": "Sal, Cape Verde",
            "airport": "Amilcar Cabral International"
          },
          {
            "code": "SIN",
            "location": "Singapore, Singapore",
            "airport": "Changi International Airport"
          },
          {
            "code": "SIP",
            "location": "Simferopol, Ukraine",
            "airport": "Simferopol"
          },
          {
            "code": "SIT",
            "location": "Sitka, AK, USA",
            "airport": "Sitka"
          },
          {
            "code": "SJC",
            "location": "San Jose, CA, USA",
            "airport": "San Jose International Airport"
          },
          {
            "code": "SJD",
            "location": "San Jose Del Cabo, Baja California Sur, Mexico",
            "airport": "Los Cabos Intl Airport"
          },
          {
            "code": "SJI",
            "location": "San Jose, Philippines",
            "airport": "Mcguire Field"
          },
          {
            "code": "SJJ",
            "location": "Sarajevo, Bosnia And Herzegowina",
            "airport": "Butmir"
          },
          {
            "code": "SJO",
            "location": "San Jose, Costa Rica",
            "airport": "Juan Santamaria International"
          },
          {
            "code": "SJT",
            "location": "San Angelo, TX, USA",
            "airport": ""
          },
          {
            "code": "SJU",
            "location": "San Juan, PR, USA",
            "airport": "Luis Munoz Marin International"
          },
          {
            "code": "SJW",
            "location": "Shijiazhuang, China",
            "airport": "Shijiazhuang"
          },
          {
            "code": "SKB",
            "location": "St Kitts, Saint Kitts And Nevis",
            "airport": "Golden Rock"
          },
          {
            "code": "SKD",
            "location": "Samarkand, Uzbekistan",
            "airport": ""
          },
          {
            "code": "SKG",
            "location": "Thessaloniki, Greece",
            "airport": "Thessaloniki"
          },
          {
            "code": "SKP",
            "location": "Skopje, Macedonia",
            "airport": "Skopje"
          },
          {
            "code": "SKS",
            "location": "Vojens Lufthavn, Denmark",
            "airport": "Jojens"
          },
          {
            "code": "SLA",
            "location": "Salta, Salta, Argentina",
            "airport": "International"
          },
          {
            "code": "SLC",
            "location": "Salt Lake City, UT, USA",
            "airport": "Salt Lake City International Arpt"
          },
          {
            "code": "SLK",
            "location": "Saranac Lake, NY, USA",
            "airport": "Adirondack"
          },
          {
            "code": "SLN",
            "location": "Salina, KS, USA",
            "airport": "Salina Municipal"
          },
          {
            "code": "SLP",
            "location": "San Luis Potosi, San Luis Potosi, Mexico",
            "airport": ""
          },
          {
            "code": "SLU",
            "location": "St Lucia, Saint Lucia",
            "airport": "Vigie Field"
          },
          {
            "code": "SLW",
            "location": "Saltillo, Coahuila, Mexico",
            "airport": "Saltillo"
          },
          {
            "code": "SLZ",
            "location": "Sao Luiz, Maranhao, Brazil",
            "airport": "Tirirical"
          },
          {
            "code": "SMF",
            "location": "Sacramento, CA, USA",
            "airport": "Sacramento Metropolitan"
          },
          {
            "code": "SML",
            "location": "Stella Maris, Bahamas",
            "airport": ""
          },
          {
            "code": "SMM",
            "location": "Semporna, Sabah, Malaysia",
            "airport": "Semporna"
          },
          {
            "code": "SMS",
            "location": "St Marie, Madagascar",
            "airport": ""
          },
          {
            "code": "SMX",
            "location": "Santa Maria, CA, USA",
            "airport": "Santa Maria Public Airport"
          },
          {
            "code": "SNA",
            "location": "Santa Ana, CA, USA",
            "airport": "John Wayne Airport"
          },
          {
            "code": "SNB",
            "location": "Snake Bay, Northern Territory, Australia",
            "airport": ""
          },
          {
            "code": "SNN",
            "location": "Shannon, Ireland",
            "airport": "Shannon"
          },
          {
            "code": "SNO",
            "location": "Sakon Nakhon, Thailand",
            "airport": ""
          },
          {
            "code": "SOF",
            "location": "Sofia, Bulgaria",
            "airport": "Sofia Intl"
          },
          {
            "code": "SOG",
            "location": "Sogndal, Norway",
            "airport": "Haukasen"
          },
          {
            "code": "SOM",
            "location": "San Tome, Venezuela",
            "airport": ""
          },
          {
            "code": "SOP",
            "location": "Southern Pines, NC, USA",
            "airport": "Pinehurst"
          },
          {
            "code": "SOU",
            "location": "Southampton, England, United Kingdom",
            "airport": "Eastleigh"
          },
          {
            "code": "SOW",
            "location": "Show Low, AZ, USA",
            "airport": ""
          },
          {
            "code": "SPB",
            "location": "St Thomas Island, VI, USA",
            "airport": "Seaplane Base"
          },
          {
            "code": "SPC",
            "location": "Santa Cruz La Palma, Canary Islands, Spain",
            "airport": "La Palma"
          },
          {
            "code": "SPD",
            "location": "Saidpur, Bangladesh",
            "airport": ""
          },
          {
            "code": "SPI",
            "location": "Springfield, IL, USA",
            "airport": "Capital Airport"
          },
          {
            "code": "SPN",
            "location": "Saipan, Northern Mariana Islands",
            "airport": "Saipan Intl Northern Mariana Isles"
          },
          {
            "code": "SPR",
            "location": "San Pedro, Belize",
            "airport": "San Pedro"
          },
          {
            "code": "SPS",
            "location": "Wichita Falls, TX, USA",
            "airport": "Wichita Falls Municipal"
          },
          {
            "code": "SPU",
            "location": "Split, Croatia (Hrvatska)",
            "airport": "Split"
          },
          {
            "code": "SPW",
            "location": "Spencer, IA, USA",
            "airport": "Spencer Municipal Airport"
          },
          {
            "code": "SRE",
            "location": "Sucre, Bolivia",
            "airport": "Sucre"
          },
          {
            "code": "SRQ",
            "location": "Sarasota/Bradenton, FL, USA",
            "airport": "Sarasota-Bradenton"
          },
          {
            "code": "SSA",
            "location": "Salvador, Bahia, Brazil",
            "airport": "Dois De Julho"
          },
          {
            "code": "SSB",
            "location": "St Croix Island, VI, USA",
            "airport": "Sea Plane Base"
          },
          {
            "code": "SSG",
            "location": "Malabo, Equatorial Guinea",
            "airport": "Santa Isabel"
          },
          {
            "code": "SSH",
            "location": "Sharm El Sheikh, Egypt",
            "airport": "Ophira"
          },
          {
            "code": "SSJ",
            "location": "Sandnessjoen, Norway",
            "airport": "Stokka"
          },
          {
            "code": "SSQ",
            "location": "La Sarre, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "STC",
            "location": "Saint Cloud, MN, USA",
            "airport": "Saint Cloud"
          },
          {
            "code": "STD",
            "location": "Santo Domingo, Venezuela",
            "airport": "Mayor Humberto Vivas Guerrero"
          },
          {
            "code": "STI",
            "location": "Santiago, Dominican Republic",
            "airport": "Municipal"
          },
          {
            "code": "STL",
            "location": "St Louis, MO, USA",
            "airport": "Lambert-St Louis Internatl"
          },
          {
            "code": "STM",
            "location": "Santarem, Para, Brazil",
            "airport": ""
          },
          {
            "code": "STN",
            "location": "London, England, United Kingdom",
            "airport": "Stansted"
          },
          {
            "code": "STP",
            "location": "St Paul, MN, USA",
            "airport": "Downtown Airport"
          },
          {
            "code": "STR",
            "location": "Stuttgart, Germany",
            "airport": "Echterdingen"
          },
          {
            "code": "STS",
            "location": "Santa Rosa, CA, USA",
            "airport": "Sonoma County Airport"
          },
          {
            "code": "STT",
            "location": "St Thomas Island, VI, USA",
            "airport": "Cyril E King Arpt"
          },
          {
            "code": "STX",
            "location": "St Croix Island, VI, USA",
            "airport": ""
          },
          {
            "code": "SUB",
            "location": "Surabaya, Indonesia",
            "airport": "Juanda Airport"
          },
          {
            "code": "SUE",
            "location": "Sturgeon Bay, WI, USA",
            "airport": ""
          },
          {
            "code": "SUN",
            "location": "Sun Valley/Hailey, ID, USA",
            "airport": ""
          },
          {
            "code": "SUV",
            "location": "Suva, Fiji",
            "airport": "Nausori"
          },
          {
            "code": "SVD",
            "location": "St Vincent, St. Vincent And The Grenadines",
            "airport": ""
          },
          {
            "code": "SVG",
            "location": "Stavanger, Norway",
            "airport": "Sola"
          },
          {
            "code": "SVL",
            "location": "Savonlinna, Finland",
            "airport": "Savonlinna"
          },
          {
            "code": "SVO",
            "location": "Moscow, Russia",
            "airport": "Sheremetyevo"
          },
          {
            "code": "SVQ",
            "location": "Sevilla, Spain",
            "airport": ""
          },
          {
            "code": "SVU",
            "location": "Savusavu, Fiji",
            "airport": "Savusavu"
          },
          {
            "code": "SVX",
            "location": "Ekaterinburg, Russia",
            "airport": ""
          },
          {
            "code": "SVZ",
            "location": "San Antonio, Venezuela",
            "airport": ""
          },
          {
            "code": "SWA",
            "location": "Shantou, China",
            "airport": ""
          },
          {
            "code": "SWF",
            "location": "Newburgh/Poughkeepsie, NY, USA",
            "airport": "Stewart"
          },
          {
            "code": "SWP",
            "location": "Swakopmund, Namibia",
            "airport": ""
          },
          {
            "code": "SWQ",
            "location": "Sumbawa Island, Indonesia",
            "airport": "Brang Bidji"
          },
          {
            "code": "SXB",
            "location": "Strasbourg, France",
            "airport": "Entzheim"
          },
          {
            "code": "SXF",
            "location": "Berlin, Germany",
            "airport": "Schoenefeld"
          },
          {
            "code": "SXL",
            "location": "Sligo, Ireland",
            "airport": "Collooney"
          },
          {
            "code": "SXM",
            "location": "St Maarten, Netherlands Antilles",
            "airport": "Juliana"
          },
          {
            "code": "SXR",
            "location": "Srinagar, India",
            "airport": ""
          },
          {
            "code": "SYD",
            "location": "Sydney, New South Wales, Australia",
            "airport": "Sydney /Kingsford-Smith/ Airport"
          },
          {
            "code": "SYO",
            "location": "Shonai, Japan",
            "airport": "Shonai"
          },
          {
            "code": "SYR",
            "location": "Syracuse, NY, USA",
            "airport": "Hancock International"
          },
          {
            "code": "SYX",
            "location": "Sanya, China",
            "airport": ""
          },
          {
            "code": "SYY",
            "location": "Stornoway, Scotland, United Kingdom",
            "airport": "Stornoway"
          },
          {
            "code": "SYZ",
            "location": "Shiraz, Iran",
            "airport": "Shiraz"
          },
          {
            "code": "SZG",
            "location": "Salzburg, Austria",
            "airport": "Salzburg"
          },
          {
            "code": "SZX",
            "location": "Shenzhen, China",
            "airport": "Shenzhen"
          },
          {
            "code": "SZZ",
            "location": "Szczecin, Poland",
            "airport": "Goleniow"
          },
          {
            "code": "TAB",
            "location": "Tobago, Tobago, Trinidad And Tobago",
            "airport": "Crown Point"
          },
          {
            "code": "TAC",
            "location": "Tacloban, Philippines",
            "airport": "Dz Romualdez"
          },
          {
            "code": "TAE",
            "location": "Taegu, South Korea",
            "airport": ""
          },
          {
            "code": "TAG",
            "location": "Tagbilaran, Philippines",
            "airport": "Tagbilaran"
          },
          {
            "code": "TAI",
            "location": "Taiz, Yemen",
            "airport": "Al-Janad"
          },
          {
            "code": "TAM",
            "location": "Tampico, Tamaulipas, Mexico",
            "airport": ""
          },
          {
            "code": "TAP",
            "location": "Tapachula, Chiapas, Mexico",
            "airport": "Tapachula International"
          },
          {
            "code": "TAS",
            "location": "Tashkent, Uzbekistan",
            "airport": "Tashkent"
          },
          {
            "code": "TAT",
            "location": "Tatry/Poprad, Slovakia",
            "airport": "Tatry/Poprad"
          },
          {
            "code": "TBN",
            "location": "Ft Leonard Wood, MO, USA",
            "airport": "Forney Field"
          },
          {
            "code": "TBP",
            "location": "Tumbes, Peru",
            "airport": "Tumbes"
          },
          {
            "code": "TBS",
            "location": "Tbilisi, Georgia",
            "airport": "Novo Alexeyevka"
          },
          {
            "code": "TBT",
            "location": "Tabatinga, Amazonas, Brazil",
            "airport": ""
          },
          {
            "code": "TBU",
            "location": "Nuku Alofa/Tongatapu, Tonga",
            "airport": "International"
          },
          {
            "code": "TCI",
            "location": "Tenerife, Canary Islands, Spain",
            "airport": "Tenerife Norte Los Rodeos"
          },
          {
            "code": "TCL",
            "location": "Tuscaloosa, AL, USA",
            "airport": "Van De Graff"
          },
          {
            "code": "TDD",
            "location": "Trinidad, Bolivia",
            "airport": ""
          },
          {
            "code": "TED",
            "location": "Thisted, Denmark",
            "airport": ""
          },
          {
            "code": "TER",
            "location": "Terceira Island, Azores Islands, Portugal",
            "airport": "Lajes"
          },
          {
            "code": "TEX",
            "location": "Telluride, CO, USA",
            "airport": "Telluride Municipal Airport"
          },
          {
            "code": "TEZ",
            "location": "Tezpur, India",
            "airport": "Salonbari"
          },
          {
            "code": "TFN",
            "location": "Tenerife, Canary Islands, Spain",
            "airport": "Tenerife Norte Los Rodeos"
          },
          {
            "code": "TFS",
            "location": "Tenerife, Canary Islands, Spain",
            "airport": "Reina Sofia"
          },
          {
            "code": "TGD",
            "location": "Podgorica, Yugoslavia",
            "airport": "Golubovci"
          },
          {
            "code": "TGG",
            "location": "Kuala Terengganu, Malaysia",
            "airport": "Sultan Mahmood"
          },
          {
            "code": "TGM",
            "location": "Tirgu Mures, Romania",
            "airport": "Tirgu Mures"
          },
          {
            "code": "TGU",
            "location": "Tegucigalpa, Honduras",
            "airport": "Toncontin"
          },
          {
            "code": "TGZ",
            "location": "Tuxtla Gutierrez, Chiapas, Mexico",
            "airport": "Llano San Juan"
          },
          {
            "code": "THE",
            "location": "Teresina, Piaui, Brazil",
            "airport": "Teresina"
          },
          {
            "code": "THF",
            "location": "Berlin, Germany",
            "airport": "Tempelhof"
          },
          {
            "code": "THR",
            "location": "Tehran, Iran",
            "airport": "Mehrabad"
          },
          {
            "code": "THU",
            "location": "Pituffik, Greenland",
            "airport": "Thule Airport"
          },
          {
            "code": "TIA",
            "location": "Tirana, Albania",
            "airport": "Rinas"
          },
          {
            "code": "TIJ",
            "location": "Tijuana, Baja California, Mexico",
            "airport": "General Abelardo L Rodriguez"
          },
          {
            "code": "TIQ",
            "location": "Tinian, Northern Mariana Islands",
            "airport": "Tinian"
          },
          {
            "code": "TIS",
            "location": "Thursday Island, Queensland, Australia",
            "airport": "Horn Island"
          },
          {
            "code": "TIV",
            "location": "Tivat, Yugoslavia",
            "airport": "Tivat"
          },
          {
            "code": "TIZ",
            "location": "Tari, Papua New Guinea",
            "airport": ""
          },
          {
            "code": "TJA",
            "location": "Tarija, Bolivia",
            "airport": ""
          },
          {
            "code": "TJM",
            "location": "Tyumen, Russia",
            "airport": "Tyumen"
          },
          {
            "code": "TKK",
            "location": "Truk, Caroline Islands, Micronesia",
            "airport": "Truk"
          },
          {
            "code": "TKQ",
            "location": "Kigoma, Tanzania",
            "airport": ""
          },
          {
            "code": "TKS",
            "location": "Tokushima, Japan",
            "airport": "Tokushima"
          },
          {
            "code": "TKU",
            "location": "Turku, Finland",
            "airport": "Turku"
          },
          {
            "code": "TLH",
            "location": "Tallahassee, FL, USA",
            "airport": ""
          },
          {
            "code": "TLL",
            "location": "Tallinn, Estonia",
            "airport": "Ulemiste"
          },
          {
            "code": "TLS",
            "location": "Toulouse, France",
            "airport": "Blagnac"
          },
          {
            "code": "TLV",
            "location": "Tel Aviv Yafo, Israel",
            "airport": "Ben-Gurion International"
          },
          {
            "code": "TMP",
            "location": "Tampere, Finland",
            "airport": "Tampere-Pirkkala"
          },
          {
            "code": "TMW",
            "location": "Tamworth, New South Wales, Australia",
            "airport": "Tamworth"
          },
          {
            "code": "TNG",
            "location": "Tangier, Morocco",
            "airport": "Boukhalef Souahel"
          },
          {
            "code": "TNR",
            "location": "Antananarivo, Madagascar",
            "airport": "Ivato"
          },
          {
            "code": "TOL",
            "location": "Toledo, OH, USA",
            "airport": "Toledo Express Airport"
          },
          {
            "code": "TOS",
            "location": "Tromso, Norway",
            "airport": "Tromso/Langes"
          },
          {
            "code": "TOY",
            "location": "Toyama, Japan",
            "airport": "Toyama"
          },
          {
            "code": "TPA",
            "location": "Tampa, FL, USA",
            "airport": "Tampa International"
          },
          {
            "code": "TPE",
            "location": "Taipei, Taiwan",
            "airport": "Chiang Kai Shek Airport"
          },
          {
            "code": "TPL",
            "location": "Temple, TX, USA",
            "airport": ""
          },
          {
            "code": "TPP",
            "location": "Tarapoto, Peru",
            "airport": "Tarapoto"
          },
          {
            "code": "TPQ",
            "location": "Tepic, Nayarit, Mexico",
            "airport": ""
          },
          {
            "code": "TPS",
            "location": "Trapani, Sicily, Italy",
            "airport": "Birgi"
          },
          {
            "code": "TRC",
            "location": "Torreon, Coahuila, Mexico",
            "airport": ""
          },
          {
            "code": "TRD",
            "location": "Trondheim, Norway",
            "airport": "Trondheim-Vaernes"
          },
          {
            "code": "TRE",
            "location": "Tiree, Scotland, United Kingdom",
            "airport": "Tiree Island"
          },
          {
            "code": "TRF",
            "location": "Sandefjord, Norway",
            "airport": "Torf"
          },
          {
            "code": "TRG",
            "location": "Tauranga, New Zealand",
            "airport": "Tauranga"
          },
          {
            "code": "TRI",
            "location": "Bristol/Johnson City/Kingsport, TN, USA",
            "airport": "Municipal Tri-City Airport"
          },
          {
            "code": "TRK",
            "location": "Tarakan, Indonesia",
            "airport": "Tarakan"
          },
          {
            "code": "TRN",
            "location": "Turin, Italy",
            "airport": "Caselle"
          },
          {
            "code": "TRS",
            "location": "Trieste, Italy",
            "airport": "Ronchi Dei Legionari"
          },
          {
            "code": "TRU",
            "location": "Trujillo, Peru",
            "airport": "Trujillo"
          },
          {
            "code": "TRV",
            "location": "Trivandrum, India",
            "airport": "Trivandrum"
          },
          {
            "code": "TRZ",
            "location": "Tiruchirapally, India",
            "airport": "Civil"
          },
          {
            "code": "TSA",
            "location": "Taipei, Taiwan",
            "airport": "Sung Shan"
          },
          {
            "code": "TSR",
            "location": "Timisoara, Romania",
            "airport": "Timisoara"
          },
          {
            "code": "TSS",
            "location": "New York, NY, USA",
            "airport": "East 34Th Street Heliport"
          },
          {
            "code": "TSV",
            "location": "Townsville, Queensland, Australia",
            "airport": "Townsville"
          },
          {
            "code": "TTE",
            "location": "Ternate, Indonesia",
            "airport": "Babullah"
          },
          {
            "code": "TTJ",
            "location": "Tottori, Japan",
            "airport": "Tottori"
          },
          {
            "code": "TTN",
            "location": "Trenton, NJ, USA",
            "airport": "Mercer County"
          },
          {
            "code": "TUC",
            "location": "Tucuman, Tucuman, Argentina",
            "airport": "Benjamin Matienzo"
          },
          {
            "code": "TUF",
            "location": "Tours, France",
            "airport": "St Symphorien"
          },
          {
            "code": "TUL",
            "location": "Tulsa, OK, USA",
            "airport": "Tulsa International"
          },
          {
            "code": "TUN",
            "location": "Tunis, Tunisia",
            "airport": "Carthage"
          },
          {
            "code": "TUO",
            "location": "Taupo, New Zealand",
            "airport": "Taupo"
          },
          {
            "code": "TUP",
            "location": "Tupelo, MS, USA",
            "airport": "Cd Lemons Municipal"
          },
          {
            "code": "TUS",
            "location": "Tucson, AZ, USA",
            "airport": "Tucson International Airport"
          },
          {
            "code": "TVC",
            "location": "Traverse City, MI, USA",
            "airport": "Cherry Capital Airport"
          },
          {
            "code": "TVF",
            "location": "Thief River Falls, MN, USA",
            "airport": "Thief River Falls Municipal"
          },
          {
            "code": "TVL",
            "location": "South Lake Tahoe, CA, USA",
            "airport": "Lake Tahoe"
          },
          {
            "code": "TWB",
            "location": "Toowoomba, Queensland, Australia",
            "airport": "Toowoomba"
          },
          {
            "code": "TWF",
            "location": "Twin Falls, ID, USA",
            "airport": ""
          },
          {
            "code": "TXK",
            "location": "Texarkana, AR, USA",
            "airport": "Municipal"
          },
          {
            "code": "TXL",
            "location": "Berlin, Germany",
            "airport": "Tegel"
          },
          {
            "code": "TXN",
            "location": "Tunxi, China",
            "airport": ""
          },
          {
            "code": "TYN",
            "location": "Taiyuan, China",
            "airport": ""
          },
          {
            "code": "TYR",
            "location": "Tyler, TX, USA",
            "airport": "Pounds Field"
          },
          {
            "code": "TYS",
            "location": "Knoxville, TN, USA",
            "airport": "Mcghee Tyson"
          },
          {
            "code": "TZA",
            "location": "Belize City, Belize",
            "airport": "Belize Municipal"
          },
          {
            "code": "TZN",
            "location": "South Andros, Bahamas",
            "airport": "Congo Town"
          },
          {
            "code": "TZX",
            "location": "Trabzon, Turkey",
            "airport": "Trabzon"
          },
          {
            "code": "UAK",
            "location": "Narsarsuaq, Greenland",
            "airport": "Narssarssuaq"
          },
          {
            "code": "UAQ",
            "location": "San Juan, San Juan, Argentina",
            "airport": ""
          },
          {
            "code": "UBJ",
            "location": "Ube, Japan",
            "airport": ""
          },
          {
            "code": "UCA",
            "location": "Utica, NY, USA",
            "airport": "Oneida County"
          },
          {
            "code": "UDR",
            "location": "Udaipur, India",
            "airport": ""
          },
          {
            "code": "UEL",
            "location": "Quelimane, Mozambique",
            "airport": ""
          },
          {
            "code": "UET",
            "location": "Quetta, Pakistan",
            "airport": ""
          },
          {
            "code": "UGC",
            "location": "Urgench, Uzbekistan",
            "airport": ""
          },
          {
            "code": "UIB",
            "location": "Quibdo, Colombia",
            "airport": ""
          },
          {
            "code": "UIN",
            "location": "Quincy, IL, USA",
            "airport": "Baldwin Field"
          },
          {
            "code": "UIO",
            "location": "Quito, Ecuador",
            "airport": "Marshal"
          },
          {
            "code": "UIP",
            "location": "Quimper, France",
            "airport": "Pluguffan"
          },
          {
            "code": "ULN",
            "location": "Ulan Bator, Mongolia",
            "airport": "Ulan Bator"
          },
          {
            "code": "ULY",
            "location": "Ulyanovsk, Russia",
            "airport": "Ulyanoysk"
          },
          {
            "code": "UME",
            "location": "Umea, Sweden",
            "airport": "Umea"
          },
          {
            "code": "UMR",
            "location": "Woomera, South Australia, Australia",
            "airport": "Woomera"
          },
          {
            "code": "UNT",
            "location": "Unst Shetland Islands, Scotland, United Kingdom",
            "airport": ""
          },
          {
            "code": "UPG",
            "location": "Ujung Pandang, Indonesia",
            "airport": "Hasanudin"
          },
          {
            "code": "UPN",
            "location": "Uruapan, Michoacan, Mexico",
            "airport": ""
          },
          {
            "code": "URC",
            "location": "Urumqi, China",
            "airport": ""
          },
          {
            "code": "URO",
            "location": "Rouen, France",
            "airport": "Rouen /Boos Airport"
          },
          {
            "code": "URT",
            "location": "Surat Thani, Thailand",
            "airport": ""
          },
          {
            "code": "USH",
            "location": "Ushuaia, Tierra Del Fuego, Argentina",
            "airport": ""
          },
          {
            "code": "USM",
            "location": "Koh Samui, Thailand",
            "airport": ""
          },
          {
            "code": "USN",
            "location": "Ulsan, South Korea",
            "airport": ""
          },
          {
            "code": "UTH",
            "location": "Udon Thani, Thailand",
            "airport": "Udon"
          },
          {
            "code": "UTN",
            "location": "Upington, South Africa",
            "airport": "Municipal"
          },
          {
            "code": "UUD",
            "location": "Ulan-Ude, Russia",
            "airport": ""
          },
          {
            "code": "UVF",
            "location": "St Lucia, Saint Lucia",
            "airport": "Hewanorra"
          },
          {
            "code": "VAA",
            "location": "Vaasa, Finland",
            "airport": "Vaasa"
          },
          {
            "code": "VAR",
            "location": "Varna, Bulgaria",
            "airport": "Varna"
          },
          {
            "code": "VAS",
            "location": "Sivas, Turkey",
            "airport": "Sivas"
          },
          {
            "code": "VBY",
            "location": "Visby, Sweden",
            "airport": "Visby"
          },
          {
            "code": "VCE",
            "location": "Venice, Italy",
            "airport": "Marco Polo"
          },
          {
            "code": "VCT",
            "location": "Victoria, TX, USA",
            "airport": ""
          },
          {
            "code": "VDA",
            "location": "Ovda, Israel",
            "airport": ""
          },
          {
            "code": "VDS",
            "location": "Vadso, Norway",
            "airport": "Vadso"
          },
          {
            "code": "VDZ",
            "location": "Valdez, AK, USA",
            "airport": ""
          },
          {
            "code": "VER",
            "location": "Veracruz, Veracruz, Mexico",
            "airport": "Las Bajadas / General Heriberto Jara"
          },
          {
            "code": "VEY",
            "location": "Vestmannaeyjar, Iceland",
            "airport": "Vestmannaeyjar"
          },
          {
            "code": "VFA",
            "location": "Victoria Falls, Zimbabwe",
            "airport": ""
          },
          {
            "code": "VGO",
            "location": "Vigo, Spain",
            "airport": ""
          },
          {
            "code": "VGT",
            "location": "Las Vegas, NV, USA",
            "airport": "North Air Terminal"
          },
          {
            "code": "VIE",
            "location": "Vienna, Austria",
            "airport": "Schwechat"
          },
          {
            "code": "VIJ",
            "location": "Virgin Gorda, Virgin Islands (British)",
            "airport": ""
          },
          {
            "code": "VIS",
            "location": "Visalia, CA, USA",
            "airport": "Visalia Municipal Airport"
          },
          {
            "code": "VIT",
            "location": "Vitoria, Spain",
            "airport": "Vitoria"
          },
          {
            "code": "VIX",
            "location": "Vitoria, Espirito Santo, Brazil",
            "airport": "Eureco Sales"
          },
          {
            "code": "VKO",
            "location": "Moscow, Russia",
            "airport": "Vnukovo"
          },
          {
            "code": "VLC",
            "location": "Valencia, Spain",
            "airport": "Valencia"
          },
          {
            "code": "VLD",
            "location": "Valdosta, GA, USA",
            "airport": "Valdosta Regional"
          },
          {
            "code": "VLG",
            "location": "Villa Gesell, Buenos Aires, Argentina",
            "airport": "Villa Gesell"
          },
          {
            "code": "VLI",
            "location": "Port Vila, Vanuatu",
            "airport": "Bauerfield"
          },
          {
            "code": "VLL",
            "location": "Valladolid, Spain",
            "airport": "Valladolid"
          },
          {
            "code": "VLN",
            "location": "Valencia, Venezuela",
            "airport": "Valencia"
          },
          {
            "code": "VNO",
            "location": "Vilnius, Lithuania",
            "airport": "Vilnius Airport"
          },
          {
            "code": "VNS",
            "location": "Varanasi, India",
            "airport": "Babatpur"
          },
          {
            "code": "VOG",
            "location": "Volgograd, Russia",
            "airport": "Volgograd"
          },
          {
            "code": "VPS",
            "location": "Valparaiso, FL, USA",
            "airport": "Fort Walton Beach"
          },
          {
            "code": "VRA",
            "location": "Varadero, Cuba",
            "airport": "Juan Gualberto Gomez"
          },
          {
            "code": "VRB",
            "location": "Vero Beach, FL, USA",
            "airport": "Vero Beach Municipal"
          },
          {
            "code": "VRK",
            "location": "Varkaus, Finland",
            "airport": "Varkaus"
          },
          {
            "code": "VRN",
            "location": "Verona, Italy",
            "airport": "Verona"
          },
          {
            "code": "VSA",
            "location": "Villahermosa, Tabasco, Mexico",
            "airport": "Carlos R Perez"
          },
          {
            "code": "VSG",
            "location": "Lugansk, Ukraine",
            "airport": ""
          },
          {
            "code": "VST",
            "location": "Vasteras, Sweden",
            "airport": "Hasslo"
          },
          {
            "code": "VTE",
            "location": "Vientiane, Laos",
            "airport": "Wattay"
          },
          {
            "code": "VTZ",
            "location": "Vishakhapatnam, India",
            "airport": "Vishakhapatnam"
          },
          {
            "code": "VUP",
            "location": "Valledupar, Colombia",
            "airport": ""
          },
          {
            "code": "VVI",
            "location": "Santa Cruz, Bolivia",
            "airport": "Viru Viru International"
          },
          {
            "code": "VVO",
            "location": "Vladivostok, Russia",
            "airport": "Vladivostok Airport"
          },
          {
            "code": "VXO",
            "location": "Vaxjo, Sweden",
            "airport": "Vaxjo"
          },
          {
            "code": "WAT",
            "location": "Waterford, Ireland",
            "airport": ""
          },
          {
            "code": "WAW",
            "location": "Warsaw, Poland",
            "airport": "Okecie"
          },
          {
            "code": "WBU",
            "location": "Boulder, CO, USA",
            "airport": ""
          },
          {
            "code": "WDG",
            "location": "Enid, OK, USA",
            "airport": "Woodring Municipal"
          },
          {
            "code": "WDH",
            "location": "Windhoek, Namibia",
            "airport": "Jg Strijdom"
          },
          {
            "code": "WGA",
            "location": "Wagga-Wagga, New South Wales, Australia",
            "airport": "Forest Hill"
          },
          {
            "code": "WGE",
            "location": "Walgett, New South Wales, Australia",
            "airport": "Walgett"
          },
          {
            "code": "WIC",
            "location": "Wick, Scotland, United Kingdom",
            "airport": "Wick"
          },
          {
            "code": "WIL",
            "location": "Nairobi, Kenya",
            "airport": "Wilson Arpt"
          },
          {
            "code": "WIN",
            "location": "Winton, Queensland, Australia",
            "airport": "Winton"
          },
          {
            "code": "WLG",
            "location": "Wellington, New Zealand",
            "airport": "International"
          },
          {
            "code": "WMH",
            "location": "Mountain Home, AR, USA",
            "airport": ""
          },
          {
            "code": "WNA",
            "location": "Napakiak, AK, USA",
            "airport": "Napakiak"
          },
          {
            "code": "WRL",
            "location": "Worland, WY, USA",
            "airport": "Worland"
          },
          {
            "code": "WRO",
            "location": "Wroclaw, Poland",
            "airport": "Strachowice"
          },
          {
            "code": "XAW",
            "location": "",
            "airport": ""
          },
          {
            "code": "Capreol  , Ontario , Canada",
            "location": "Capreol",
            "airport": ""
          },
          {
            "code": "XCI",
            "location": "Chambord, Quebec, Canada",
            "airport": "Chambord / Via Rail Service XCM"
          },
          {
            "code": "",
            "location": "Chatham  , Ontario, Canada XDL",
            "airport": ""
          },
          {
            "code": "Chandler  ,  Quebec, Canada",
            "location": "Chandler  /  Via Rail Service Columbia, Canada",
            "airport": "Langford / Via Rail Service XEK"
          },
          {
            "code": "XFG",
            "location": "Perce, Quebec, Canada",
            "airport": "Perce / Via Rail Service"
          },
          {
            "code": "XFL",
            "location": "",
            "airport": ""
          },
          {
            "code": "Shawinigan  , Quebec, Canada",
            "location": "Shawinigan / Via Rail Service XFM",
            "airport": ""
          },
          {
            "code": ",  British Columbia, Canada",
            "location": "Shawnigan",
            "airport": ""
          },
          {
            "code": "XGJ",
            "location": "Cobourg, Ontario, Canada",
            "airport": "Cobourg / Via Rail Service XGK"
          },
          {
            "code": "Quebec  ,  Canada",
            "location": "Coteau /  Via Rail Service Ingersoll, Ontario, Canada",
            "airport": "Ingersoll / Via Rail Service XID"
          },
          {
            "code": "",
            "location": "Casselman , Ontario , Canada",
            "airport": ""
          },
          {
            "code": "",
            "location": "Casselman  / Via Rail  Service",
            "airport": "Campbell River /Campbell Rvr, British Columbia, Canada"
          },
          {
            "code": "YHZ",
            "location": "Halifax, Nova Scotia, Canada",
            "airport": "Halifax International"
          },
          {
            "code": "YIB",
            "location": "Atikokan, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YJA",
            "location": "Jasper, Alberta, Canada",
            "airport": ""
          },
          {
            "code": "YJT",
            "location": "Stephenville, Newfoundland, Canada",
            "airport": "Stephenville"
          },
          {
            "code": "YKA",
            "location": "Kamloops, British Columbia, Canada",
            "airport": "Fulton Field"
          },
          {
            "code": "YKF",
            "location": "Kitchener, Ontario, Canada",
            "airport": "Kitchener"
          },
          {
            "code": "YKL",
            "location": "Schefferville, Quebec, Canada",
            "airport": "Schefferville"
          },
          {
            "code": "YKM",
            "location": "Yakima, WA, USA",
            "airport": "Yakima Air Terminal"
          },
          {
            "code": "YKQ",
            "location": "Waskaganish, Quebec, Canada",
            "airport": "Waskaganish"
          },
          {
            "code": "YKS",
            "location": "Yakutsk, Russia",
            "airport": ""
          },
          {
            "code": "YLD",
            "location": "Chapleau, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YLQ",
            "location": "La Tuque, Quebec, Canada",
            "airport": "La Tuque"
          },
          {
            "code": "YLW",
            "location": "Kelowna, British Columbia, Canada",
            "airport": "Ellison Field Airport"
          },
          {
            "code": "YMM",
            "location": "Fort Mcmurray, Alberta, Canada",
            "airport": "Fort Mcmurray Municipal"
          },
          {
            "code": "YMO",
            "location": "Moosonee, Ontario, Canada",
            "airport": "Moosonee"
          },
          {
            "code": "YMT",
            "location": "Chibougamau, Quebec, Canada",
            "airport": "Chibougamau"
          },
          {
            "code": "YMX",
            "location": "Montreal, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "YND",
            "location": "Gatineau, Quebec, Canada",
            "airport": "Gatineau"
          },
          {
            "code": "YNG",
            "location": "Youngstown, OH, USA",
            "airport": "Youngstown Municipal Airport"
          },
          {
            "code": "YOJ",
            "location": "High Level, Alberta, Canada",
            "airport": "Footner Lake Muncpl"
          },
          {
            "code": "YOO",
            "location": "Oshawa, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YOP",
            "location": "Rainbow Lake, Alberta, Canada",
            "airport": "Rainbow Lake"
          },
          {
            "code": "YOW",
            "location": "Ottawa, Ontario, Canada",
            "airport": "Ottawa International"
          },
          {
            "code": "YPE",
            "location": "Peace River, Alberta, Canada",
            "airport": "Peace River"
          },
          {
            "code": "YPF",
            "location": "Esquimalt, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YPR",
            "location": "Prince Rupert /Princ Rupert, British Columbia, Canada",
            "airport": "Digby Island"
          },
          {
            "code": "YPW",
            "location": "Powell River, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YPZ",
            "location": "Burns Lake, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YQB",
            "location": "Quebec, Quebec, Canada",
            "airport": "Sainte Foy Airport"
          },
          {
            "code": "YQC",
            "location": "Quaqtaq, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "YQD",
            "location": "The Pas, Manitoba, Canada",
            "airport": "The Pas"
          },
          {
            "code": "YQG",
            "location": "Windsor, Ontario, Canada",
            "airport": "Windsor International"
          },
          {
            "code": "YQH",
            "location": "Watson Lake, Yukon Territory, Canada",
            "airport": "Watson Lake Airport"
          },
          {
            "code": "YQI",
            "location": "Yarmouth, Nova Scotia, Canada",
            "airport": ""
          },
          {
            "code": "YQK",
            "location": "Kenora, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YQL",
            "location": "Lethbridge, Alberta, Canada",
            "airport": "Lethbridge Airport"
          },
          {
            "code": "YQM",
            "location": "Moncton, New Brunswick, Canada",
            "airport": "Lakeburn Municipal Airpt"
          },
          {
            "code": "YQQ",
            "location": "Comox, British Columbia, Canada",
            "airport": "Comox Civil Air Terminal"
          },
          {
            "code": "YQR",
            "location": "Regina, Saskatchewan, Canada",
            "airport": "Regina International"
          },
          {
            "code": "YQT",
            "location": "Thunder Bay, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YQU",
            "location": "Grande Prairie, Alberta, Canada",
            "airport": "Grande Prairie Airport"
          },
          {
            "code": "YQX",
            "location": "Gander, Newfoundland, Canada",
            "airport": "Gander Intl Airport"
          },
          {
            "code": "YQY",
            "location": "Sydney, Nova Scotia, Canada",
            "airport": "Sydney Municipal"
          },
          {
            "code": "YQZ",
            "location": "Quesnel, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YRB",
            "location": "Resolute, Northwest Territories, Canada",
            "airport": "Resolute Bay"
          },
          {
            "code": "YRL",
            "location": "Red Lake, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YSB",
            "location": "Sudbury, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YSF",
            "location": "Stony Rapids, Saskatchewan, Canada",
            "airport": "Stony Rapids"
          },
          {
            "code": "YSH",
            "location": "Smith Falls, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YSJ",
            "location": "Saint John, New Brunswick, Canada",
            "airport": "Turnbull Field"
          },
          {
            "code": "YSL",
            "location": "St Leonard, New Brunswick, Canada",
            "airport": "St Leonard Apt"
          },
          {
            "code": "YSM",
            "location": "Fort Smith, Northwest Territories, Canada",
            "airport": ""
          },
          {
            "code": "YSN",
            "location": "Salmon Arm, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YSP",
            "location": "Marathon, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YTA",
            "location": "Pembroke, Ontario, Canada",
            "airport": "Pem And Area Apt"
          },
          {
            "code": "YTD",
            "location": "Thicket Portage, Manitoba, Canada",
            "airport": ""
          },
          {
            "code": "YTH",
            "location": "Thompson, Manitoba, Canada",
            "airport": "Thompson"
          },
          {
            "code": "YTS",
            "location": "Timmins, Ontario, Canada",
            "airport": "Timmins Municipal Airport"
          },
          {
            "code": "YTZ",
            "location": "Toronto, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YUL",
            "location": "Montreal, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "YUM",
            "location": "Yuma, AZ, USA",
            "airport": "Yuma International Airport"
          },
          {
            "code": "YVA",
            "location": "Moroni (Hahaya/Iconi)Comoros",
            "airport": ""
          },
          {
            "code": "YVB",
            "location": "Bonaventure, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "YVC",
            "location": "La Ronge, Saskatchewan, Canada",
            "airport": "La Ronge"
          },
          {
            "code": "YVP",
            "location": "Kuujjuaq, Quebec, Canada",
            "airport": "Fort Chimo Airport"
          },
          {
            "code": "YVR",
            "location": "Vancouver, British Columbia, Canada",
            "airport": "Vancouver International"
          },
          {
            "code": "YVZ",
            "location": "Deer Lake, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YWG",
            "location": "Winnipeg, Manitoba, Canada",
            "airport": "Winnipeg International"
          },
          {
            "code": "YWH",
            "location": "Victoria, British Columbia, Canada",
            "airport": "Victoria Inner Harbor"
          },
          {
            "code": "YWK",
            "location": "Wabush, Newfoundland, Canada",
            "airport": "Wabush Municipal"
          },
          {
            "code": "YWL",
            "location": "Williams Lake, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YWR",
            "location": "White River, Ontario, Canada",
            "airport": "White River"
          },
          {
            "code": "YXC",
            "location": "Cranbrook, British Columbia, Canada",
            "airport": "Cranbrook Airport"
          },
          {
            "code": "YXD",
            "location": "Edmonton, Alberta, Canada",
            "airport": "Edmonton Municipal"
          },
          {
            "code": "YXE",
            "location": "Saskatoon, Saskatchewan, Canada",
            "airport": "Saskatoon"
          },
          {
            "code": "YXH",
            "location": "Medicine Hat, Alberta, Canada",
            "airport": "Medicine Hat Airport"
          },
          {
            "code": "YXJ",
            "location": "Fort St John, British Columbia, Canada",
            "airport": "Fort St John"
          },
          {
            "code": "YXL",
            "location": "Sioux Lookout, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YXS",
            "location": "Prince George, British Columbia, Canada",
            "airport": "Prince George BC"
          },
          {
            "code": "YXT",
            "location": "Terrace, British Columbia, Canada",
            "airport": "Terrace"
          },
          {
            "code": "YXU",
            "location": "London, Ontario, Canada",
            "airport": "London Municipal"
          },
          {
            "code": "YXY",
            "location": "Whitehorse, Yukon Territory, Canada",
            "airport": "Whitehorse Airport"
          },
          {
            "code": "YXZ",
            "location": "Wawa, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YYB",
            "location": "North Bay, Ontario, Canada",
            "airport": "Jack Garland Airport"
          },
          {
            "code": "YYC",
            "location": "Calgary, Alberta, Canada",
            "airport": "Calgary Intl Airport"
          },
          {
            "code": "YYD",
            "location": "Smithers, British Columbia, Canada",
            "airport": "Smithers International"
          },
          {
            "code": "YYF",
            "location": "Penticton, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "YYG",
            "location": "Charlottetown, Prince Edward Island/, Canada",
            "airport": "Charlottetown"
          },
          {
            "code": "YYJ",
            "location": "Victoria, British Columbia, Canada",
            "airport": "Victoria Airport"
          },
          {
            "code": "YYQ",
            "location": "Churchill, Manitoba, Canada",
            "airport": "Churchill Airport"
          },
          {
            "code": "YYR",
            "location": "Goose Bay, Newfoundland, Canada",
            "airport": "Goose Bay Municipal Airpt"
          },
          {
            "code": "YYT",
            "location": "St Johns, Newfoundland, Canada",
            "airport": "St John's International"
          },
          {
            "code": "YYU",
            "location": "Kapuskasing, Ontario, Canada",
            "airport": ""
          },
          {
            "code": "YYY",
            "location": "Mont Joli, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "YYZ",
            "location": "Toronto, Ontario, Canada",
            "airport": "Pearson International Airport"
          },
          {
            "code": "YZF",
            "location": "Yellowknife, Northwest Territories, Canada",
            "airport": ""
          },
          {
            "code": "YZT",
            "location": "Port Hardy, British Columbia, Canada",
            "airport": "Port Hardy Airport"
          },
          {
            "code": "YZV",
            "location": "Sept-Iles, Quebec, Canada",
            "airport": ""
          },
          {
            "code": "ZAG",
            "location": "Zagreb, Croatia (Hrvatska)",
            "airport": "Zagreb"
          },
          {
            "code": "ZAH",
            "location": "Zahedan, Iran",
            "airport": "Zahedan"
          },
          {
            "code": "ZAL",
            "location": "Valdivia, Chile",
            "airport": "Pichoy"
          },
          {
            "code": "ZAM",
            "location": "Zamboanga, Philippines",
            "airport": "Zamboanga Airport"
          },
          {
            "code": "ZAZ",
            "location": "Zaragoza, Spain",
            "airport": "Zaragoza"
          },
          {
            "code": "ZBV",
            "location": "Vail/Eagle, CO, USA",
            "airport": ""
          },
          {
            "code": "ZCL",
            "location": "Zacatecas, Zacatecas, Mexico",
            "airport": ""
          },
          {
            "code": "ZCO",
            "location": "Temuco, Chile",
            "airport": "Manquehue"
          },
          {
            "code": "ZDJ",
            "location": "Berne, Switzerland",
            "airport": "Berne-Rr Station"
          },
          {
            "code": "ZGI",
            "location": "Gods River, Manitoba, Canada",
            "airport": ""
          },
          {
            "code": "ZHA",
            "location": "Zhanjiang, China",
            "airport": ""
          },
          {
            "code": "ZHO",
            "location": "Houston, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "ZIH",
            "location": "Ixtapa/Zihuatanejo, Guerrero, Mexico",
            "airport": "International"
          },
          {
            "code": "ZLO",
            "location": "Manzanillo, Colima, Mexico",
            "airport": "International Airport"
          },
          {
            "code": "ZNA",
            "location": "Nanaimo, British Columbia, Canada",
            "airport": ""
          },
          {
            "code": "ZNE",
            "location": "Newman, Western Australia, Australia",
            "airport": "Newman"
          },
          {
            "code": "ZNZ",
            "location": "Zanzibar, Tanzania",
            "airport": "Kisauni"
          },
          {
            "code": "ZQN",
            "location": "Queenstown, New Zealand",
            "airport": "Frankton"
          },
          {
            "code": "ZRF",
            "location": "Rockford, IL, USA",
            "airport": ""
          },
          {
            "code": "ZRH",
            "location": "Zurich, Switzerland",
            "airport": "Zurich"
          },
          {
            "code": "ZSA",
            "location": "San Salvador, Bahamas",
            "airport": ""
          },
          {
            "code": "ZTH",
            "location": "Zakinthos, Greece",
            "airport": "Zakinthos"
          }
        ]
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}

*Intent Setter*
{
  "nodes": [
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
                    "leftValue": "={{ $json.method }}",
                    "rightValue": "set",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "3f0d7512-4754-429c-9d57-670c3796848d"
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
                    "id": "e2e83e9f-0871-4acc-ba4d-f52abf392602",
                    "leftValue": "={{ $json.method }}",
                    "rightValue": "get",
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
        -96,
        64
      ],
      "id": "540b7405-6e48-45e1-b57c-1b45560bdacf",
      "name": "Switch"
    },
    {
      "parameters": {
        "fileSelector": "=intent_{{ $('Trigger').item.json.sender }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        368,
        288
      ],
      "id": "4ef72914-d924-4db0-b76f-a02037a8015a",
      "name": "Read/Write Files from Disk",
      "alwaysOutputData": true
    },
    {
      "parameters": {
        "operation": "fromJson",
        "options": {}
      },
      "type": "n8n-nodes-base.extractFromFile",
      "typeVersion": 1,
      "position": [
        992,
        544
      ],
      "id": "0b384796-50ee-4aa1-8a75-a38845c65df0",
      "name": "Extract from File"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "ff973ea5-dce0-4a02-a12d-9b2138312db3",
              "name": "intent",
              "value": "={{ $json.data[0].intent }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1488,
        384
      ],
      "id": "1ccf19ef-cf7d-481d-bd47-576a7bd373b3",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        720,
        -320
      ],
      "id": "0c852003-7acc-45c9-972b-dea28fdeb227",
      "name": "Convert to File"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=intent_{{ $('Trigger').item.json.sender }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        944,
        -320
      ],
      "id": "aa71f462-f997-4064-b1e0-ba16ece1dd90",
      "name": "Read/Write Files from Disk1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "9a37f9dc-4842-4123-b8d1-33dc9bfa5c21",
              "name": "intent",
              "value": "={{ $json.Intent }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        512,
        -320
      ],
      "id": "43078682-60ff-44b3-ba70-c9d0dfd4857f",
      "name": "Edit Fields1",
      "executeOnce": true
    },
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "Intent"
            },
            {
              "name": "method"
            },
            {
              "name": "sender"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        -336,
        64
      ],
      "id": "cfe7bf16-9b29-462a-a95d-d9b91375240c",
      "name": "Trigger"
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
              "id": "6a91dbaf-e35d-41c1-87f3-9764cfad95e2",
              "leftValue": "={{ $json }}",
              "rightValue": "",
              "operator": {
                "type": "object",
                "operation": "empty",
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
        592,
        288
      ],
      "id": "baa531e5-1c7a-4f47-ac5a-862628b60367",
      "name": "If"
    },
    {
      "parameters": {
        "operation": "toJson",
        "options": {}
      },
      "type": "n8n-nodes-base.convertToFile",
      "typeVersion": 1.1,
      "position": [
        1232,
        80
      ],
      "id": "4ac1537f-1c66-438c-9be7-0dbf681991a9",
      "name": "Convert to File1"
    },
    {
      "parameters": {
        "operation": "write",
        "fileName": "=intent_{{ $('Trigger').item.json.sender }}.json",
        "options": {}
      },
      "type": "n8n-nodes-base.readWriteFile",
      "typeVersion": 1,
      "position": [
        1504,
        80
      ],
      "id": "6b5fb12a-14a9-4747-bd52-69274627d1a9",
      "name": "Read/Write Files from Disk2"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "9a37f9dc-4842-4123-b8d1-33dc9bfa5c21",
              "name": "intent",
              "value": "=neutral",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        944,
        80
      ],
      "id": "37762da8-57d9-429b-a2c7-9b3556edfbe3",
      "name": "Edit Fields2",
      "executeOnce": true
    },
    {
      "parameters": {
        "content": "Recibe los parámetros Intent, method y sender del flujo de trabajo llamante.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -384,
        -64
      ],
      "typeVersion": 1,
      "id": "de943dab-3abe-4cd0-bc63-de31079c6b46",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Enruta el flujo de trabajo según el método: ‘set’ para guardar el intent, ‘get’ para recuperar el intent.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -144,
        -64
      ],
      "typeVersion": 1,
      "id": "a6dd8b4d-fad3-4b82-86b7-9f340292a787",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Mapea el campo Intent a un formato estandarizado para el almacenamiento en archivo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        464,
        -448
      ],
      "typeVersion": 1,
      "id": "42e78f12-fef6-4519-a2de-c22c99250cae",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Convierte los datos de intent a formato JSON para escribir en el archivo.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        688,
        -448
      ],
      "typeVersion": 1,
      "id": "961f4489-b1d8-4b18-9aae-885a64e63da9",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Guarda los datos de intent en un archivo JSON específico del usuario en disco.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        912,
        -448
      ],
      "typeVersion": 1,
      "id": "b39440fb-d14f-4284-a84c-c59bd8ad729d",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Lee el archivo de intent existente desde disco para el remitente específico.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        320,
        192
      ],
      "typeVersion": 1,
      "id": "9cfd0580-4b96-417b-9f14-e2fb88ca7969",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "content": "Comprueba si el archivo de intent existe o está vacío para el usuario.\n\n",
        "height": 300,
        "width": 180
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        544,
        192
      ],
      "typeVersion": 1,
      "id": "6ef86b9d-cb18-4ea5-ba9a-ca0b72241f10",
      "name": "Sticky Note6"
    },
    {
      "parameters": {
        "content": "Establece el intent predeterminado ‘neutral’ cuando no existe ningún archivo.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        880,
        -48
      ],
      "typeVersion": 1,
      "id": "2e4c6145-9eeb-4850-a67f-6fff1425e1db",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "content": "Convierte el intent ‘neutral’ a JSON para crear el archivo.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1168,
        -48
      ],
      "typeVersion": 1,
      "id": "6669b93a-e8ba-4b9c-a0d3-c9e7d517da0e",
      "name": "Sticky Note8"
    },
    {
      "parameters": {
        "content": "Guarda el nuevo archivo de intent neutral en disco.\n\n",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1440,
        -48
      ],
      "typeVersion": 1,
      "id": "48ad92a2-13b4-4c6e-9c2b-eb5761dd823d",
      "name": "Sticky Note9"
    },
    {
      "parameters": {
        "content": "Analiza el archivo JSON existente para extraer los datos de intent.\n\n",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        928,
        432
      ],
      "typeVersion": 1,
      "id": "2a14452a-6e68-4d6d-92d2-bce10c3f39d8",
      "name": "Sticky Note10"
    },
    {
      "parameters": {
        "content": "Extrae y devuelve el valor actual de intent para el usuario.",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1168,
        432
      ],
      "typeVersion": 1,
      "id": "30ae3e5c-5bae-4676-8584-3473140c4978",
      "name": "Sticky Note11"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "9a37f9dc-4842-4123-b8d1-33dc9bfa5c21",
              "name": "intent",
              "value": "=neutral",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1728,
        80
      ],
      "id": "0370d942-c82c-4550-a4a9-8c17a02aec37",
      "name": "Edit Fields3",
      "executeOnce": true
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
              "id": "1f46b830-cd5f-415a-a9ca-e46e957802db",
              "leftValue": "={{ $json.data[0].intent }}",
              "rightValue": "",
              "operator": {
                "type": "string",
                "operation": "exists",
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
        1200,
        544
      ],
      "id": "956bcf28-83ba-402d-90e6-c5ef5b147f33",
      "name": "If1"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "ff973ea5-dce0-4a02-a12d-9b2138312db3",
              "name": "intent",
              "value": "=neutral",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        1488,
        720
      ],
      "id": "716a2231-2be2-4602-bf21-f6c632c94cc3",
      "name": "Edit Fields4"
    }
  ],
  "connections": {
    "Switch": {
      "main": [
        [
          {
            "node": "Edit Fields1",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Read/Write Files from Disk",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk": {
      "main": [
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract from File": {
      "main": [
        [
          {
            "node": "If1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields1": {
      "main": [
        [
          {
            "node": "Convert to File",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
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
    "If": {
      "main": [
        [
          {
            "node": "Edit Fields2",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Extract from File",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to File1": {
      "main": [
        [
          {
            "node": "Read/Write Files from Disk2",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Read/Write Files from Disk2": {
      "main": [
        [
          {
            "node": "Edit Fields3",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Edit Fields2": {
      "main": [
        [
          {
            "node": "Convert to File1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If1": {
      "main": [
        [
          {
            "node": "Edit Fields",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Edit Fields4",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "Trigger": [
      {
        "Intent": "neutral",
        "method": "get",
        "sender": "5492954602920"
      }
    ]
  },
  "meta": {
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}
*Update Price*
{
  "nodes": [
    {
      "parameters": {
        "documentId": {
          "__rl": true,
          "value": "1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q",
          "mode": "list",
          "cachedResultName": "Travel Booking Data",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit?usp=drivesdk"
        },
        "sheetName": {
          "__rl": true,
          "value": 2113820245,
          "mode": "list",
          "cachedResultName": "scrapped",
          "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1lkGOdQbWyuuM-XMi9tPLhJTIv27oxzDcOESTO4MUw4Q/edit#gid=2113820245"
        },
        "filtersUI": {
          "values": [
            {
              "lookupColumn": "Pdf_link",
              "lookupValue": "={{ $json.pdf_link }}"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4.5,
      "position": [
        224,
        80
      ],
      "id": "bc0f2620-a429-4f85-abe8-2d6c53feffde",
      "name": "Google Sheets",
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "9KqISDbOZKSxBOPv",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.pdfmonkey.io/api/v1/documents",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document\": {\n    \"document_template_id\": \"30b142bf-1dd9-432d-8261-5287556dc9fc\",\n    \"status\": \"pending\",\n    \"payload\": {{ $json.toJsonString() }}\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        800,
        -368
      ],
      "id": "64d42d8a-b5f3-4579-ba70-c681546738c7",
      "name": "Create PDF1",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "url": "=https://api.pdfmonkey.io/api/v1/documents/{{ $json.document.id }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1104,
        80
      ],
      "id": "a699be90-5cfc-468b-885d-c7d210475459",
      "name": "Get PDF",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "success",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1328,
        -16
      ],
      "id": "207625d7-d6b3-4365-b59c-841ed14ce1a8",
      "name": "If1"
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
              "id": "7f983b5d-70ea-4842-8dc8-52ba0b7ef9ab",
              "leftValue": "={{ $json.document.status }}",
              "rightValue": "failure",
              "operator": {
                "type": "string",
                "operation": "equals",
                "name": "filter.operator.equals"
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
        1600,
        352
      ],
      "id": "27f54a84-0178-42e2-8f76-f3ddd127f782",
      "name": "If"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            {
              "id": "3b95a5cb-735a-42ce-9045-c30751e35b2e",
              "name": "Pdf_link",
              "value": "={{ $('Google Drive').item.json.webViewLink }}",
              "type": "string"
            }
          ]
        },
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [
        2432,
        -64
      ],
      "id": "8866f2ed-68cf-4e69-8a36-c502d5d62a97",
      "name": "Edit Fields"
    },
    {
      "parameters": {
        "jsCode": "let payload = JSON.parse($input.first().json.Payload);\n\nconst trigger = $('Trigger').first().json;\n\nif (trigger.priceOne !== undefined && trigger.priceOne !== null) {\n  if (payload.selected_flights[0]?.price?.amount !== undefined) {\n    payload.selected_flights[0].price.amount = `${trigger.priceOne}`;\n  }\n}\n\nif (trigger.priceTwo !== undefined && trigger.priceTwo !== null) {\n  if (payload.selected_flights[1]?.price?.amount !== undefined) {\n    payload.selected_flights[1].price.amount = `${trigger.priceTwo}`;\n  }\n}\n\nreturn payload;\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        560,
        -384
      ],
      "id": "09bed854-ad72-45f7-81ff-28977b98c8cf",
      "name": "Code",
      "executeOnce": true
    },
    {
      "parameters": {
        "workflowInputs": {
          "values": [
            {
              "name": "pdf_link"
            },
            {
              "name": "priceOne"
            },
            {
              "name": "priceTwo"
            }
          ]
        }
      },
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "position": [
        0,
        64
      ],
      "id": "28730ed5-20fa-4e77-9c7f-dbc6d27d5957",
      "name": "Trigger"
    },
    {
      "parameters": {
        "name": "=temp",
        "driveId": {
          "__rl": true,
          "mode": "list",
          "value": "My Drive"
        },
        "folderId": {
          "__rl": true,
          "value": "1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN",
          "mode": "list",
          "cachedResultName": "PDF",
          "cachedResultUrl": "https://drive.google.com/drive/folders/1CpMBmzElnB9ButEbT0ET9ngnsvwU8fKN"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        1760,
        -64
      ],
      "id": "a0f7c28a-963d-40da-b9b2-a7f3155b02b2",
      "name": "Google Drive",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "operation": "share",
        "fileId": {
          "__rl": true,
          "value": "={{ $json.id }}",
          "mode": "id"
        },
        "permissionsUi": {
          "permissionsValues": {
            "role": "reader",
            "type": "anyone"
          }
        },
        "options": {}
      },
      "type": "n8n-nodes-base.googleDrive",
      "typeVersion": 3,
      "position": [
        1984,
        -64
      ],
      "id": "6a523928-a019-492c-bf89-313b065370aa",
      "name": "Google Drive1",
      "credentials": {
        "googleDriveOAuth2Api": {
          "id": "5xvSDwZhcRMo0LJf",
          "name": "Google Drive account"
        }
      }
    },
    {
      "parameters": {
        "url": "={{ $json.document.download_url }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        1552,
        -64
      ],
      "id": "52524b78-0a43-4d9f-adc7-5c5fce835cd4",
      "name": "HTTP Request"
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
            "sender": "={{ $('Google Sheets').item.json.Contact_Id.toString() }}"
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
        2208,
        -64
      ],
      "id": "6197d849-4631-4867-87df-585c97339519",
      "name": "Execute Workflow"
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
                    "leftValue": "={{ $json.Travel_Type }}",
                    "rightValue": "Vuelo",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "3e127312-04f5-469f-9157-b27801e03de1"
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
                    "id": "27a2032a-3937-42cd-91b3-968afa5f6159",
                    "leftValue": "={{ $json.Travel_Type }}",
                    "rightValue": "Hotel",
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
        448,
        80
      ],
      "id": "64e71f0d-cf39-4aa5-9bf8-df718e4b88f4",
      "name": "Switch"
    },
    {
      "parameters": {
        "jsCode": "let payload = JSON.parse($input.first().json.Payload);\n\nconst trigger = $('Trigger').first().json;\n\nif (trigger.priceOne !== undefined && trigger.priceOne !== null) {\n  if (payload.best_hotels[0]?.price !== undefined) {\n    payload.best_hotels[0].price = `${trigger.priceOne}`;\n  }\n}\n\nif (trigger.priceTwo !== undefined && trigger.priceTwo !== null) {\n  if (payload.best_hotels[1]?.price !== undefined) {\n    payload.best_hotels[1].price = `${trigger.priceTwo}`;\n  }\n}\n\nreturn payload;\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        672,
        160
      ],
      "id": "c03a8310-8fe4-4ae0-86e6-63f1fd1f6a55",
      "name": "Code1",
      "executeOnce": true
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.pdfmonkey.io/api/v1/documents",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"document\": {\n    \"document_template_id\": \"CFE4B8AE-0377-4B18-9A20-01134D51A108\",\n    \"status\": \"pending\",\n    \"payload\": {{ $json.toJsonString() }}\n  }\n}\n",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [
        880,
        160
      ],
      "id": "fce259de-4eb4-4be8-84ed-7d2c6850108c",
      "name": "Create PDF",
      "credentials": {
        "httpHeaderAuth": {
          "id": "qc5a8nZkcy3nHGTU",
          "name": "Header Auth account"
        }
      }
    },
    {
      "parameters": {
        "content": "Receives PDF link and new prices for updating from calling workflow",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        -80,
        -96
      ],
      "typeVersion": 1,
      "id": "d00d5f05-eac4-4312-aff6-bc2f1e98c360",
      "name": "Sticky Note5"
    },
    {
      "parameters": {
        "content": "Finds existing PDF data in scrapped sheet using PDF link",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        144,
        -80
      ],
      "typeVersion": 1,
      "id": "2c6a7ace-e3e4-4e8c-954a-b4103a2176e0",
      "name": "Sticky Note"
    },
    {
      "parameters": {
        "content": "Routes workflow based on travel type: Vuelo (flights) or Hotel",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        368,
        -80
      ],
      "typeVersion": 1,
      "id": "9c10c546-67eb-45d9-a293-97afbde663cf",
      "name": "Sticky Note1"
    },
    {
      "parameters": {
        "content": "Updates flight prices in payload data with new priceOne and priceTwo",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        480,
        -528
      ],
      "typeVersion": 1,
      "id": "a4beb393-8166-4d00-bd19-3a0495211611",
      "name": "Sticky Note2"
    },
    {
      "parameters": {
        "content": "Updates hotel prices in payload data with new priceOne and priceTwo",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        592,
        0
      ],
      "typeVersion": 1,
      "id": "0febe0a4-d98a-4232-b5c0-967ac2f9f056",
      "name": "Sticky Note3"
    },
    {
      "parameters": {
        "content": "Creates new PDF with updated flight prices using flight template",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        752,
        -496
      ],
      "typeVersion": 1,
      "id": "5464e314-5abb-4db1-b50d-86643faf4258",
      "name": "Sticky Note4"
    },
    {
      "parameters": {
        "content": "Creates new PDF with updated hotel prices using hotel template",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        800,
        0
      ],
      "typeVersion": 1,
      "id": "b1aa1d6e-2e57-4a5f-919b-a961cdfbfe02",
      "name": "Sticky Note6"
    },
    {
      "parameters": {
        "content": "Polls PDF generation status and waits for completion",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1024,
        -80
      ],
      "typeVersion": 1,
      "id": "5aabd7f3-8f79-4d4e-ba85-45bc0e52af28",
      "name": "Sticky Note7"
    },
    {
      "parameters": {
        "content": "Checks if PDF generation was successful",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1248,
        -144
      ],
      "typeVersion": 1,
      "id": "84fa3d4b-b388-4c2d-91ad-405c59929017",
      "name": "Sticky Note8"
    },
    {
      "parameters": {
        "content": "Checks if PDF generation failed and retries",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1520,
        224
      ],
      "typeVersion": 1,
      "id": "b9eaa9f3-a83c-4313-a4ce-61df64e75503",
      "name": "Sticky Note9"
    },
    {
      "parameters": {
        "content": "Downloads the generated PDF from PDF Monkey",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1472,
        -208
      ],
      "typeVersion": 1,
      "id": "46439357-86ad-4499-997b-a8bce59ec852",
      "name": "Sticky Note10"
    },
    {
      "parameters": {
        "content": "Uploads PDF to Google Drive temp folder",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1680,
        -208
      ],
      "typeVersion": 1,
      "id": "bf11c164-2a2b-4c01-82d8-cafa2534ed53",
      "name": "Sticky Note11"
    },
    {
      "parameters": {
        "content": "Sets PDF sharing permissions to public for viewing",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        1904,
        -208
      ],
      "typeVersion": 1,
      "id": "686d2892-5d2d-4aba-93d6-959d32475ec2",
      "name": "Sticky Note12"
    },
    {
      "parameters": {
        "content": "Resets user intent to neutral via Intent Setter workflow",
        "height": 300,
        "width": 220
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        2160,
        -160
      ],
      "typeVersion": 1,
      "id": "d7c6276c-310f-4b99-84dc-2d6101684c75",
      "name": "Sticky Note13"
    },
    {
      "parameters": {
        "content": "Returns updated PDF link for use by calling workflow",
        "height": 300,
        "width": 200
      },
      "type": "n8n-nodes-base.stickyNote",
      "position": [
        2384,
        -160
      ],
      "typeVersion": 1,
      "id": "77279980-99cf-4b5a-8d51-ed5c30a70e4f",
      "name": "Sticky Note14"
    }
  ],
  "connections": {
    "Google Sheets": {
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
    "Create PDF1": {
      "main": [
        [
          {
            "node": "Get PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get PDF": {
      "main": [
        [
          {
            "node": "If1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If1": {
      "main": [
        [
          {
            "node": "HTTP Request",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "If",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "If": {
      "main": [
        [],
        [
          {
            "node": "Get PDF",
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
            "node": "Create PDF1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Trigger": {
      "main": [
        [
          {
            "node": "Google Sheets",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive": {
      "main": [
        [
          {
            "node": "Google Drive1",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Drive1": {
      "main": [
        [
          {
            "node": "Execute Workflow",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Google Drive",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Execute Workflow": {
      "main": [
        [
          {
            "node": "Edit Fields",
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
            "node": "Code",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Code1",
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
            "node": "Create PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create PDF": {
      "main": [
        [
          {
            "node": "Get PDF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {
    "Trigger": [
      {
        "pdf_link": "https://drive.google.com/file/d/13LvwOvrt4NNyWPCZgaP6m6o7VA1eJ_GE/view",
        "priceOne": "2830",
        "priceTwo": "2690"
      }
    ]
  },
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "a97f78a4d8f8baaf2a8455c0677e7fcb42fabd955ed4e72e52d257c2e02227a3"
  }
}