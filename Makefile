# IDMatr Deployment Makefile
# Supports: Docker Compose, AWS ECS/EKS, GCP Cloud Run/GKE, Azure AKS

.PHONY: help setup dev docker-up docker-down docker-build k8s-deploy k8s-delete migrate

REGISTRY ?= ghcr.io/your-org/idmatr
TAG ?= latest
NAMESPACE = idmatr

help:
	@echo "IDMatr Deployment Commands"
	@echo ""
	@echo "  Local Development:"
	@echo "    make setup         - Initial local setup (creates .env, starts infra, runs migrations)"
	@echo "    make dev           - Start all services in development mode"
	@echo "    make docker-up     - Start all services with Docker Compose"
	@echo "    make docker-down   - Stop all services"
	@echo ""
	@echo "  Docker:"
	@echo "    make docker-build  - Build all Docker images"
	@echo "    make docker-push   - Push images to registry (set REGISTRY=...)"
	@echo ""
	@echo "  Kubernetes:"
	@echo "    make k8s-deploy    - Deploy to current kubectl context"
	@echo "    make k8s-delete    - Remove all k8s resources"
	@echo "    make k8s-status    - Show deployment status"
	@echo ""
	@echo "  Database:"
	@echo "    make migrate       - Run Prisma migrations for all services"

setup:
	@bash scripts/setup-local.sh

dev:
	@npm run dev

docker-up:
	@docker compose up -d

docker-down:
	@docker compose down

docker-build:
	@docker compose build

docker-push:
	@docker compose push

migrate:
	@bash scripts/migrate-all.sh

k8s-deploy:
	@kubectl apply -f k8s/namespace.yaml
	@kubectl apply -f k8s/configmap.yaml
	@kubectl apply -f k8s/secrets.yaml
	@kubectl apply -f k8s/postgres.yaml
	@kubectl apply -f k8s/redis.yaml
	@kubectl apply -f k8s/neo4j.yaml
	@kubectl apply -f k8s/nats.yaml
	@kubectl rollout status statefulset/postgres -n $(NAMESPACE) --timeout=120s
	@kubectl rollout status statefulset/redis -n $(NAMESPACE) --timeout=60s
	@kubectl apply -f k8s/services.yaml
	@kubectl apply -f k8s/api-gateway.yaml
	@echo "Deployment complete. Run 'make k8s-status' to check pods."

k8s-delete:
	@kubectl delete namespace $(NAMESPACE) --ignore-not-found=true

k8s-status:
	@kubectl get pods -n $(NAMESPACE)
	@kubectl get services -n $(NAMESPACE)

# AWS EKS specific
eks-deploy:
	@aws eks update-kubeconfig --name idmatr-cluster --region $(AWS_REGION)
	@make k8s-deploy

# GCP GKE specific
gke-deploy:
	@gcloud container clusters get-credentials idmatr-cluster --region $(GCP_REGION)
	@make k8s-deploy

# Azure AKS specific
aks-deploy:
	@az aks get-credentials --resource-group idmatr-rg --name idmatr-cluster
	@make k8s-deploy
