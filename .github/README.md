# Puppeteer API

![CI](https://img.shields.io/github/actions/workflow/status/anna-engineering/puppeteer-api/ci.yml?branch=main)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

> **Lightweight self‑hosted service that extracts the _final DOM_ (HTML or Markdown) from JavaScript‑heavy pages using **Puppeteer**. Ideal for indexing, SEO prerendering, or server‑side scraping.  
> Images, fonts, and CSS are skipped to lower latency and memory footprint.
> An optional **Readability** mode keeps only the main article for even cleaner output.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
    - [Local Run (Node)](#local-run-node)
    - [Docker Container](#docker-container)
- [API Specification](#api-specification)
- [Configuration](#configuration)
- [Performance & Security Best Practices](#performance--security-best-practices)
- [Production Deployment](#production-deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| ✅ | Capability |
|----|------------|
| ✔ | **Full JavaScript rendering** via headless Chromium driven by Puppeteer |
| ✔ | Returns either raw **HTML** or **Markdown** (`?format=md`) powered by **Turndown** |
| ✔ | Filters images / CSS / media ⇒ shorter response time |
| ✔ | Single shared Chromium instance ⇒ minimal startup overhead |
| ✔ | Optional [Mozilla **Readability**](https://github.com/mozilla/readability) extraction for clutter‑free content |
| ✔ | **Docker‑ready** image (< 300 MB) |
| ✔ | `/health` endpoint for monitoring |
| ✔ | Zero compile‑time deps: Node 20.x + Chromium system libs only |

---

## Quick Start

### Local Run (Node)

```bash
# Prerequisites : Node 20+ and Chromium installed (or let Puppeteer download it)

git clone https://github.com/anna-engineering/puppeteer-api.git
cd puppeteer-api
npm install --omit=dev
npm start
# => listening on http://localhost:3000
```

### Docker Container

```bash
# Build image
docker build -t puppeteer-api .

# Run (port 3000 exposed)
docker run -p 3000:3000 --rm puppeteer-api
```

> **Tip :** For Kubernetes deployment, see the sample Helm chart in `deploy/` (CPU 250 m, memory 512 Mi).

---

## API Specification

### `GET /render`

| Parameter  | Type   | Required | Description |
|------------|--------|----------|-------------|
| `url`      | string | ✔ | Absolute URL (`http`\|`https`) to prerender |
| `format`   | string | ✖ | `md` or `markdown` ⇒ returns Markdown; otherwise HTML (default) |
| `readable` | string | ✖ | `yes`/`true`/`1`/`on` ⇒ run [Readability](https://github.com/mozilla/readability) to strip boilerplate before returning (works for both HTML & Markdown) |

**Responses**

* `200 OK` (`text/html` or `text/markdown`) – rendered content.
* `400 Bad Request` – missing parameter or invalid URL.
* `500 Internal Server Error` – timeout or browser failure.

#### Examples

```bash
# Final HTML
curl "http://localhost:3000/render?url=https://www.wikipedia.org/"

# Markdown
curl "http://localhost:3000/render?url=https://www.wikipedia.org/&format=md"

# Markdown of the main article only
curl "http://localhost:3000/render?url=https://blog.example.com/post42&format=md&readable=yes"
```

### `GET /health`

Returns `{ "status": "ok" }` for liveness/readiness probes.

---

## Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `PORT`               | `3000`  | HTTP port exposed by the API |

Chromium launch flags live in `server.js` → `launch` section; tweak for proxy, sandbox, etc.

---

## Performance & Security Best Practices

* **Single Chrome pool :** one shared instance; open/close ephemeral tabs ⇒ 30‑40 % faster than spawning Chrome per request.
* **Heavy resource blocking :** images, fonts, non‑critical styles ⇒ ~70 % bandwidth saved.
* **Global timeout :** 20 s max to avoid hanging pages.
* **Strict URL validation** to mitigate SSRF.
* **Chromium sandbox** : `--no-sandbox` under Docker root for simplicity.  
  In production, run container as non‑root and remove `--no-sandbox`, or add `--cap-add=SYS_ADMIN`.

---

## Production Deployment

```yaml
# Kubernetes snippet (Deployment + Service)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: puppeteer-api
spec:
  replicas: 2
  selector:
    matchLabels: { app: puppeteer }
  template:
    metadata:
      labels: { app: puppeteer }
    spec:
      containers:
        - name: api
          image: ghcr.io/anna-engineering/puppeteer-api:latest
          resources:
            limits: { cpu: "500m", memory: "768Mi" }
          env:
            - name: PORT
              value: "3000"
          readinessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 5
            periodSeconds: 10
---
kind: Service
apiVersion: v1
metadata:
  name: puppeteer-svc
spec:
  selector: { app: puppeteer }
  ports: [ { port: 80, targetPort: 3000 } ]
```

* **Horizontal scaling** : stateless ⇒ adjust `replicas` as required.
* **Observability** : add Prometheus exporter or sidecar to track per‑page latency.

---

## Roadmap

- [ ] `?waitFor=<selector>` query param to wait for a specific element.
- [ ] Optional Redis cache.
- [ ] Bearer token authentication.
- [ ] Multi‑arch images (`arm64`, `amd64`).

> _Contributions welcome!_ Please open an issue or PR.

---

## Contributing

1. Fork / clone the repo.
2. `npm install`
3. `npm test` (unit tests coming soon).
4. Ensure Prettier + ESLint pass (`npm run lint`).
5. Open a descriptive Pull Request.

---

## License

Distributed under the **MIT** license – see [LICENSE](LICENSE) for details.

