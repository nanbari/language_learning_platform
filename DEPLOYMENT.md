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
  -e ANTHROPIC_API_KEY=... `# optionnel, mode PRACTICE_MODE=claude` \
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
  --from-literal=ANTHROPIC_API_KEY='<clé API Anthropic, optionnel>' \
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

## Médias — Cloudflare R2 (vidéos, audios, images)

Les médias lourds ne vont pas dans Supabase (1 GB gratuit) mais dans un
bucket **Cloudflare R2** : 10 GB gratuits et **aucun frais de sortie**, le
streaming vers les élèves ne coûte rien. Les fichiers sont téléversés
directement du navigateur vers R2 via une URL signée (`POST /api/media`,
réservé aux rôles `teacher`/`admin`) — le serveur ne voit jamais le fichier.

### Mise en place (une seule fois)

1. Créer un compte sur https://dash.cloudflare.com (gratuit, une carte est
   demandée pour R2 mais rien n'est facturé sous 10 GB).
2. **R2 → Create bucket** → nom : `monte-et-souris-media`.
3. Dans le bucket → **Settings → Public access → Allow Access** (r2.dev) :
   noter l'URL publique `https://pub-xxxx.r2.dev`.
4. **R2 → Manage API tokens → Create API token** : permission
   *Object Read & Write*, limité au bucket. Noter la clé et le secret.
5. Renseigner les variables d'environnement (Netlify : Site configuration →
   Environment variables ; K8s : voir `k8s/secrets.example.yaml`) :

| Variable | Valeur |
|---|---|
| `R2_ACCOUNT_ID` | id du compte (visible dans l'URL du dashboard) |
| `R2_ACCESS_KEY_ID` | clé du token API |
| `R2_SECRET_ACCESS_KEY` | secret du token API |
| `R2_BUCKET` | `monte-et-souris-media` |
| `R2_PUBLIC_BASE_URL` | `https://pub-xxxx.r2.dev` (sans slash final) |

6. **CORS du bucket** (Settings → CORS policy) — nécessaire pour le PUT
   direct depuis le navigateur :

```json
[
  {
    "AllowedOrigins": ["https://monte-et-souris.netlify.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Utilisation côté client

```ts
// 1. Demander une URL signée
const res = await fetch("/api/media", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
});
const { uploadUrl, publicUrl } = await res.json();

// 2. Téléverser directement vers R2
await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });

// 3. Enregistrer publicUrl dans la leçon (balise <video>/<audio> ensuite)
```

## Anti-pause Supabase

Le plan gratuit Supabase met le projet en pause après 7 jours sans activité
base de données. Le workflow `.github/workflows/keepalive.yml` appelle
`https://monte-et-souris.netlify.app/api/health?deep=1` tous les 3 jours ;
cette variante exécute une requête SQL réelle, ce qui compte comme de
l'activité. En cas d'échec (base en pause, site down), le workflow échoue et
GitHub envoie un e-mail de notification.

> GitHub désactive les crons après 60 jours sans commit sur le dépôt : si le
> projet reste dormant, réactiver le workflow depuis l'onglet **Actions**.

## Révision des exercices ratés

La page « Révision » de l’espace élève (`/student/practice/<leçon>`) propose à
l’élève les exercices qu’il n’a pas réussis du premier coup (ou qu’il a
abandonnés). L’analyse se fait côté serveur à partir de `exercise_events`
(voir `src/lib/weakSpots.ts`) ; chaque série est enregistrée dans
`practice_sets` (schéma dans `supabase-schema.sql`, à appliquer dans
l’éditeur SQL Supabase).

La plateforme propose ces révisions d’elle-même : `GET /api/practice/summary`
liste les leçons où l’élève a des exercices à revoir, et le tableau de bord
ainsi que l’écran de fin de leçon n’affichent le bouton « Réviser » que dans
ce cas.

Deux modes, choisis par la variable `PRACTICE_MODE` :

| Valeur | Comportement |
|---|---|
| `replay` (défaut) | Les exercices ratés d’origine sont rejoués tels quels (réponses des quiz mélangées). Aucun service externe, aucun coût. Une réussite du premier coup en révision efface le point faible. |
| `claude` | Claude génère des variantes de chaque exercice raté (`src/lib/practiceGenerator.ts`). Nécessite `ANTHROPIC_API_KEY` (console.anthropic.com) ; `ANTHROPIC_MODEL` optionnel, défaut `claude-opus-5`. Sans clé, la route répond 503 et le reste du site fonctionne normalement. |

Garde-fous du mode `claude` : au plus 4 exercices ratés traités par série,
2 variantes chacun, une génération par minute et par élève et par leçon. Les
jetons consommés sont enregistrés dans `practice_sets` (`input_tokens`,
`output_tokens`).

## Inscription des élèves

Un visiteur demande un compte élève sur `/inscription` (nom, e-mail, mot de
passe). Rien n’est créé à ce moment : la demande est stockée dans
`signup_requests` avec le mot de passe haché (bcrypt), et un administrateur
l’approuve ou la refuse depuis son tableau de bord `/teacher`. Les droits
admin sont la colonne `is_admin` de la table `users`, cumulable avec le rôle
enseignant. Un admin nomme ou révoque d’autres admins depuis la section
« Enseignants » de son tableau de bord (`/api/admin/staff`) ; seul le tout
premier admin se définit dans le Table Editor Supabase en passant `is_admin`
à `true` (l’ancien rôle `admin` reste accepté et vaut enseignant + admin).
À l’approbation, le compte Supabase Auth et le profil `users` sont créés avec
ce hachage ; le hachage est ensuite effacé de la demande.

Le schéma de `signup_requests` est dans `supabase-schema.sql` (à appliquer dans
l’éditeur SQL Supabase). Aucune variable d’environnement supplémentaire.
Aucun e-mail n’est envoyé : l’admin doit consulter son tableau de bord.
