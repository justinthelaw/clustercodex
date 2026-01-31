# Cluster Codex

Your personal platform engineer, without the Jira ticket.

Cluster Codex is a developer-friendly, LLM-enhanced Kubernetes tool that helps users:

1. Visualize and document Kubernetes cluster and resource deployment issues
2. Generate recommendations to immediately remediate those issues
3. Strategize long-term fixes to prevent the same issues from recurring

## Technology Stack

Cluster Codex uses the following core technologies:

| Technology                                                                              | Purpose                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [React](https://react.dev)                                                              | User interface                                     |
| [Supabase](https://supabase.com)                                                        | Database, Auth                                     |
| [Prisma](https://www.prisma.io/)                                                        | Migrations, Seeding, ORM                           |
| [K8sGPT](https://github.com/k8sgpt-ai/k8sgpt)                                           | MCP server, cluster and issues context provider    |
| [Kubernetes Fluent Client](https://github.com/defenseunicorns/kubernetes-fluent-client) | Typescript-native Kubernetes resource manipulation |
| [OpenAI Codex](https://openai.com/codex)                                                | Issue decomposition, recommended fixes             |

The tests and demonstrations use the following technologies:

| Technology                                                                              | Purpose                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [K3d](https://k3d.io/stable)                                                            | K3s in Docker, a lightweight Kubernetes cluster    |
| [Playwright](https://playwright.dev)                                                    | Testing framework and orchestrator                 |

## How It Works

### Runtime Environment

Cluster Codex is assumed to be running with access to the MCP servers and skills defined in `.codex/` directory of this project repository, as well as a `kubeconfig` that provides access to the target Kubernetes clusters.

Cluster Codex is assumed to be deployed outside of the cluster it operates on, with authentication and authorization layers protecting resources and namespaces the user is not permitted to access.

### Administration

Cluster Codex is centrally managed through an admin portal that is only accessible to administrative accounts. From the admin portal, administrators can decide which namespaces and resources a user’s Cluster Codex instance has access to.

### General Usage

The initial landing page displays all Kubernetes issues in a table, including K8sGPT-provided issue context, a play button to generate an immediate Codex-driven remediation plan, and a play button to generate a Codex-driven root cause analysis for long-term resolution.

The user can see the resources that they have access to in tabs, with each resource type having its own tab and a table within that tab showing the resource details, similar to what one might see in the [K9s CLI tool](https://k9scli.io/).

#### Generate Remediation Plan

Clicking this button opens up a dialog box that allows the user to add additional context to that provided by K8sGPT. This is all sent to Codex alongside a prompt that asks it for an immediate remediation plan to the cluster issue so that things get working as soon as possible. This short-term plan could include patching Kubernetes resources on-the-spot, restarting deployments, writing policy exceptions, and any other applicable actions. All actions should not cause side-effects nor downstream effects inside of the Kubernetes cluster. If nothing can be done in the short-term, then recommendations will likely involve going towards the long-term resolution step, or possibly performing a rollback or deletion of the resources causing the issue.

#### Long-term Resolution

Clicking this button opens a dialog box that allows the user to add additional context to that provided by K8sGPT. This is all sent to Codex alongside a prompt that asks it for a long-term plan to prevent the issue from happening again. This long-term plan could include application refactors, helm chart modifications, upstream contributions, and any other applicable actions.

## How It's Made

### Agentic Coding

Planning began using this `README.md` as the baseline list of technologies and capabilities.

A follow-on `AGENTS.md` was written, and constantly evolved, to guide development and planning of Cluster Codex.

A `.codex/` directory contains different MCP servers and skills that are used for _both_ the development of Cluster Codex and for Cluster Codex itself.

### Testing

Basic testing uses the Playwright framework to write journey tests that interact with both the Cluster Codex UI and the Kubernetes cluster. All major "happy paths" are tested using this method.

Helm charts with known issues are applied to the Kubernetes cluster to see if Cluster Codex is able to render them for the right users.

Mock answers from a mock Codex server are provided in the landing page when the play buttons are clicked to generate remediation plans.

### Language

TypeScript is the only programming language used throughout this repository.

For testing purposes, shell scripting and Helm charts are used to simulate an existing Kubernetes cluster with existing resources.

## What's Next

We just started, so I am leaving this blank for now! Here is a work-in-progress list of out-of-scope ideas:

1. An optional step to kick off a Codex agent to help the user execute on the immediate resolution plan. The actions taken and results of those actions are then added to the context for the long-term resolution recommendation generation.
