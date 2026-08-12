terraform {
  cloud {
    organization = "vansh_org"
    workspaces {
      name = "ZeroDrift-K8-Pipeline"
    }
  }
}
