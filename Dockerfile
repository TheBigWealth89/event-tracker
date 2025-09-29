
#  Use an official Node.js image as the base.
# 'alpine' is a lightweight version of Linux, great for production.
FROM node:20-alpine AS base

# Set the working directory inside the container
WORKDIR /app

#  Install dependencies
# This is a clever trick for caching. We only copy package.json first.
# If package.json doesn't change, Docker will use a cached layer for this step, making builds faster.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

#  Build the application (if you were using TypeScript, this step would compile it)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

#  Production image
# This creates the final, clean image with only what's needed to run the app.
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/views ./views

# Expose the port the app runs on
EXPOSE 3000

# The command to start the application when the container starts
CMD ["ts-node", "src/index.ts"]
CMD ["ts-node", "src/workers/index.ts"]