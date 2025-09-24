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

# Copy built application
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE $PORT

# Start the application
CMD ["serve", "-s", "dist", "-p", "$PORT"]
