# Frontend React - Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port 8000
EXPOSE 8000

# Start Vite dev server on port 8000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8000"]
