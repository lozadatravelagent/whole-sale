# WholeSale Connect AI - Fastify API Gateway

Modern API Gateway built with Fastify, replacing Supabase Edge Functions for improved performance and scalability.

## Architecture

```
Middleware Chain: CORS → Correlation ID → Auth → Rate Limit → Execute
```

### Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4.x
- **Database**: Supabase PostgreSQL
- **Cache/Rate Limiting**: Upstash Redis
- **Logging**: Pino (structured JSON)
- **Language**: TypeScript 5.x

## Project Structure

```
api/
├── src/
│   ├── routes/v1/
│   │   ├── search.ts       # Travel search endpoint
│   │   └── health.ts       # Health check endpoints
│   ├── middleware/
│   │   ├── cors.ts         # CORS configuration
│   │   ├── correlation.ts  # Correlation ID tracking
│   │   ├── auth.ts         # API key authentication
│   │   └── rateLimit.ts    # Redis-based rate limiting
│   ├── services/
│   │   └── apiKeyAuth.ts   # API key validation service
│   ├── lib/
│   │   ├── redis.ts        # Upstash Redis client
│   │   ├── supabase.ts     # Supabase client
│   │   └── logger.ts       # Pino logger with correlation IDs
│   └── server.ts           # Main server entry point
├── Dockerfile              # Multi-stage Docker build
├── package.json
└── tsconfig.json
```

## Environment Variables

Required environment variables:

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
```

## Development

### Install Dependencies

```bash
cd api/
npm install
```

### Run Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Type Check

```bash
npm run typecheck
```

## Docker

### Build Image

```bash
docker build -t wholesale-api .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e SUPABASE_URL=xxx \
  -e SUPABASE_SERVICE_ROLE_KEY=xxx \
  -e UPSTASH_REDIS_REST_URL=xxx \
  -e UPSTASH_REDIS_REST_TOKEN=xxx \
  wholesale-api
```

## Deployment (Railway)

### Setup

1. Create new project in Railway
2. Connect to GitHub repository
3. Set root directory to `/api`
4. Add environment variables

### Environment Variables (Railway)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
PORT (auto-assigned by Railway)
```

### Deploy

Railway will automatically:
1. Detect Dockerfile
2. Build multi-stage image
3. Deploy to production
4. Expose public URL

## API Endpoints

### Health Checks

```bash
# Basic health check
GET /v1/health

# Detailed health check (with Redis/Supabase status)
GET /v1/health/detailed
```

### Search (Protected)

```bash
POST /v1/search
Headers:
  X-API-Key: wsk_prod_xxx
  X-Correlation-ID: optional-uuid
  Content-Type: application/json

Body:
{
  "request_id": "req_test_001",
  "prompt": "vuelo a miami del 15 al 25 de enero"
}
```

**Response Headers:**
- `X-RateLimit-Limit`: Rate limit threshold
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp for reset
- `X-RateLimit-Window`: Current window (minute/hour/day)
- `X-Correlation-ID`: Request correlation ID

## Features

### ✅ Implemented (Phase 2)

- [x] Fastify server with Pino logging
- [x] CORS middleware
- [x] Correlation ID tracking
- [x] API key authentication (Supabase)
- [x] Redis-based rate limiting (sliding window)
- [x] Redis-based idempotency cache (5 min TTL)
- [x] Health check endpoints
- [x] Full `/v1/search` execution path ported from the `api-search` Edge Function
- [x] Structured JSON logging
- [x] Multi-stage Docker build
- [x] Graceful shutdown

### 🔄 To Be Implemented

- [ ] Circuit breakers (Opossum)
- [ ] OpenTelemetry integration
- [ ] OpenAPI/Swagger documentation
- [ ] Request/response validation (Zod schemas)

## Performance Expectations

**Rate Limiting:**
- PostgreSQL (3 COUNTs): ~100-200ms
- Redis (1 pipeline): ~20-40ms
- **Improvement**: ~80-160ms per request

**Idempotency Cache:**
- Full search: ~20-30s
- Cached response: <1s
- **Improvement**: 95%+ faster on retries

## Monitoring

### Logs

All logs are structured JSON with correlation IDs:

```json
{
  "level": "info",
  "correlation_id": "uuid",
  "type": "RATE_LIMIT_CHECK",
  "message": "Checking rate limit (Redis: true)",
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

### Health Checks

Railway will automatically ping `/v1/health` for liveness checks.

## Migration Plan

### Phase 2 (Current)

1. ✅ Create Fastify API structure
2. ✅ Implement middleware chain
3. ✅ Deploy to Railway
4. ✅ Port full search execution path from the `api-search` Edge Function
5. 🔄 Add/maintain proxy path where backward compatibility is still required
6. 🔄 Gradual traffic migration (0% → 100%)

### Phase 3 (Future)

1. Circuit breakers for provider calls
2. OpenTelemetry tracing
3. OpenAPI documentation
4. Comprehensive integration tests
