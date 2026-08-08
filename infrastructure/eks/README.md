# Kindred EKS autoscaling platform

This directory provisions the AWS infrastructure for Kindred's Karpenter/KEDA
platform. It is suitable for Kindred, but it is a separate deployment target
from the existing Coolify setup; migrate only after load, recovery, privacy and
cost testing in a non-production AWS account.

## Design

- Three private subnets in separate availability zones give EC2 Fleet a broad
  set of Spot pools. One NAT gateway per AZ avoids a single-zone dependency.
- Three small Bottlerocket on-demand nodes host cluster-critical controllers.
  They are tainted, spread across the selected subnets, and remain stable while
  application nodes churn. No SSH key, remote-access configuration, SSM policy,
  or admin container access is configured.
- Karpenter's high-weight pool requests only Spot `m` (general-purpose)
  instances across several generations and sizes. Its low-weight pool is the
  on-demand fallback. Karpenter's Spot unavailability cache causes unavailable
  offerings to be skipped; pool weight makes Spot preferred. This is a
  preference, not an AWS guarantee: capacity can disappear at any time.
- Karpenter consolidation and bounded disruption replace underutilized nodes.
  KEDA controls pod replicas; pods that no longer fit cause Karpenter to add
  nodes. KEDA does not directly scale nodes.
- EKS secrets and every declared root EBS volume use the customer-managed KMS
  key. IMDSv2 is mandatory with a one-hop limit.

## 1. Verify before creating anything

Configure the Kubernetes MCP server in `.cursor/mcp.json`, authenticate AWS,
generate kubeconfig, restart the MCP client, and ask it to perform read-only
operations equivalent to:

1. list namespaces;
2. read `/version` and `/readyz`;
3. list nodes and inspect their OS image.

The current execution environment had no Kubernetes MCP resources registered,
so it could not determine whether your real cluster exists and **did not deploy
anything**. Do not infer absence from that result. An operator can run the same
guard locally:

```bash
export AWS_REGION=us-east-1 CLUSTER_NAME=kindred-production
./scripts/verify-eks.sh
```

Exit 2 means the named cluster is absent or the caller lacks `eks:DescribeCluster`;
distinguish those cases with an authorized AWS identity before creation. Exit 3
means the Kubernetes minor is outside the tested compatibility gate. The
repository pins Karpenter in `deploy/versions.env`; check the upstream
compatibility matrix and EKS support calendar before updating either version.
Do not bypass the gate—upgrade EKS to a tested minor or select a Karpenter
release explicitly supporting the current minor.

## 2. Create the cluster (only after owner approval)

```bash
cd infrastructure/eks
cp terraform.tfvars.example terraform.tfvars
# Edit CIDRs, region, tags, cluster minor, and name.
terraform init
terraform fmt -check
terraform validate
terraform plan -out=tfplan
terraform show tfplan
terraform apply tfplan
aws eks update-kubeconfig --region us-east-1 --name kindred-production
```

Keep Terraform state in an encrypted, locked remote backend in the actual
environment. Backend coordinates are deliberately not hard-coded because the
state bucket and lock table must already exist and must be owned by your AWS
account. Run Terraform from inside the VPC when `public_access_cidrs = []`.

## 3. Deploy through the Kubernetes API

Export Terraform outputs, replace `bottlerocket@latest` with a tested, pinned
Bottlerocket alias, then deploy:

```bash
export AWS_REGION=us-east-1 CLUSTER_NAME=kindred-production
export KARPENTER_NODE_ROLE_NAME="$(terraform -chdir=infrastructure/eks output -raw karpenter_node_role_name)"
export KARPENTER_INTERRUPTION_QUEUE="$(terraform -chdir=infrastructure/eks output -raw karpenter_interruption_queue_name)"
export EBS_KMS_KEY_ARN="$(terraform -chdir=infrastructure/eks output -raw kms_key_arn)"
export BOTTLEROCKET_AMI_ALIAS='bottlerocket@latest' # pin before production
./scripts/deploy-eks-autoscaling.sh
```

The script is a reproducible CLI fallback for MCP. With MCP, use the same order:
install the pinned Helm releases, server-side apply the rendered EC2NodeClass,
apply Spot then fallback NodePools, read their status conditions, and only then
apply the ScaledObject. Never send Terraform state or AWS credentials through
MCP. Scope its kubeconfig to these namespaces and resources rather than using
the cluster creator's administrator identity.

Before applying the ScaledObject, ensure `kindred/kindred-api` exists, has CPU
requests, readiness/startup probes, a PodDisruptionBudget, and zone topology
spread constraints. Confirm with `kubectl top pods -n kindred`, then load-test
scale-up, scale-down, Spot interruption, AZ loss, and on-demand fallback.

## Operational checks

```bash
kubectl get nodepools,ec2nodeclasses
kubectl describe nodepool general-spot
kubectl get nodes -L karpenter.sh/capacity-type,node.kubernetes.io/instance-type,topology.kubernetes.io/zone
kubectl get hpa -n kindred
kubectl top pods -n kindred
kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter --tail=200
```

Set AWS Budgets and Cost Anomaly Detection outside this module. Monitor pending
pods, node provisioning duration, Spot interruption events, Karpenter errors,
KEDA scaler errors, and fallback on-demand spend. Use GitOps for production
promotion and retain a tested rollback version for charts and manifests.
