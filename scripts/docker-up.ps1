# Build and run the full stack locally with Docker

# 1) Copy env templates and fill them in
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (-not (Test-Path client/.env)) { Copy-Item client/.env.example client/.env }

# 2) Build images
docker compose build --no-cache

# 3) Start containers
$env:NODE_ENV="production"
docker compose up -d

# 4) Show container status
docker compose ps

# 5) Tail logs
# docker compose logs -f --tail=100

# 6) Stop
# docker compose down
