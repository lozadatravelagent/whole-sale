N8N Travel Booking Bot - Complete Project Documentation
Project Overview
This is a comprehensive WhatsApp-based travel booking automation system built with n8n that handles flight and hotel bookings through conversational AI. The system scrapes multiple travel APIs, generates professional PDFs, and manages the entire booking workflow from customer inquiry to final documentation.

Individual Workflow Descriptions
1.	WhatsApp Trigger (Main Entry Point)
File:

Purpose: Central hub that handles all incoming WhatsApp messages and routes them based on user
intent.

Key Features:
•	Receives WhatsApp messages via webhook
•	Uses OpenAl GPT-4 to understand natural language travel requests
•	Extracts booking data (flights/hotels) from conversational text
•	Routes users through different conversation flows
•	Handles interactive button responses for booking confirmations
•	Manages user intent tracking (booking, price updates, neutral)
•	Automatically saves structured data to Google Sheets
•	Creates PDFs for confirmed bookings and uploads to Google Drive Flow:
1. Message received	Intent detection - Data extraction —• Sheet update — Search trigger — Options display - Selection - PDF generation

2.	Flight Scrapper
File:
Purpose: Scrapes flight data from Icaro travel API with date formatting and data processing.
 
Key Features:
•	Formats dates to DDMMM format (e.g., "15JUL")
•	Makes HTTP requests to flight search API
•	Processes flight parameters (origin, destination, adults, children, stopovers, luggage)
•	Returns structured flight data with retry information
•	Handles error cases gracefully
Data Flow: Input: Booking data -• Date formatting	API request -• Flight results

3.	filight Scrapped + API
File:
Purpose: Enhanced flight scrapper that combines Icaro API with Starling API for comprehensive flipht data.
Key Features:
•	Dual API integration for better flight coverage
•	Combines results from both APIs
•	Limits results to top 5 flights from each source
•	Merges and deduplicates flight options
•	Enhanced error handling and retry logic

4.	Hotel Scrapped
File:
Purpose: Scrapes hotel data from two different APIs (Delfos and Lozada) for comprehensive accommodation options.
Key Features:
•	Dual API calls to maximize hotel inventory
•	Processes hotel search parameters (destination, check-in/out dates, guests)
•	Returns combined results from both sources
•	Handles different response formats from each API
•	Error handling for failed API calls
 
5.	Starling API File:
Purpose: Integrates with Starling flight booking API to provide additional flight options with structured data processing.
Key Features:
•	Uses OpenAl to transform booking data into proper API format
•	Authenticates with Starling API using tokens
•	Processes complex flight data structures
•	Maps IATA airport codes to city names
•	Formats flipht information for user display
•	Handles layovers and flight duration calculations Advanced Processing:
•	IATA code lookup with 1000+ airport mappings
•	Flight leg processing with departure/arrival details
•	Layover calculation and formatting
•	Price formatting with currency support

6.	Send Options
File:
Purpose: Formats and sends flight/hotel options to users via WhatsApp with interactive buttons. Key Features:
•	Creates rich WhatsApp interactive messages
•	Formats flipht data with emojis and structured text
•	Generates hotel information cards
•	Creates selection buttons for each option
•	Saves user selection state to JSON files
•	Handles both flight and hotel data formatting Message Format:
 
•	  Flight: Airline, route, duration, stops, price
•	  Hotel: Name, location, stars, price, dates

7.	filight Trigger
File:
Purpose: Monitors Google Sheets for new flight requests and orchestrates the search and response process.
Key Features:
•	Polls Google Sheets every minute for new flight entries
•	Triggers flight scraping workflows
•	Validates search results
•	Sends "no flights found" messages for failed searches
•	Logs errors to dedicated error sheet
•	Cleans up processed entries
•	Automated workflow orchestration

8.	Hotel Trigger
File:
Purpose: Similar to Flight Trigger but specifically handles hotel booking requests. Key Features:
•	Monitors hotel sheet for new entries
•	Validates hotel search results from multiple sources
•	Combines Delfos and Lozada results
•	Error handling and logging
•	Automated cleanup of processed requests

9.	Intent Setter
File:
Purpose: Manages user conversation state and intent tracking across sessions.
 
Key Features:
•	Stores user intent in JSON files (booking, priceUpdate, neutral)
•	Supports both "set" and "get" operations
•	File-based state management per user
•	Handles missing intent files gracefully
•	Session persistence across conversations

10.	Update Price
File:
Purpose: Allows users to update prices in existing booking PDFs by regenerating documents with new pricing.
Key Features:
•	Retrieves existing booking data from Google Sheets
•	Updates flight or hotel prices based on user input
•	Regenerates PDF with updated pricing
•	Uses different templates for flights vs hotels
•	Uploads updated PDF to Google Drive
•	Shares with public access for easy viewing
Process: Input: PDF link + new prices	Retrieve data	Update prices	Generate new PDF	Upload Share link

Complete Project Workflow
Phase 1: Customer Inquiry
1.	Customer sends WhatsApp message (e.g., "I need a flight from Madrid to Barcelona on July 15th")
2.	WhatsApp Trigger receives message
3.	OpenAl GPT-4 extracts structured data:
•	Travel type (Flight/Hotel/Both)
•	Origin/Destination
•	Dates
•	Passenger details
 
•	Preferences

Phase 2: Data Processing & Search
4.	Structured data saved to appropriate Google Sheet (Flights/Hotels)
5.	Trigger workflows detect new entries and activate scrapers
6.	Flight Scrapper or Hotel Scrapper query multiple APIs:
•	Icaro API (flights)
•	Starling API (flights)
•	Delfos API (hotels)
•	Lozada API (hotels)

Phase 3: Results Presentation
7.	Send Options workflow formats results into rich WhatsApp messages
8.	Customer receives interactive buttons with top options
9.	Each option shows detailed information with emojis and formatting
Phase 4: Selection & Confirmation
10.	Customer taps selection buttons
11.	System tracks selections using JSON file storage
12.	After selecting required options (2 for flights, 2 for hotels):
•	PDF generation begins using PdfMonkey API
•	Different templates for flights vs hotels
•	Professional formatting with booking details

Phase S: Document Delivery
13.	Generated PDF uploaded to Google Drive
14.	Public sharing link created
15.	WhatsApp message sent with PDF link
16.	Trello card created for booking tracking
17.	Data logged to scrapped sheet for records
18.	Cleanup of temporary data
Phase 6: Post-Booking Services
 
19.	Price Update functionality allows customers to:
•	Send existing PDF link + new prices
•	System regenerates PDF with updated pricing
•	New document delivered via WhatsApp

Technical Architecture
APIs & Integrations:
•	WhatsApp Business API - Customer communication
•	OpenAl GPT-4 - Natural language processing
•	Icaro API - Flight search
•	Starling API - Additional flight data
•	Delfos API - Hotel search
•	Lozada API - Additional hotel inventory
•	PdfMonkey API - Professional PDF generation
•	Google Sheets API - Data storage and triggers
•	Google Drive API - Document storage and sharing
•	Trello API - Booking management

DaQ filow:
WhatsApp	AI Processing	Google Sheets	API Scraping	Result Formatting	User Selection PDF Generation	Document Delivery
State Management:
•	JSON files for user selections and conversation state
•	Google Sheets for persistent booking data
•	Intent tracking for conversation flow management

Error Handling:
•	Failed searches logged to error sheets
•	Graceful fallbacks for API failures
•	Retry mechanisms for PDF generation
•	User notifications for system issues
 
Key Benefits
  Fully Automated: End-to-end booking process without human intervention   Multi-Source: Searches multiple APIs for best options
  Professional: Generates branded PDF documents
  Conversational: Natural language WhatsApp interface
  Comprehensive: Handles both flights and hotels
  Scalable: Cloud-based n8n infrastructure
  Traceable: Complete audit trail in Google Sheets
  User-Friendly: Interactive buttons and rich formatting   Flexible: Supports price updates and modifications
  Integrated: Connected to Trello for business management
This system transforms complex travel booking into a simple WhatsApp conversation, making travel planning accessible and efficient for customers while providing comprehensive business management tools for operators.
