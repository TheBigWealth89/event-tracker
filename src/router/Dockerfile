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

# Copy static assets and views (tsc doesn't copy these)
COPY --from=builder /app/src/views ./dist/views
COPY --from=builder /app/src/public ./dist/public

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

# Health check for API
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Default command for API
CMD ["node", "dist/index.js"]
