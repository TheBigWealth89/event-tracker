FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json ./

# Install all dependencies including dev dependencies 
RUN npm ci --ignore-scripts

# Copy entire source code
COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy only package files 
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Worker doesn't need to expose port 5000 or have an HTTP healthcheck

# Default command for Worker
CMD ["node", "dist/workers/index.js"]
