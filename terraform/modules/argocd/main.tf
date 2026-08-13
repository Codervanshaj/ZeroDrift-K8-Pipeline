resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = var.argocd_chart_version
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  values = [
    <<-EOF
    server:
      extraArgs:
        - --insecure
    EOF
  ]
}

resource "terraform_data" "deps" {
  input = var.bootstrap_dependencies
}

resource "null_resource" "argocd_manifests" {
  depends_on = [
    helm_release.argocd,
    terraform_data.deps
  ]

  provisioner "local-exec" {
    command     = "kubectl wait --for=condition=Established crd/applicationsets.argoproj.io crd/appprojects.argoproj.io crd/applications.argoproj.io --timeout=300s; if ($?) { kubectl apply -f ${var.project_yaml_path} -f ${var.applicationset_yaml_path} -f ${var.infra_apps_yaml_path} }"
    interpreter = ["powershell", "-Command"]
  }
}

resource "kubernetes_secret" "argocd_notifications" {
  metadata {
    name      = "argocd-notifications-secret"
    namespace = kubernetes_namespace.argocd.metadata[0].name
  }
  data = {
    slack-token = var.slack_notifications_token
  }
}
