# OrbStack Local Deployment Runbook

Project path used in this setup:
- `/Users/moweijia/Documents/md-2.1.0`

## One-command local deploy
```bash
cd /Users/moweijia/Documents/md-2.1.0
./scripts/orbstack-local.sh
```

Default result:
- Image: `md-local:word-import`
- Container: `md-local`
- URL: `http://localhost:18080/`

## Validate after startup
1. Open `http://localhost:18080/`.
2. Do a hard refresh.
3. Confirm local cache cleanup is active:
   - the local image should provide a dedicated `/sw.js`
   - `index.html` and `/` should be served with `no-store` behavior for local verification
4. Import a Word file with:
   - short-title patterns (`01 xx`, `一、xx`, `标题1:xx`)
   - at least one image + caption (`图源: xxx`)
5. Confirm top noise text is absent and images are visible.
6. Copy content into WeChat and check again after a short wait:
   - typography should not drift later
   - paragraph line-height and spacing should remain stable

## Useful commands
```bash
# View running container
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

# Logs
docker logs --tail 200 md-local

# Stop
docker stop md-local

# Remove
docker rm -f md-local

# Rebuild and restart
cd /Users/moweijia/Documents/md-2.1.0
./scripts/orbstack-local.sh
```

## Build stability notes
- Keep `Dockerfile.orbstack` aligned with current dependency strategy.
- If mirror registry causes install/build failure, switch nested `.npmrc` mirror entries to `registry.npmjs.org` during build stage.
- If build hooks are the blocker, keep install with `--ignore-scripts` where applicable.
- For local-only verification builds, proactively neutralize stale Service Worker/cache interference on `localhost:18080`; otherwise the browser may continue serving an older frontend package even after rebuild.
