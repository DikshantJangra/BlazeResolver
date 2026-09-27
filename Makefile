.PHONY: help install dev dev-server dev-client dev-web build build-server build-client build-react build-pages build-web test typecheck demo demo-fix clean lint

# Default target
.DEFAULT_GOAL := help

# Colors for terminal output
CYAN  := \033[36m
GREEN := \033[32m
RESET := \033[0m

help: ## Show available make commands
	@echo ""
	@echo "  $(CYAN)BlazeResolver$(RESET) - Development & Build Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-16s$(RESET) %s\n", $$1, $$2}'
	@echo ""

## Installation
install: ## Install dependencies for root and web app
	npm install
	cd web && npm install

## Development
dev: ## Run both backend server and Vite client concurrently
	npm run dev

dev-server: ## Run backend server in watch mode
	npm run dev:server

dev-client: ## Run Vite client in development mode
	npm run dev:client

dev-web: ## Run Next.js docs and marketing site
	cd web && npm run dev

## Build
build: ## Build full library package (server, cjs, react components, CSS, and client)
	npm run build

build-server: ## Build server TS to ESM
	npm run build:server

build-client: ## Build client with Vite
	npm run build:client

build-react: ## Build React components and Tailwind CSS
	npm run build:react && npm run build:css

build-pages: ## Build static docs & marketing site for GitHub Pages (web/out)
	cd web && npm run build:pages

build-web: ## Build Next.js web application
	cd web && npm run build

## Testing & Quality
test: ## Run test suite
	npm run test

typecheck: ## Run TypeScript type checks across all configs
	npm run typecheck

lint: ## Lint web application
	cd web && npm run lint

## Demos & Examples
demo: ## Run interactive triage demo
	npm run demo

demo-fix: ## Run autonomous bug fix demo
	npm run demo:fix

## Cleanup
clean: ## Clean build artifacts and caches
	rm -rf dist web/.next web/out web/node_modules/.cache
