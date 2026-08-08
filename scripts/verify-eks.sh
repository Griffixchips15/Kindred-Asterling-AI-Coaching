#!/usr/bin/env bash
set -euo pipefail

: "${AWS_REGION:?Set AWS_REGION}"
: "${CLUSTER_NAME:?Set CLUSTER_NAME}"

if ! aws eks describe-cluster --region "$AWS_REGION" --name "$CLUSTER_NAME" >/dev/null 2>&1; then
  cat >&2 <<EOF
EKS cluster '$CLUSTER_NAME' was not found or is not readable in '$AWS_REGION'.
Do not apply Kubernetes resources. Review infrastructure/eks/README.md and run
Terraform only after the owner explicitly approves cluster creation.
EOF
  exit 2
fi

aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME" >/dev/null
server_minor="$(kubectl version -o json | jq -r '.serverVersion.minor' | tr -cd '0-9')"
server_major="$(kubectl version -o json | jq -r '.serverVersion.major' | tr -cd '0-9')"

echo "Connected to $CLUSTER_NAME (Kubernetes ${server_major}.${server_minor})."
case "${server_major}.${server_minor}" in
  1.31|1.32|1.33)
    echo "Use the repository-tested Karpenter 1.8.2 release."
    ;;
  *)
    cat >&2 <<EOF
Kubernetes ${server_major}.${server_minor} is outside this repository's tested 1.31-1.33 matrix.
Stop and consult the Karpenter compatibility matrix. Upgrade EKS to a tested minor,
or pin a Karpenter release that explicitly supports this server version.
EOF
    exit 3
    ;;
esac

kubectl auth can-i get nodes >/dev/null
kubectl get --raw=/readyz >/dev/null
echo "Kubernetes API is ready and credentials can read nodes."
