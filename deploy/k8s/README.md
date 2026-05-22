# OpenContest Kubernetes deploy

This folder contains a first Kubernetes layer for local or staging clusters.

## Images

Build and load/push these images before applying manifests:

```bash
docker build -t opencontest-backend:latest ../../backend
docker build -t opencontest-frontend:latest ../../frontend
docker build -t opencontest-runner:latest ../../runners/go-runner
```

For Minikube, either build inside Minikube's Docker environment or run:

```bash
minikube image load opencontest-backend:latest
minikube image load opencontest-frontend:latest
minikube image load opencontest-runner:latest
```

## Apply

```bash
kubectl apply -k deploy/k8s
```

Or apply individual files in numeric order.

KEDA autoscaling is optional and requires KEDA to be installed in the cluster:

```bash
kubectl apply -f deploy/k8s/40-keda-runner-scaledobject.yaml
```

## Local access

Without ingress:

```bash
kubectl -n opencontest port-forward svc/frontend 5173:80
kubectl -n opencontest port-forward svc/backend 8000:8000
kubectl -n opencontest port-forward svc/rabbitmq 15672:15672
```

Then open:

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/api/health/
- RabbitMQ management: http://localhost:15672

## Notes

- Replace secrets before production.
- Runner pods are privileged because `nsjail` needs namespace/cgroup operations. Production clusters should restrict this to a dedicated node pool.
- Postgres here is a simple single-node StatefulSet. Use a managed database or operator for production.
