# WholeSale Connect AI - Documentation Index

This directory contains all project documentation organized by category for easy navigation and context for AI assistants (Claude Code, Cursor, etc.).

## 📁 Documentation Structure

### 🔌 [API Documentation](./api/)
External API integration guides and references.

- **[MANUALWEBSERVICESBRIDGEv2_4_6.md](./api/MANUALWEBSERVICESBRIDGEv2_4_6.md)** - Original SOFTUR/EUROVIPS XML WebService manual
- **[Softur - API GUIDE.md](./api/Softur%20-%20API%20GUIDE.md)** - Complete SOFTUR API guide with workflows and examples
- **[api_structure_analysis.md](./api/api_structure_analysis.md)** - Analysis of API structure and integration patterns
- **[examples/](./api/examples/)** - Real API response examples for testing and development
  - `flight-responses/` - 6 Starling TVC flight search response examples

**When to use**: Integrating with EUROVIPS/SOFTUR APIs, understanding hotel/flight search workflows, debugging API issues, testing parsers.

---

### 🏗️ [Architecture & Technical](./architecture/)
System design, performance optimizations, and technical infrastructure.

- **[ASYNC_SEARCH_GUIDE.md](./architecture/ASYNC_SEARCH_GUIDE.md)** - Async search system implementation (50% faster searches)
- **[RATE_LIMITING_SUMMARY.md](./architecture/RATE_LIMITING_SUMMARY.md)** - Rate limiting implementation and strategy
- **[CLOUDFLARE_RATE_LIMITING_SETUP.md](./architecture/CLOUDFLARE_RATE_LIMITING_SETUP.md)** - Cloudflare rate limiting configuration
- **[context-engineering-overview.md](./architecture/context-engineering-overview.md)** - Current Emilia state, memory, tool-loop, and lifecycle architecture
- **[context-engineering-spec.md](./architecture/context-engineering-spec.md)** - Detailed Context Engineering contract and invariants
- **[tool-catalog.md](./architecture/tool-catalog.md)** - Current model-invocable tools, edge-function survey, and tracked DEBT
- **[memory-lifecycle.md](./architecture/memory-lifecycle.md)** - Memory persistence/consolidation behavior
- **[rollback-plan.md](./architecture/rollback-plan.md)** - Context Engineering rollback plan

**When to use**: Understanding system performance, implementing async patterns, configuring rate limits, troubleshooting bottlenecks.

---

### 📖 [User Guides](./guides/)
End-user documentation for features and functionality.

- **[MANUAL_USUARIO_BUSQUEDAS.md](./guides/MANUAL_USUARIO_BUSQUEDAS.md)** - User manual for travel searches
- **[CUSTOM_PDF_TEMPLATES_GUIDE.md](./guides/CUSTOM_PDF_TEMPLATES_GUIDE.md)** - Custom PDF templates setup and customization
- **[BACKGROUND_IMAGE_SYSTEM_GUIDE.md](./guides/BACKGROUND_IMAGE_SYSTEM_GUIDE.md)** - PDF background image system guide

**When to use**: Creating user documentation, implementing new features, understanding PDF customization.

---

### 💼 [Business Rules](./business-rules/)
Business logic, permissions, and role-based access control.

- **[USER_MANAGEMENT_BUSINESS_RULES.md](./business-rules/USER_MANAGEMENT_BUSINESS_RULES.md)** - Complete user management business rules and permissions matrix
- **[JERARQUIA_ROLES_Y_DASHBOARD.md](./business-rules/JERARQUIA_ROLES_Y_DASHBOARD.md)** - Role hierarchy and dashboard access rules

**When to use**: Implementing authorization, understanding role permissions, adding new user management features.

---

### 🚀 [Implementation Guides](./implementation/)
Setup instructions, migration guides, and deployment documentation.

- **[IMPLEMENTATION_SUMMARY.md](./implementation/IMPLEMENTATION_SUMMARY.md)** - Complete implementation summary of user & agency management
- **[IMPLEMENTATION_NEXT_STEPS.md](./implementation/IMPLEMENTATION_NEXT_STEPS.md)** - Next steps and future improvements
- **[test-settings-backend.md](./implementation/test-settings-backend.md)** - Backend settings testing guide

**When to use**: Setting up features, running migrations, understanding what has been implemented.

---

### 🧭 [ADRs & Current State](./adr/)
Architecture decisions and active product-state references.

- **[ADR-002-chat-unification.md](./adr/ADR-002-chat-unification.md)** - Accepted B2B/B2C chat unification decision, including the addendum that keeps `standard_itinerary` as the productive planner branch
- **[B2C_STATUS.md](./B2C_STATUS.md)** - Current Emilia B2C implementation status and remaining product refinements
- **[planner/informe_arquitectura.md](./planner/informe_arquitectura.md)** - Historical Trip Planner audit; useful for background, not authoritative for current runtime

**When to use**: Understanding why the current `/emilia/chat` surface, strict mode routing, and Context Engineering layer exist.

---

### 📦 [Archive](./archive/)
Historical documentation for resolved issues and legacy implementations.

- **[DIAGRAMA_JERARQUIA.md](./archive/DIAGRAMA_JERARQUIA.md)** - Historical hierarchy diagrams
- **[PROBLEMA_SUPERADMIN_AGENCIES.md](./archive/PROBLEMA_SUPERADMIN_AGENCIES.md)** - SUPERADMIN agencies problem (RESOLVED)
- **[RESUMEN_PROBLEMA_Y_SOLUCION.md](./archive/RESUMEN_PROBLEMA_Y_SOLUCION.md)** - Problem summary and solution
- **[RESUMEN_JERARQUIA_USERS.md](./archive/RESUMEN_JERARQUIA_USERS.md)** - User hierarchy summary
- **[SOLUCION_MULTIPLE_AGENCIES.md](./archive/SOLUCION_MULTIPLE_AGENCIES.md)** - Multiple agencies solution
- **[MODELO_CORRECTO_TENANT_SUPERADMIN.md](./archive/MODELO_CORRECTO_TENANT_SUPERADMIN.md)** - Correct tenant/superadmin model

**When to use**: Understanding historical context, reviewing resolved issues, avoiding known problems.

---

### 🗄️ [SQL Scripts](./sql/)
One-time migration scripts, fixes, and debugging queries.

- **[sql/migrations/](./sql/migrations/)** - Feature migration scripts (cache, async, rate limiting)
- **[sql/fixes/](./sql/fixes/)** - Historical fix scripts for resolved issues
- **[sql/debug/](./sql/debug/)** - Investigation and debugging queries

**When to use**: Manual migrations, debugging database issues, investigating data. See [sql/README.md](./sql/README.md) for details.

---

## 🤖 For AI Assistants (Claude Code, Cursor)

### Quick Context Loading

When working on specific tasks, load the relevant documentation:

**User Management Features**:
```
docs/business-rules/USER_MANAGEMENT_BUSINESS_RULES.md
docs/implementation/IMPLEMENTATION_SUMMARY.md
```

**Travel Search & API Integration**:
```
docs/api/Softur - API GUIDE.md
docs/architecture/ASYNC_SEARCH_GUIDE.md
```

**PDF Customization**:
```
docs/guides/CUSTOM_PDF_TEMPLATES_GUIDE.md
docs/guides/BACKGROUND_IMAGE_SYSTEM_GUIDE.md
```

**Performance & Optimization**:
```
docs/architecture/ASYNC_SEARCH_GUIDE.md
docs/architecture/RATE_LIMITING_SUMMARY.md
```

**Chat, Planner & Context Engineering**:
```
CLAUDE.md
AGENTS.md
docs/adr/ADR-002-chat-unification.md
docs/architecture/context-engineering-overview.md
docs/architecture/tool-catalog.md
docs/B2C_STATUS.md
```

---

## 📋 Root Directory Files

Some documentation remains in the root for special purposes:

- **[CLAUDE.md](../CLAUDE.md)** - Primary instructions for Claude Code (MUST STAY IN ROOT)
- **[AGENTS.md](../AGENTS.md)** - Primary instructions for Codex/agentic coding workflows
- **[README.md](../README.md)** - Project setup and overview (STANDARD LOCATION)

---

## 🔍 Finding Documentation

### By Feature
- **User Management**: `business-rules/USER_MANAGEMENT_BUSINESS_RULES.md`
- **PDF Templates**: `guides/CUSTOM_PDF_TEMPLATES_GUIDE.md`
- **Async Searches**: `architecture/ASYNC_SEARCH_GUIDE.md`
- **API Integration**: `api/Softur - API GUIDE.md`
- **Chat/Planner orchestration**: `adr/ADR-002-chat-unification.md`, `architecture/context-engineering-overview.md`

### By Task
- **Implementing features**: Start with `implementation/IMPLEMENTATION_SUMMARY.md`
- **Fixing permissions**: Check `business-rules/USER_MANAGEMENT_BUSINESS_RULES.md`
- **API debugging**: Reference `api/Softur - API GUIDE.md`
- **Performance issues**: Review `architecture/ASYNC_SEARCH_GUIDE.md`

---

## 🛠️ Maintenance

### Adding New Documentation
1. Choose appropriate category folder
2. Use descriptive filename (UPPERCASE for major docs)
3. Update this README.md index
4. Link from CLAUDE.md if needed for AI context

### Archiving Documentation
- Move resolved issue docs to `archive/`
- Add "(RESOLVED)" or "(DEPRECATED)" to title
- Keep for historical context

---

## 📊 Documentation Status

| Category | Files | Status |
|----------|-------|--------|
| API | 3 docs + examples | Current plus historical vendor references |
| Architecture | 8+ | Current for Context Engineering; older search/rate-limit docs may require prod verification |
| Guides | 3 | ✅ Current |
| Business Rules | 2 | ✅ Current |
| Implementation | 4 | Mixed: some historical implementation summaries |
| ADRs / Current State | 2+ | Current entrypoints for Emilia chat/planner decisions |
| SQL Scripts | 23 | 🔧 Reference |
| Archive | 7 | 📦 Historical |

**Last Updated**: 2026-05-03
**Note**: Source-of-truth operational instructions live in `AGENTS.md` and `CLAUDE.md`. Some older handoffs and implementation reports are intentionally preserved as history and should not be treated as runtime truth without checking current code.

---

## 🎯 Key Documentation for Common Tasks

### New Developer Onboarding
1. [../README.md](../README.md) - Project setup
2. [../CLAUDE.md](../CLAUDE.md) - Development guidelines
3. [implementation/IMPLEMENTATION_SUMMARY.md](./implementation/IMPLEMENTATION_SUMMARY.md) - Current state
4. [business-rules/USER_MANAGEMENT_BUSINESS_RULES.md](./business-rules/USER_MANAGEMENT_BUSINESS_RULES.md) - Permissions

### API Integration Work
1. [api/Softur - API GUIDE.md](./api/Softur%20-%20API%20GUIDE.md) - Complete API reference
2. [architecture/ASYNC_SEARCH_GUIDE.md](./architecture/ASYNC_SEARCH_GUIDE.md) - Search implementation

### Frontend Feature Development
1. [../CLAUDE.md](../CLAUDE.md) - Component conventions
2. [guides/CUSTOM_PDF_TEMPLATES_GUIDE.md](./guides/CUSTOM_PDF_TEMPLATES_GUIDE.md) - PDF features
3. [business-rules/USER_MANAGEMENT_BUSINESS_RULES.md](./business-rules/USER_MANAGEMENT_BUSINESS_RULES.md) - Permissions

---

## 📝 Notes

- All markdown files use GitHub-flavored markdown
- Code examples include syntax highlighting
- File paths use absolute references from project root
- Migration files referenced are in `supabase/migrations/`
- Source code references use format `file:line` for navigation

