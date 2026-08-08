# KEDA CPU scaling contract

`kindred-api-scaledobject.yaml` targets the `kindred-api` Deployment in the
`kindred` namespace. The Deployment **must** specify a CPU request for every
container (for example, `resources.requests.cpu: 250m`), otherwise Kubernetes
cannot calculate CPU utilization and the scaler will not operate. Metrics
Server must also be healthy.

Do not install a second HPA for this Deployment: KEDA owns the generated HPA.
The three-replica floor should be combined with topology spread constraints
across `topology.kubernetes.io/zone` and a PodDisruptionBudget in the Kindred
application chart.
