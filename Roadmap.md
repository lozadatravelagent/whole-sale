# Technical Roadmap – VBOOK Multi-Tenant SaaS

## 0) Context

* Current: agent runs in **n8n**, triggered by a single WhatsApp number (VBOOK). ✅ **COMPLETED**
* Flow: inquiry → provider APIs → PDFMonkey → reply via WhatsApp.
* Limitation: no multi-tenancy, no SaaS, no CRM.

**Goal:** transform into a **multi-tenant B2B SaaS** where:

* Each **wholesaler** (Lozada, Eurovips, Delfos, Ícaro, Starling, etc.) purchases licenses for their **retail agencies**.
* Each **retail agency** logs into the SaaS, customizes branding, uses the chat, sees history, accesses the marketplace, CRM, and reports.
* All **three entry channels** (VBOOK WhatsApp, each wholesaler’s WhatsApp, SaaS web chat) consume the **same n8n agent**.

---

## 1) Overall Architecture

### 1.1 Entry Channels

1. **WhatsApp VBOOK** (current).
2. **WhatsApp per wholesaler** (Eurovips, Lozada, etc.).
3. **SaaS Web Chat**.

All → **Message Ingress → Router → Orchestrator → n8n → Providers → PDF → Outbox**.

### 1.2 Backend Core

* **Supabase (Postgres + Auth + Storage + Row-Level Security)**.
* **NestJS/Express** as Orchestrator API.
* **Redis + BullMQ** for job queues.
* **n8n** as a stateless worker (called by the Orchestrator).
* **PDFMonkey** for branded PDFs.
* **Meta Cloud API** for WhatsApp.

### 1.3 Frontend

* **Next.js (React)**.
* UI sections: Login, Settings (branding), Chat with history, Marketplace, CRM, Reports.

---

## 2) New Features

### 2.1 Roles & Multi-Tenancy

* **Superadmin (Wholesaler):** manages licenses, configures their WhatsApp number, sees aggregated reports.
* **Admin (Retail Agency):** logs in, customizes branding, activates integrations, manages CRM leads, and views reports.

### 2.2 Branding in PDFs

* Each agency defines logo/colors/contact info.
* Single template in PDFMonkey → dynamic variables applied per agency.

### 2.3 SaaS Web Chat

* ChatGPT-like interface.
* Conversation history stored in DB.
* Sidebar with past chats.
* API Orchestrator → n8n → responses via WS/SSE.

### 2.4 Marketplace

* Catalog of wholesalers available.
* Agencies toggle integrations (activated/disabled).
* If credentials missing → generate a lead for wholesaler.
* n8n only queries enabled providers.

### 2.5 Native CRM (mandatory)

**Purpose:** centralize all leads and conversations.

* **Leads:** name, phone/email, trip details, status (`new`, `quoted`, `negotiating`, `won`, `lost`), linked PDFs.
* **Conversations:** linked to each lead, with message history.
* **CRM Actions:** assign owners, add notes, update status.
* **Future-ready:** external CRM sync possible (HubSpot, Salesforce).

### 2.6 Reports

* **Agency-level:** number of leads, PDFs sent, conversions, revenue estimates.
* **Wholesaler-level:** active licenses, leads per agency, integration usage, provider latency/error rates.

### 2.7 Multi-Wholesaler Quotes

* PDFs may combine results (e.g., flight from Ícaro + hotel from Lozada).
* n8n merges results before sending to PDFMonkey.

### 2.8 Pre-Reservation

* “Reserve” button on PDF.
* Calls provider API to validate stock/price.
* Responds immediately if still valid.

### 2.9 Supervised Issuance

* “Issue” button in PDF.
* Agent calls booking API.
* Human validates exceptions → final confirmation.

---

## 3) Flow per Channel

### 3.1 WhatsApp (VBOOK)

1. User message → Meta webhook → Ingress.
2. Router assigns tenant=VBOOK.
3. Orchestrator → n8n → providers → PDF → reply.
4. Lead + conversation saved in CRM.

### 3.2 WhatsApp (Wholesaler)

1. User message → wholesaler number.
2. Router maps `phone_number_id` → tenant=wholesaler.
3. Agency resolved via mapping.
4. Flow same as above.
5. CRM logs lead under that agency/wholesaler.

### 3.3 SaaS Web Chat

1. User sends → POST `/ask`.
2. Orchestrator enqueues job → n8n.
3. Reply streamed via WS.
4. Conversation linked to CRM.

---

## 4) Backend Details

### 4.1 Database (Supabase/Postgres)

* `tenants`, `agencies`, `users`, `whatsapp_numbers`, `integrations`, `leads`, `conversations`, `messages`, `reports_daily`, `audit_logs`.
* Strong RLS policies by tenant/agency.

### 4.2 Orchestrator API

* Endpoints: `/ask`, `/tasks`, `/result-callback`.
* Manages tenant validation, job queues, and WS streaming.

### 4.3 n8n ✅ **COMPLETED**

* Stateless worker.
* Input = standardized JSON.
* Parallel queries to providers.
* Normalization + merge.
* PDFMonkey call.

### 4.4 WhatsApp Integration

* Meta Cloud API.
* One webhook endpoint for all numbers.
* Routing by `phone_number_id`.
* Template messages per tenant.

### 4.5 CRM Module

* Automatic lead creation on first message.
* Link conversations + PDFs.
* Kanban UI for lead states.
* Full conversation logs.

---

## 5) Migration Plan

1. Extract WA trigger from n8n → build Orchestrator.
2. Connect Vibook WA number.
3. Add Router multi-tenant support.
4. Make n8n stateless worker.
5. Build CRM (minimum: leads + conversations).
6. Add branding integration with PDFMonkey.
7. Build SaaS app: Auth, Settings, Chat.
8. Add Marketplace, CRM UI, Reports.
9. Onboard first wholesaler (e.g., Eurovips).
10. Add additional wholesaler WA numbers.

---

## 6) Conclusion

This roadmap ensures:

* All channels use the **same agent**.
* **Native CRM** centralizes leads and conversations.
* Agency branding applies to PDFs.
* Marketplace empowers agencies while protecting wholesalers.
* Reports provide granular (agency) and global (wholesaler) insights.

👉 Dev team should review architecture, validate feasibility, and suggest optimizations (e.g., replacing n8n with dedicated workers, enhancing BI for reports).