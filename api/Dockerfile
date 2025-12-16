# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript to JavaScript
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN echo "🔍 Installing production dependencies..." && \
    npm ci --omit=dev && \
    echo "✅ Dependencies installed. Listing node_modules:" && \
    ls -la node_modules | head -20 && \
    echo "🔍 Checking if fastify exists:" && \
    ls -la node_modules/fastify 2>/dev/null || echo "❌ fastify NOT found!" && \
    npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Debug: List dist contents
RUN echo "🔍 Listing dist directory:" && \
    ls -la dist/

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
