# ============================================
# Stage 1: Builder - Build and prepare dependencies
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install ALL dependencies (dev + prod) for building
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# Remove devDependencies, keep only production deps
RUN npm prune --omit=dev

# ============================================
# Stage 2: Runtime - Minimal production image
# IMPORTANT: Changed stage name to force Railway cache invalidation
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Cache invalidation marker - change this value to force rebuild
ARG REBUILD_MARKER=20251216-nuclear-fix
RUN echo "Rebuild marker: ${REBUILD_MARKER}"

# Copy package.json for metadata
COPY package*.json ./

# Copy ONLY production node_modules from builder
# This bypasses Railway's cached npm install layers completely
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Verify critical dependency exists (fail build if missing)
RUN ls -la node_modules/fastify || (echo "❌ CRITICAL: fastify not found!" && exit 1)

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port = Number(process.env.PORT) || 3000; require('http').get({ host: '127.0.0.1', port, path: '/v1/health' }, (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start server
CMD ["node", "dist/server.js"]
