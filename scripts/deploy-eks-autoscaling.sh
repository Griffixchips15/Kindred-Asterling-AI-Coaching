#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck source=/dev/null
source "$repo_root/deploy/versions.env"
set +a

: "${AWS_REGION:?Set AWS_REGION}"
: "${CLUSTER_NAME:?Set CLUSTER_NAME}"
: "${KARPENTER_NODE_ROLE_NAME:?Set from Terraform output karpenter_node_role_name}"
: "${KARPENTER_INTERRUPTION_QUEUE:?Set from Terraform output karpenter_interruption_queue_name}"
: "${EBS_KMS_KEY_ARN:?Set from Terraform output kms_key_arn}"
: "${BOTTLEROCKET_AMI_ALIAS:?Pin a tested Bottlerocket alias}"

for command in aws kubectl helm jq envsubst; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done

"$repo_root/scripts/verify-eks.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
envsubst < "$repo_root/deploy/karpenter/values.yaml" > "$tmp/karpenter-values.yaml"
envsubst < "$repo_root/deploy/karpenter/ec2nodeclass.yaml" > "$tmp/ec2nodeclass.yaml"

helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter \
  --version "$KARPENTER_VERSION" --namespace kube-system --create-namespace \
  --values "$tmp/karpenter-values.yaml" --wait --timeout 10m

helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ --force-update
helm upgrade --install metrics-server metrics-server/metrics-server \
  --version "$METRICS_SERVER_VERSION" --namespace kube-system \
  --values "$repo_root/deploy/metrics-server-values.yaml" --wait --timeout 10m

helm repo add kedacore https://kedacore.github.io/charts --force-update
helm upgrade --install keda kedacore/keda --version "$KEDA_VERSION" \
  --namespace keda --create-namespace --values "$repo_root/deploy/keda/values.yaml" \
  --wait --timeout 10m

kubectl apply -f "$tmp/ec2nodeclass.yaml"
kubectl apply -f "$repo_root/deploy/karpenter/nodepool-spot.yaml"
kubectl apply -f "$repo_root/deploy/karpenter/nodepool-ondemand.yaml"

kubectl wait --for=condition=Established crd/nodepools.karpenter.sh --timeout=60s
kubectl get ec2nodeclass kindred-general
kubectl get nodepool general-spot general-ondemand-fallback
kubectl get pods -n kube-system -l app.kubernetes.io/name=karpenter
kubectl get pods -n keda

cat <<'EOF'
Controllers and node provisioning are ready. Apply the KEDA ScaledObject only
after the kindred namespace and CPU-requested kindred-api Deployment exist:
  kubectl apply -f deploy/keda/kindred-api-scaledobject.yaml
EOF
