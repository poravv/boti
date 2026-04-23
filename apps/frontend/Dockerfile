FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy all package.json files for dependency resolution
COPY package.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/core ./packages/core
COPY apps/frontend ./apps/frontend

# Build the app
RUN npm run build -w @boti/frontend

FROM nginx:stable-alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
