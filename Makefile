.PHONY: help dev prod dev-docker prod-docker build stop clean install logs

# Default target
help:
	@echo "Available targets:"
	@echo "  make dev          - Run development server locally (npm run dev)"
	@echo "  make prod         - Run production server locally (npm start)"
	@echo "  make dev-docker   - Run development server in Docker"
	@echo "  make prod-docker  - Run production server in Docker"
	@echo "  make build        - Build Docker image"
	@echo "  make stop         - Stop Docker containers"
	@echo "  make clean        - Stop and remove Docker containers"
	@echo "  make install      - Install npm dependencies"
	@echo "  make logs         - View Docker container logs"

# Development - Run locally with nodemon
dev:
	@echo "Starting development server..."
	@NODE_ENV=development npm run dev

# Production - Run locally
prod:
	@echo "Starting production server..."
	@NODE_ENV=production npm start

# Development - Run with Docker
dev-docker:
	@echo "Starting development server in Docker..."
	@NODE_ENV=development docker-compose up --build

# Production - Run with Docker
prod-docker:
	@echo "Starting production server in Docker..."
	@NODE_ENV=production docker-compose up --build -d

# Build Docker image
build:
	@echo "Building Docker image..."
	@docker-compose build

# Stop Docker containers
stop:
	@echo "Stopping Docker containers..."
	@docker-compose down

# Clean - Stop and remove containers, volumes
clean:
	@echo "Cleaning up Docker containers and volumes..."
	@docker-compose down -v

# Install dependencies
install:
	@echo "Installing npm dependencies..."
	@npm install

# View logs
logs:
	@echo "Viewing Docker container logs..."
	@docker-compose logs -f
