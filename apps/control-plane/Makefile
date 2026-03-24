.PHONY: help build dev test lint clean docker-build docker-run docker-stop docker-clean deploy-staging deploy-production

# Default target
help:
	@echo "Available commands:"
	@echo "  make build        - Build the application"
	@echo "  make dev          - Run in development mode"
	@echo "  make test         - Run tests"
	@echo "  make lint         - Run linting"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build  - Build Docker image"
	@echo "  make docker-run    - Run with Docker Compose"
	@echo "  make docker-stop   - Stop Docker containers"
	@echo "  make docker-clean  - Clean Docker resources"
	@echo "  make deploy-staging - Deploy to staging"
	@echo "  make deploy-production - Deploy to production"

# Development targets
dev:
	npm run start:dev

build:
	npm run build:prod

test:
	npm run test:cov

lint:
	npm run lint

clean:
	rm -rf dist
	rm -rf node_modules/.cache
	rm -rf coverage

# Docker targets
docker-build:
	docker build -t idmatr-control-plane:latest .

docker-build-dev:
	docker build -f Dockerfile.dev -t idmatr-control-plane:dev .

docker-run:
	docker-compose up -d

docker-run-dev:
	docker-compose -f docker-compose.dev.yml up -d

docker-stop:
	docker-compose down

docker-stop-dev:
	docker-compose -f docker-compose.dev.yml down

docker-clean:
	docker-compose down -v
	docker system prune -f
	docker volume prune -f

docker-logs:
	docker-compose logs -f

# Deployment targets
deploy-staging:
	@echo "🚀 Deploying to staging..."
	# Add staging deployment commands here
	# Example: kubectl apply -f k8s/staging/
	# Example: docker-compose -f docker-compose.staging.yml up -d

deploy-production:
	@echo "🚀 Deploying to production..."
	# Add production deployment commands here
	# Example: kubectl apply -f k8s/production/
	# Example: docker-compose -f docker-compose.yml up -d

# CI/CD targets
ci-install:
	npm ci

ci-test:
	npm run test:cov

ci-build:
	npm run build:prod

ci-lint:
	npm run lint

# Database targets
db-migrate:
	npx prisma migrate deploy

db-generate:
	npx prisma generate

db-seed:
	npm run db:seed

db-reset:
	npx prisma migrate reset --force && npm run db:seed

# Security targets
security-audit:
	npm audit --audit-level moderate

security-fix:
	npm audit fix

# Health check
health-check:
	curl -f http://localhost:3010/control/system/health || exit 1

# Local development setup
setup-dev:
	@echo "🔧 Setting up development environment..."
	npm install
	cp .env.example .env.development
	@echo "✅ Development environment setup complete"
	@echo "📝 Please edit .env.development with your local settings"

# Production build with optimizations
build-optimized:
	NODE_OPTIONS='--max-old-space-size=4096' npm run build:prod

# Run all quality checks
quality-check:
	npm run lint
	npm run test:cov
	npm audit --audit-level moderate
	@echo "✅ All quality checks passed"
