
FROM node:20-alpine AS builder

# Set working directory inside container to /app
WORKDIR /app

# Copy package files first (takes advantage of Docker caching)
COPY package.json package-lock.json ./

# Install ALL dependencies including dev dependencies 
# --ignore-scripts: Skip npm lifecycle scripts (prepare, preinstall, etc.) 
RUN npm ci --ignore-scripts

# Copy entire source code (except what's in .dockerignore)
COPY . .

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Start fresh with same base image for production
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Set environment to production (optimizes some Node.js behaviors)
ENV NODE_ENV=production

# Copy only package files again
COPY package.json package-lock.json ./

# Install ONLY production dependencies 
# --only=production: Skip devDependencies
# --ignore-scripts: Skip npm lifecycle scripts
RUN npm ci --only=production --ignore-scripts

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security (prevents container breakout attacks)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch from root to the non-privileged user
USER nodejs

EXPOSE 5000

# Health check - Docker will monitor if app is responsive
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Command to run when container starts
CMD ["node", "dist/index.js"]