.PHONY: install build dev docker-build docker-up docker-down clean

# Docker image and container names
IMAGE_NAME = static-youtube-gen
CONTAINER_NAME = static-youtube-gen-app

# Development commands
install:
	npm install

build:
	NEXT_TYPESCRIPT_COMPILE_BLOCKER=true npm run build -- --no-lint

dev:
	npm run dev

# Docker commands
docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# Cleanup commands
clean:
	rm -rf .next
	rm -rf node_modules
	rm -rf build

# Combined commands
setup: install build

restart: docker-down docker-up

# Default command
all: setup

help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make build      - Build Docker image"
	@echo "  make dev        - Run local development server"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up  - Run the container in development mode"
	@echo "  make docker-down - Stop and remove the container"
	@echo "  make clean      - Clean up Docker resources"
	@echo "  make setup      - Install dependencies and build"
	@echo "  make restart    - Restart the container"
	@echo "  make all        - Install dependencies, build, and run"
	@echo "  make logs       - View container logs"
	@echo "  make test       - Run tests"

run:
	docker compose up -d

stop:
	docker compose down

prod:
	docker compose -f docker-compose.yml up --build -d

logs:
	docker compose logs -f

test:
	npm run test 