output "argocd_namespace" {
  description = "Namespace where ArgoCD is installed"
  value       = "argocd"
}

output "next_steps" {
  description = "How to access ArgoCD UI after terraform apply"
  value       = <<-EOT
    ArgoCD is installed along with Argo-Rollouts, Kyverno, and Sealed-Secrets. 
    To access the UI:

    1. Port-forward the ArgoCD server:
       kubectl port-forward svc/argocd-server -n argocd 8080:80

    2. Get the initial admin password:
       kubectl get secret argocd-initial-admin-secret -n argocd \
         -o jsonpath="{.data.password}" | base64 -d

    3. Open: http://localhost:8080  (user: admin)
  EOT
}
