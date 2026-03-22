FROM node:20-slim

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package files (required for npm workspaces)
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install dependencies with cache layer
RUN npm ci

# Copy all source files
COPY . .

# Build frontend then backend
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
