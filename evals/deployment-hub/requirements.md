Draw how our URL shortener is deployed.

The link service runs in a container on a virtual machine. It has no public port and only takes traffic from the gateway. Managed services sit to its left: a redirect cache, config and secrets, and access logs. Data services sit to its right: click analytics and the links database. An artifact bucket sits above, which sends builds in and takes nightly backups out. The on-call engineer sits below and connects through a bastion login.
