.PHONY: build run stop clean dev docker-dev prod logs test help

# Docker image and container names
IMAGE_NAME = static-youtube-gen
CONTAINER_NAME = static-youtube-gen-app

help:
	@echo "Available commands:"
	@echo "  make build      - Build Docker image"
	@echo "  make run        - Run the container in development mode"
	@echo "  make stop       - Stop and remove the container"
	@echo "  make clean      - Clean up Docker resources"
	@echo "  make dev        - Run local development server"
	@echo "  make docker-dev - Run development server in Docker"
	@echo "  make prod       - Run production build and server"
	@echo "  make logs       - View container logs"
	@echo "  make test       - Run tests"

build:
	docker compose build

run:
	docker compose up -d

stop:
	docker compose down

clean: stop
	docker compose down --rmi all --volumes --remove-orphans
	rm -rf .next
	rm -rf node_modules

dev:
	npm run dev

docker-dev:
	docker compose up --build

prod:
	docker compose -f docker-compose.yml up --build -d

logs:
	docker compose logs -f

test:
	npm run test 