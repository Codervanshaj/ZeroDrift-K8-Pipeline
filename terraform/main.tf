resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
  }
}

resource "kubernetes_secret" "grafana_admin" {
  metadata {
    name      = "grafana-admin-secret"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
  data = {
    admin-user     = "admin"
    admin-password = var.grafana_admin_password
  }
}

module "argo_rollouts" {
  source = "./modules/argo-rollouts"
}

module "kyverno" {
  source = "./modules/kyverno"
}

module "argocd" {
  source                    = "./modules/argocd"
  argocd_chart_version      = var.argocd_chart_version
  project_yaml_path         = "${path.module}/../argocd/project.yaml"
  applicationset_yaml_path  = "${path.module}/../argocd/applicationset.yaml"
  infra_apps_yaml_path      = "${path.module}/../argocd/infra-apps.yaml"
  slack_notifications_token = var.slack_notifications_token
  
  # Ensure all other components are fully bootstrapped before ArgoCD creates 
  # the AppProject and ApplicationSet, which triggers the GitOps synchronization.
  bootstrap_dependencies    = [
    module.argo_rollouts.release_id,
    module.kyverno.release_id
  ]
}
