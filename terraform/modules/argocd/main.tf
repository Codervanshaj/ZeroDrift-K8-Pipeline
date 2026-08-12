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

resource "time_sleep" "wait_for_argocd_crd" {
  create_duration = "15s"
  depends_on      = [helm_release.argocd]
}

resource "terraform_data" "deps" {
  input = var.bootstrap_dependencies
}

resource "null_resource" "argocd_manifests" {
  depends_on = [
    time_sleep.wait_for_argocd_crd,
    terraform_data.deps
  ]

  provisioner "local-exec" {
    command = "kubectl apply -f ${var.project_yaml_path} -f ${var.applicationset_yaml_path}"
  }
}
