# Shared VPS deployment

Use `compose.coolify.yml` only on a host already running Coolify's Traefik proxy and `coolify` Docker network. This adds one container and one hostname; it publishes no host ports and does not recreate existing services.

Current installation: `/opt/orbit-lab` on the owner's VPS. Public health check: https://orbit-lab.147.93.180.68.sslip.io/api/health . The hostname uses sslip.io rather than requiring a DNS change; availability depends on that external DNS service.

Before launching, copy `.env.example` to `.env`, choose the hostname and generate a random private token. Keep the file readable only by the owner and never commit it. Create `../.state` with owner UID/GID 10001. From the repository root:

```sh
docker compose -p orbit-lab -f deploy/compose.coolify.yml up -d
```

The Python slim runtime installs binary packages into the persistent `.state/venv` inside the same 256 MiB / 0.25 CPU container. Initial installation is slower under the CPU limit. No swap is added. The API has one process, one shared compute lock and one persistent queue worker. Array-library thread counts are set to one. Completed job retention and Docker log rotation bound normal state growth; there is no disk quota. The image plus source/environment use less than 1 GB initially; review actual disk use as data grows.

For updates, upload only project files, preserve `.state` and `deploy/.env`, then recreate **only this project** with the same command. The website is published separately via GitHub Pages. Never include `.env`, private keys or state databases in a release archive.

Resource inspection:

```sh
docker stats --no-stream orbit-lab-api
docker inspect orbit-lab-api --format '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.NanoCpus}}'
docker exec orbit-lab-api cat /sys/fs/cgroup/memory.peak
```

Expected configured values: `268435456 268435456 250000000`. Equal memory and total memory+swap limits means no additional swap allowance. `memory.peak` measures this container lifetime, not the whole VPS. To stop Orbit Lab alone, use `docker compose -p orbit-lab -f deploy/compose.coolify.yml stop`. Do not use global Docker cleanup or restart the shared proxy.
