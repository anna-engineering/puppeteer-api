# puppeteer-api
Web Render Service via API REST

# Lancer en local
```bash
docker build -t prerender-api .
docker run -p 3000:3000 --rm prerender-api
# Test
curl "http://localhost:3000/render?url=https://example.com"
```

# Bonnes pratiques DevOps & sécurité

- *Browser pooling :* garder une unique instance Chromium (déjà mis en place) et ouvrir/fermer seulement des pages ; on évite ainsi le coût de démarrage répété du navigateur.
- *Sandbox :* le conteneur lance Chrome avec --no-sandbox (plus simple sous Docker). Pour production stricte, préférer un utilisateur non-root + capabilities (--cap-add=SYS_ADMIN) au lieu de désactiver la sandbox.
- *Timeouts & validation des entrées :* paramètre timeout fixé, contrôle du schéma d’URL pour éviter SSRF.
- *Scalabilité :* plusieurs conteneurs peuvent être répliqués horizontalement derrière un load-balancer si un fort débit est nécessaire.
