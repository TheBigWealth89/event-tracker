
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Dependencies - Install all packages
FROM base AS deps

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies including devDependencies for building
RUN npm ci

# Compile TypeScript to JavaScript
FROM base AS build

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Production Dependencies - Install only runtime dependencies
FROM base AS prod-deps

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies (no devDependencies)
RUN npm ci --only=production

# Production - Create the final lightweight image
FROM base AS production

# Set environment to production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy built JavaScript files
COPY --from=build /app/dist ./dist

# Copy package.json for reference
COPY package.json ./

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app files
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port your app runs on
EXPOSE 3000

# Health check 
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Default command 'can be overridden in docker-compose'
CMD ["node", "dist/index.js"]