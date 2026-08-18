# NiboNobu’s Art Archive

A public artwork archive with a password-protected admin studio. The production
website runs as a standard Node.js container on a Linux VM. Artwork images stay
in Cloudflare R2 and artwork records stay in Cloudflare D1.

## Production architecture

```text
Browser -> Caddy (HTTPS) -> Next.js container
                              |-> R2 through its S3-compatible API
                              `-> authenticated D1 gateway Worker -> D1
```

The gateway exposes only the artwork operations used by this application. It
does not expose an arbitrary SQL endpoint.

## Local UI development

Requirements: Node.js 22 or later.

```bash
npm ci
npm run dev
```

Next.js reads local values from `.env.local`. Copy the variable names from
`.env.vm.example`; never commit the populated file.

## 1. Prepare production Cloudflare resources

Create a production D1 database and a Standard-class R2 bucket. Do not reuse
the test resources for the public site.

Update `gateway/wrangler.jsonc` with the production D1 database name and ID.

Create a long gateway secret:

```bash
openssl rand -base64 48
```

Store it in the gateway without putting it in source control:

```bash
npx wrangler secret put GATEWAY_SECRET --config gateway/wrangler.jsonc
```

Deploy only the small gateway Worker:

```bash
npm run gateway:deploy
```

Copy its `https://...workers.dev` URL for `D1_GATEWAY_URL`.

For R2, create an Object Read & Write S3 token restricted to the production
bucket. Record its Access Key ID, Secret Access Key, account endpoint, and
bucket name. These are server secrets and must never be exposed to browser code.

## 2. Configure the VM

Use a Linux VM with Docker Engine and the Docker Compose plugin. Point the
chosen DNS name at the VM and allow inbound TCP 80/443 and UDP 443.

Copy `.env.vm.example` to `.env.vm` and replace every placeholder:

```bash
cp .env.vm.example .env.vm
chmod 600 .env.vm
```

`SESSION_SECRET` should contain at least 32 random bytes. It can be generated
with the same `openssl rand -base64 48` command. The value of
`D1_GATEWAY_SECRET` must exactly match the secret stored on the gateway Worker.

## Managed Kubernetes deployment

The initial KaaS resources are created manually through the provider portal.
The bootstrap manifest, namespace identifier, kubeconfig, and populated Secret
values stay local and are excluded from Git. No persistent volume is required
because all durable data lives in D1 and R2.

Build for the cluster's common Linux AMD64 architecture and push directly to
its registry:

```bash
docker buildx build --platform linux/amd64 \
  -t praseth002/nibonobu-art-archive:v1 \
  --push .
```

If the registry is private, create its image-pull credential through the KaaS
platform and add the resulting Secret name under `spec.template.spec.imagePullSecrets`.
The Ingress allows 26 MB requests to stay aligned with the application's 25 MB
upload limit and uses `/api/health` for startup, readiness, and liveness checks.

## GitHub CI/CD

The workflow in `.github/workflows/pipeline.yml` validates every pull request
to `main`. A push to `main` runs the same validation, publishes a Linux AMD64
image to Docker Hub, and updates the existing Kubernetes Deployment. Kubernetes
receives the immutable image digest rather than a reusable tag, then the
workflow waits up to five minutes for the health-checked rollout to complete.

The workflow only changes the image of an existing Deployment. It does not
apply a manifest or modify the application's Kubernetes Secrets.

Before enabling deployment, create a GitHub Environment named `production`
and add these environment secrets:

- `DOCKERHUB_USERNAME`: the Docker Hub account that owns the image repository
- `DOCKERHUB_TOKEN`: a Docker Hub access token with permission to push images
- `KUBE_CONFIG_B64`: a base64-encoded kubeconfig for a dedicated, namespace-
  restricted Kubernetes identity

Also add `KUBE_NAMESPACE` as an environment secret. The namespace value stays
in GitHub's secret store and is not recorded in this repository. The Kubernetes
identity needs permission to get and patch the
`nibonobu-art-archive` Deployment and to read its rollout status. It should not
have permission to read or change `nibonobu-secrets`.

The workflow can also be started manually from GitHub's Actions page. For the
first production run, use this manual trigger and watch the rollout before
relying on automatic deployments from `main`.

To inspect or undo the most recent deployment from an authorized machine:

```bash
kubectl -n <namespace> \
  rollout status deployment/nibonobu-art-archive

kubectl -n <namespace> \
  rollout undo deployment/nibonobu-art-archive
```

## 3. Start or update the site

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app caddy
```

Caddy obtains and renews HTTPS certificates automatically after DNS reaches the
VM. The application container runs as a non-root user and includes a health
check at `/api/health`.

To update the site, replace the source with the new validated version and run
the same `docker compose up -d --build` command. R2 and D1 data are external and
are not removed when containers are replaced.

## Backups and recovery

- Enable D1 Time Travel and periodically export the production database.
- Configure an R2 lifecycle/backup policy appropriate for the artwork archive.
- Keep `.env.vm` in the company secret manager or encrypted backup.
- Back up Caddy's named volumes if certificate continuity matters; certificates
  can otherwise be issued again.

## Useful commands

- `npm run build`: validate the VM-targeted Next.js production build
- `npm run lint`: lint source files
- `npm run gateway:dev`: run the gateway locally with Wrangler
- `npm run gateway:deploy`: deploy only the D1 gateway Worker
