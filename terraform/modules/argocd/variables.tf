variable "argocd_chart_version" {
  description = "ArgoCD Helm chart version"
  type        = string
  default     = "6.7.3"
}

variable "project_yaml_path" {
  type = string
}

variable "applicationset_yaml_path" {
  type = string
}

variable "infra_apps_yaml_path" {
  type = string
}

variable "slack_notifications_token" {
  type      = string
  sensitive = true
}

variable "bootstrap_dependencies" {
  type    = list(string)
  default = []
}
