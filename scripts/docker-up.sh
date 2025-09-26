# Build and run the full stack locally with Docker (bash)

# 1) Copy env templates and fill them in
[ ! -f server/.env ] && cp server/.env.example server/.env
[ ! -f client/.env ] && cp client/.env.example client/.env

# 2) Build images
docker compose build --no-cache

# 3) Start containers
NODE_ENV=production docker compose up -d

# 4) Show container status
docker compose ps

# 5) Tail logs
# docker compose logs -f --tail=100

# 6) Stop
# docker compose down
