# Use a Node.js base image
FROM node:20-slim

# Install Python and build dependencies
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy scraper requirements and set up python virtual environment
COPY scraper/requirements.txt ./scraper/
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir -r scraper/requirements.txt

# Copy backend and scraper code
COPY backend/ ./backend/
COPY scraper/ ./scraper/

# Set working directory to backend
WORKDIR /app/backend

# Expose backend port
EXPOSE 3001

# Command to run backend
CMD ["node", "server.js"]
