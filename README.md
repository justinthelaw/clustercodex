# Cluster Codex

Your personal platform engineer, without the Jira ticket.

Cluster Codex is a developer-friendly, LLM-enhanced Kubernetes tool that helps users:

1. **See** Kubernetes cluster issues detected by K8sGPT
2. **Understand** what's wrong via AI-generated remediation plans
3. **Act** with step-by-step kubectl commands to fix issues

> **MVP Scope**: This is a 4-hour proof-of-concept demonstrating the core workflow: authenticate → view detected issues → generate fix recommendations.

## Technology Stack

### Core (MVP)

| Technology                                                                     | Purpose                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------ |
| [React](https://react.dev) + [Vite](https://vitejs.dev)                        | Frontend UI                                |
| [Express](https://expressjs.com)                                               | Backend API                                |
| [Supabase](https://supabase.com)                                               | Auth (local Docker)                        |
| [K8sGPT Operator](https://docs.k8sgpt.ai/getting-started/in-cluster-operator/) | In-cluster issue detection via Result CRDs |
| [K3d](https://k3d.io/stable)                                                   | Local Kubernetes cluster                   |
| [OpenAI SDK](https://github.com/openai/openai-node)                            | LLM client (mock mode for demo)            |

### Future (Post-MVP)

| Technology                                                           | Purpose                              |
| -------------------------------------------------------------------- | ------------------------------------ |
| [Prisma](https://www.prisma.io/)                                     | Database ORM + migrations            |
| [Kubernetes Client](https://github.com/kubernetes-client/javascript) | Direct K8s API access                |
| [llama.cpp](https://github.com/ggerganov/llama.cpp)                  | Local LLM (zero API cost)            |
| [Playwright](https://playwright.dev)                                 | E2E testing                          |

## How It Works

### Runtime Environment

Cluster Codex is assumed to be deployed outside of the Kubernetes cluster it operates on, with authentication and authorization layers protecting resources and namespaces the user is not permitted to access.

### Administration

Cluster Codex is centrally managed through an admin portal that is only accessible to administrative accounts. From the admin portal, administrators can decide which namespaces and resources a user’s Cluster Codex instance has access to.

### General Usage

The initial landing page displays all Kubernetes issues in a table, including K8sGPT-provided issue context, a play button to generate an immediate Codex-driven remediation plan, and a play button to generate a Codex-driven root cause analysis for long-term resolution.

The user can see the resources that they have access to in tabs, with each resource type having its own tab and a table within that tab showing the resource details, similar to what one might see in the [K9s CLI tool](https://k9scli.io/).

#### Generate Remediation Plan

Clicking this button opens up a dialog box that allows the user to add additional context to that provided by K8sGPT. This is all sent to Codex alongside a prompt that asks it for an immediate remediation plan to the cluster issue so that things get working as soon as possible. This short-term plan could include patching Kubernetes resources on-the-spot, restarting deployments, writing policy exceptions, and any other applicable actions. All actions should not cause side-effects nor downstream effects inside of the Kubernetes cluster. If nothing can be done in the short-term, then recommendations will likely involve going towards the long-term resolution step, or possibly performing a rollback or deletion of the resources causing the issue.

#### Long-term Resolution

Clicking this button opens a dialog box that allows the user to add additional context to that provided by K8sGPT. This is all sent to Codex alongside a prompt that asks it for a long-term plan to prevent the issue from happening again. This long-term plan could include steps to replicate the problem again, upstream source code and Helm chart refactors, and any other applicable actions.

## How It's Made

### Agentic Coding

Planning began using this `README.md` as the baseline list of technologies and capabilities.

PLanning continued using an `IMPLEMENTATION.md` to walk-through the actual components, detailed technology stack usage, and the phased approach to the initial MVP of CLuster Codex.

A follow-on `AGENTS.md` was written to guide development and planning of Cluster Codex.

A `.codex/` directory contains behavior control, MCP servers and skills that are used for the development of Cluster Codex using OpenAI Codex.

### Testing

Basic testing uses the Playwright framework to write journey tests that interact with both the Cluster Codex UI and the Kubernetes cluster. All major "happy paths" are tested using this method.

Helm charts with known issues are applied to the Kubernetes cluster to see if Cluster Codex is able to render them for the right users.

Mock answers from a mock Codex server are provided in the landing page when the play buttons are clicked to generate remediation plans.

### Languages

TypeScript is the only programming language used throughout this repository.

For testing and developer workflow purposes, bash scripting and Helm charts are used.

## Future Considerations

- Agentic execution of short-term remediation plans (i.e., implementation via direct cluster interaction)
- Agentic execution of long-term resolution plans (i.e., upstream ticket writing, upstream ticket implementation)
- More granular RBAC on read/write actions against the Kubernetes cluster
- Formalize the deployed Cluster Codex to cluster authentication, authorization, and networking model to enable safe, least-privilege cluster administration
