module "sealed_secrets" {
  source = "./modules/sealed-secrets"
}

module "argo_rollouts" {
  source = "./modules/argo-rollouts"
}

module "kyverno" {
  source = "./modules/kyverno"
}

module "argocd" {
  source                   = "./modules/argocd"
  argocd_chart_version     = var.argocd_chart_version
  project_yaml_path        = "${path.module}/../argocd/project.yaml"
  applicationset_yaml_path = "${path.module}/../argocd/applicationset.yaml"
  
  # Ensure all other components are fully bootstrapped before ArgoCD creates 
  # the AppProject and ApplicationSet, which triggers the GitOps synchronization.
  bootstrap_dependencies   = [
    module.sealed_secrets.release_id,
    module.argo_rollouts.release_id,
    module.kyverno.release_id
  ]
}
