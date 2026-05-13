# Secrets Management Strategy

1. **No Secrets in Source Control:**
   Never commit `.env` files or hardcode passwords/API keys in the codebase. Use `.env.example` as a template.

2. **Local Development:**
   Developers should copy `.env.example` to `.env` and fill in the values for local development.

3. **Kubernetes:**
   Use Kubernetes Secrets for production and staging environments. Refer to `k8s/postgres-secret.yaml` (which should only contain base64 encoded dummy/example values or be generated at deploy time using a tool like External Secrets Operator or HashiCorp Vault).

4. **CI/CD:**
   Use GitHub Actions secrets for pipeline variables (e.g., Docker registry passwords, SonarQube tokens).
