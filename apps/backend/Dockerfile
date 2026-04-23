FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++ openssl libc6-compat

# Copy all package.json files for dependency resolution
COPY package.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies for the whole workspace
RUN npm install

# Copy source code
COPY packages/core ./packages/core
COPY apps/backend ./apps/backend

# Generate Prisma client
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build core and backend
WORKDIR /app
RUN npm run build -w @boti/core -w @boti/backend

# Use a startup script to handle migrations
COPY apps/backend/start.sh ./apps/backend/start.sh
RUN chmod +x ./apps/backend/start.sh

FROM node:20-alpine

WORKDIR /app

# Ensure runtime dependencies are present
RUN apk add --no-cache openssl libc6-compat

# Copy hoisted node_modules from root (contains everything in a workspace setup)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy core package
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json

# Copy backend package
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/start.sh ./apps/backend/start.sh

EXPOSE 3001

WORKDIR /app/apps/backend
CMD ["./start.sh"]
