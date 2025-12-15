# Build stage
FROM public.ecr.aws/docker/library/node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM public.ecr.aws/docker/library/node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install serve globally and production dependencies
RUN npm install -g serve && npm ci --only=production && npm cache clean --force

# Copy built application and serve config
COPY --from=builder /app/dist ./dist
COPY serve.json ./

# Expose port
EXPOSE $PORT

# Start the application with serve.json configuration
CMD ["serve", "-s", "dist", "-p", "$PORT"]
