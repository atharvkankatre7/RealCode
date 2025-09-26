# Production deployment with Docker

This project has two services:
- server: Express + Socket.IO + MongoDB client
- client: Next.js frontend

Prerequisites
- Docker and Docker Compose installed
- A MongoDB instance (Atlas or self-hosted). Put the connection string into server/.env (MONGODB_URI)
- An SMTP provider for OTP emails (optional in development): configure in server/.env

Quick start (local Docker)
1) Copy env templates and fill them
   - cp server/.env.example server/.env
   - cp client/.env.example client/.env
2) Build and start
   - Windows (PowerShell): scripts/docker-up.ps1
   - Bash: scripts/docker-up.sh
3) Open
   - Client: http://localhost:3000
   - Server health: http://localhost:5002/health

Security and production settings
- Configure ALLOWED_ORIGINS and CLIENT_URL in server/.env
- Set DEV_MODE=false in server/.env for real email sending
- Set ENABLE_TERMINAL=false (recommended for production)
- Set a strong JWT_SECRET
- Ensure MongoDB network rules allow connections from your deployment

Building and pushing images
- docker build -t <registry>/realcode-server:latest -f server/Dockerfile .
- docker build -t <registry>/realcode-client:latest -f client/Dockerfile .
- docker push <registry>/realcode-server:latest
- docker push <registry>/realcode-client:latest

Example run on a VM
- Create a .env file for the server with production values
- Run:
  docker run -d --name realcode-server \
    -p 5002:5002 \
    --env-file server/.env \
    -e NODE_ENV=production \
    -e ENABLE_TERMINAL=false \
    <registry>/realcode-server:latest

- Then run the client:
  docker run -d --name realcode-client \
    -p 3000:3000 \
    -e NODE_ENV=production \
    -e NEXT_PUBLIC_BACKEND_URL=http://<server_host_or_domain>:5002 \
    <registry>/realcode-client:latest

Kubernetes (optional)
- If you plan to deploy to Kubernetes, I can generate basic manifests or a Helm chart.
