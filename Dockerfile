# Use Node.js LTS
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose port (Railway sets PORT env variable)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]