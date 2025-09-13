# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based wholesale travel CRM application called "WholeSale Connect AI" - a multi-tenant SaaS platform for travel agencies to manage leads, conversations, and booking integrations. The application is built using Vite, TypeScript, React Router, and shadcn/ui components with Tailwind CSS styling.

## Development Commands

#DON'T MAKE MOCK DATA

- `npm run dev` - Start development server (runs on port 8080)
- `npm run build` - Build for production
- `npm run build:dev` - Build for development mode
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview production build

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite with SWC plugin for fast compilation
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system variables
- **State Management**: TanStack Query for server state, React Hook Form for forms
- **Routing**: React Router v6
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Authentication**: Supabase Auth
- NO hardcoded data ni mock data

### Project Structure

```
src/
├── components/
│   ├── ui/           # shadcn/ui component library
│   ├── crm/          # CRM-specific components (LeadCard, LeadDialog)
│   └── layout/       # Layout components (MainLayout)
├── pages/            # Route-level page components
├── hooks/            # Custom React hooks (useChat, useLeads, useReports)
├── integrations/     # External service integrations (Supabase client & types)
├── lib/              # Utility libraries (utils, supabase-leads)
├── types/            # TypeScript type definitions
└── utils/            # Utility functions
```

### Key Features & Components

1. **Multi-tenant Architecture**: Supports agencies under tenants with role-based access
2. **CRM System**: Lead management with customizable sections and statuses
3. **Chat Integration**: WhatsApp and web chat conversations linked to leads
4. **Travel Integrations**: Multiple provider integrations (EUROVIPS, LOZADA, DELFOS, etc.)
5. **Quote Generation**: PDF generation for travel quotes
6. **Dashboard**: Metrics and analytics for conversion tracking

### Database Schema (Supabase)

Key entities include:
- `Tenant` - Top-level organization
- `Agency` - Travel agencies within tenants
- `User` - Agency users with role-based permissions
- `Lead` - Travel inquiries with contact, trip details, and status tracking
- `Conversation` - Chat conversations (WhatsApp/web) linked to leads
- `Integration` - External provider API credentials and status

### Styling System

The project uses a comprehensive design system with:
- CSS custom properties for colors, shadows, and transitions
- Extended Tailwind configuration with custom color palette
- Support for light/dark themes via `next-themes`
- Custom gradient backgrounds and shadow utilities

### State Management Patterns

- **Server State**: TanStack Query for API calls and caching
- **Form State**: React Hook Form with Zod validation
- **UI State**: React state for component-level interactions
- **Global State**: Minimal global state, primarily through React context

### Integration Points

- **Supabase**: Authentication, real-time database, file storage
- **Travel Providers**: External APIs for hotel/flight search and booking
- **WhatsApp Business API**: For messaging integration
- **PDF Generation**: For quote documents

### Deployment

- **Platform**: Railway
- **Environment Variables**: Configured in Railway dashboard for production deployment

## Development Guidelines

### Component Conventions
- Use shadcn/ui components as building blocks
- Follow the existing component structure in `src/components/ui/`
- Implement proper TypeScript types for all props and data structures
- Use the established color system and design tokens

### API Integration
- All Supabase interactions should go through the client in `src/integrations/supabase/client.ts`
- Use TanStack Query for data fetching with proper error handling
- Follow the established patterns in hooks like `useLeads.ts` and `useReports.ts`

### Path Resolution
- Use `@/` alias for imports from the src directory (configured in Vite and TypeScript)
- Example: `import { Button } from "@/components/ui/button"`

### Type Safety
- All major data structures are defined in `src/types/index.ts`
- Supabase types are auto-generated in `src/integrations/supabase/types.ts`
- Use proper TypeScript throughout - the project has relaxed some strict settings for development velocity

### Testing
- No specific test framework is configured - determine testing approach by examining the codebase if adding tests

## EUROVIPS WebService Integration

### Servicios Combinados - Flujos de Trabajo

#### 1. Flujo Principal: Búsqueda → Presupuesto → Reserva
Secuencia básica del proceso completo de reserva:

```
Búsqueda de tarifas → Creación de presupuesto → Conversión a reserva

searchHotelFares/searchAirFares/searchPackageFares/searchServiceFares
↓
makeBudget (usando FareId obtenido)
↓
convertToBooking
```

#### 2. Servicios de Datos Estáticos (combinables con cualquier flujo)
Estos servicios se ejecutan **antes** de las búsquedas para validar parámetros:

- **getCountryList** - Para obtener códigos de ciudades válidos
- **getAirlineList** - Para obtener códigos de aerolíneas válidos

Se usan como validación previa para asegurar que las búsquedas usen códigos correctos.

#### 3. Servicios de Consulta de Tarifas Individuales
Se ejecutan **después** de las búsquedas para obtener detalles específicos:

- **getHotelFare** - Detalles de una tarifa de hotel específica
- **getPackageFare** - Detalles de un paquete específico  
- **getServiceFare** - Detalles de un servicio específico
- **getAirFare** - Detalles de una tarifa aérea específica

#### 4. Servicios de Gestión de Reservas
Se utilizan **después** de convertToBooking para gestionar la reserva:

```
getBookingList → getBooking (consultar reservas)
addBookingPassenger/modBookingPassenger/delBookingPassenger
addBookingTransportInfo/modBookingTransportInfo/delBookingTransportInfo
addBookingComment/ackBookingComment
```

#### 5. Servicios de Gestión de Presupuestos
Para gestionar presupuestos existentes o crear con eventos especiales:

```
getBudgetList → getBudget (consultar presupuestos existentes)
addEvent → makeBudget (para crear presupuestos con eventos especiales)
```

### Flujo Completo Típico Implementado:

```
1. getCountryList (obtener códigos válidos)
2. searchHotelFares (buscar hoteles disponibles)
3. getHotelFare (detalles de tarifa seleccionada) [OPCIONAL]
4. makeBudget (crear presupuesto) [FUTURO]
5. convertToBooking (convertir a reserva) [FUTURO]
6. addBookingPassenger (agregar pasajeros) [FUTURO]
7. getBooking (consultar reserva final) [FUTURO]
```

### Estado Actual de Implementación:

#### ✅ Implementado y Funcionando:
- **getCountryList** - Obtiene códigos de ciudades válidos con caché
- **searchHotelFares** - Busca hoteles con códigos validados

#### 🔄 Por Implementar:
- **makeBudget** - Crear presupuestos desde resultados de búsqueda
- **convertToBooking** - Convertir presupuestos en reservas
- **getHotelFare** - Detalles específicos de tarifas seleccionadas
- **Gestión de pasajeros y comentarios en reservas**

Los servicios están diseñados para trabajar en conjunto siguiendo el flujo lógico: **búsqueda → presupuestación → reserva → gestión**.