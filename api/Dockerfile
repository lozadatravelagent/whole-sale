# ============================================
# RAILWAY CACHE INVALIDATION - DO NOT MERGE STAGES
# Build everything in ONE stage to prevent Railway cache reuse
# ============================================
FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json tsconfig.json ./

# Install ALL dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Remove devDependencies to keep only production deps
RUN npm prune --omit=dev

# Verify fastify exists (fail if missing)
RUN ls -la node_modules/fastify || (echo "CRITICAL ERROR: fastify not found!" && exit 1)

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
