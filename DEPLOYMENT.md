# Déploiement — Docker, Kubernetes (AWS EKS) et CI/CD

## Vue d'ensemble

- **Docker** : build multi-étapes (`Dockerfile`) produisant une image minimale
  basée sur la sortie `standalone` de Next.js, exécutée en utilisateur non-root.
- **Kubernetes** : manifests dans `k8s/` (Deployment, Service, Ingress ALB,
  namespace `monte-et-souris`), assemblés par Kustomize.
- **CI** (`.github/workflows/ci.yml`) : lint, vérification des types, tests
  unitaires Vitest et build de production sur chaque push et pull request.
- **CD** (`.github/workflows/deploy.yml`) : sur push vers `main`, exécute les
  tests, construit l'image, la pousse sur Amazon ECR puis déploie sur EKS.

## Test local de l'image Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t monte-et-souris .

docker run --rm -p 3000:3000 \
  -e AUTH_SECRET=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  monte-et-souris
# → http://localhost:3000
```

## Mise en place AWS (une seule fois)

Prérequis : AWS CLI configurée, `eksctl`, `kubectl`, `helm`.

### 1. Dépôt d'images ECR

```bash
aws ecr create-repository --repository-name monte-et-souris --region eu-west-3
```

### 2. Cluster EKS

```bash
eksctl create cluster \
  --name monte-et-souris \
  --region eu-west-3 \
  --nodegroup-name workers \
  --node-type t3.small \
  --nodes 2 --nodes-min 1 --nodes-max 3 \
  --with-oidc
```

> ⚠️ Coût : le plan de contrôle EKS est facturé (~0,10 $/h) plus les nœuds EC2.
> Supprimer le cluster quand il ne sert plus : `eksctl delete cluster --name monte-et-souris --region eu-west-3`.

### 3. AWS Load Balancer Controller (pour l'Ingress ALB)

```bash
eksctl create iamserviceaccount \
  --cluster monte-et-souris --region eu-west-3 \
  --namespace kube-system --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=monte-et-souris \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

(La policy IAM du controller s'installe selon la doc officielle du projet.)

### 4. Secrets applicatifs dans le cluster

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n monte-et-souris create secret generic app-secrets \
  --from-literal=AUTH_SECRET='<aléatoire 32+ caractères>' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='<clé service-role>' \
  --from-literal=NEXT_PUBLIC_SUPABASE_URL='https://xxxx.supabase.co' \
  --from-literal=NEXT_PUBLIC_SUPABASE_ANON_KEY='<clé anon>'
```

### 5. Rôle IAM pour GitHub Actions (OIDC, sans clé stockée)

Créer un fournisseur d'identité OIDC GitHub dans IAM
(`token.actions.githubusercontent.com`), puis un rôle avec une politique de
confiance limitée au dépôt `nanbari/language_learning_platform` (branche
`main`), et les droits : push ECR (`AmazonEC2ContainerRegistryPowerUser`) et
`eks:DescribeCluster`. Ajouter enfin le rôle au cluster :

```bash
eksctl create iamidentitymapping \
  --cluster monte-et-souris --region eu-west-3 \
  --arn arn:aws:iam::<ACCOUNT_ID>:role/<ROLE_GITHUB> \
  --group system:masters --username github-actions
```

### 6. Configuration du dépôt GitHub

**Settings → Secrets and variables → Actions**

| Type | Nom | Valeur |
|---|---|---|
| Variable | `DEPLOY_ENABLED` | `true` (active la pipeline CD) |
| Variable | `AWS_REGION` | `eu-west-3` |
| Variable | `ECR_REPOSITORY` | `monte-et-souris` |
| Variable | `EKS_CLUSTER` | `monte-et-souris` |
| Secret | `AWS_ROLE_ARN` | ARN du rôle IAM OIDC |
| Secret | `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| Secret | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon Supabase |

## Cycle de release

1. Push (ou merge d'une PR) sur `main`.
2. **CI** valide lint, types, tests, build.
3. **Deploy** : tests → image taguée avec le SHA du commit → push ECR →
   `kubectl apply -k k8s/` → attente du rollout (`rollout status`).
4. Rollback : `kubectl -n monte-et-souris rollout undo deployment/web`,
   ou re-déployer un ancien SHA depuis l'onglet Actions (workflow_dispatch).

Tant que `DEPLOY_ENABLED` n'est pas définie à `true`, seul le workflow CI
s'exécute — le dépôt reste utilisable sans infrastructure AWS.
