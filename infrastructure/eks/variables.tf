variable "aws_region" {
  description = "AWS region containing at least three availability zones."
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
  default     = "kindred-production"
}

variable "cluster_admin_role_arn" {
  description = "Existing IAM role granted EKS cluster-admin access (never an IAM user)."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:iam::[0-9]{12}:role/.+", var.cluster_admin_role_arn))
    error_message = "cluster_admin_role_arn must be an IAM role ARN."
  }
}

variable "kubernetes_version" {
  description = "EKS Kubernetes minor version. Verify Karpenter support before changing."
  type        = string
  default     = "1.33"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "public_access_cidrs" {
  description = "CIDRs allowed to reach the public API endpoint. Use private access from CI in production."
  type        = list(string)
  default     = []

  validation {
    condition     = alltrue([for cidr in var.public_access_cidrs : cidr != "0.0.0.0/0"])
    error_message = "Do not expose the Kubernetes API to the entire Internet."
  }
}

variable "tags" {
  type = map(string)
  default = {
    Application = "kindred"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
