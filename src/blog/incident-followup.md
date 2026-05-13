---
title: 'Hardening TanStack After the npm Compromise'
published: 2026-05-12
draft: false
excerpt: "A companion to our incident postmortem: what we're changing across the org so the May 11 supply-chain attack can't happen the same way again."
authors:
  - Sarah Gerrard
  - Corbin Crutchley
  - Jack Herrington
  - Tanner Linsley
  - Florian Pellet
  - Harry Whorlow
---

This week, fourteen of our packages were republished to npm with malware baked into the published artifacts. The releases were triggered by our normal release pipeline after changes landed on main, but the malicious code was not authored, reviewed, or approved by us. By the time the first report reached our issue tracker, those compromised versions had already been available on the registry for about 20 minutes.

We've already published [the full incident postmortem](/blog/npm-supply-chain-compromise-postmortem), and if you want the timeline, the attack chain, the exact package list, the IOCs, and the "what to do if you installed a bad version" guidance, that's the source of truth. Read that first.

This post is the companion piece. The postmortem covered what happened. This one is about what we're changing because of it.

## The shortest possible recap

Just enough context so this post makes sense on its own:

Someone opened a pull request from a throwaway fork. While we never got a chance to see the PR since it was immediately closed, it had still triggered a workflow that checked out the contributor's code and ran it in a job that had write access to our shared CI cache.

The attacker's code poisoned the cache and later, when an entirely legitimate merge to main, from a different PR, ran our release workflow, it restored that poisoned cache, extracted our short-lived publish token out of the runner's memory, and used it to push malicious versions across our router-family packages.

Just to be clear, no maintainer was phished, had a password leak, or a token stolen from their account. Since this attack rode in through a trusted cache, it didn't need to. The attacker managed to engineer a path where our own CI pipeline stole its own publish token for them, at the exact moment it was created, by way of a cache that everyone in the chain implicitly trusted. It is a sophisticated approach that we hadn't anticipated and that we're taking very seriously.

## How our releases normally work

In order to understand how this attack worked against us, it's important to understand how the release process for TanStack packages typically works. Every release that ships to npm under a `@tanstack/*` name goes through a staged process:

1. Through a reviewed pull request, a change lands on `main` that includes a version bump and a changelog update. That PR is reviewed and merged by a maintainer, just like any other PR.
2. Releases are cut from `main` by a CI workflow (when it works), not by a person running `npm publish` from a laptop.
3. The workflow authenticates to npm through GitHub's OIDC trusted-publisher integration, which means there is no long-lived npm publish token sitting waiting to be stolen.
4. The publish credential is minted at release time, scoped to that workflow, and expires almost immediately.

The distinction that there was no publish token to be stolen is important. A large class of npm supply-chain attacks work by stealing a maintainer's publish token, often from their local machine or a compromised dev environment, that are then used to publish malicious versions directly.

Our setup was designed specifically to make that path a non-starter. With no long-lived npm publish token sitting on a maintainer machine, an attacker couldn't simply compromise a laptop, steal credentials from a local environment, and publish malicious packages at will. That matters especially in the context of the current wave of malware and infostealer campaigns targeting developer machines and browser-stored secrets.

OIDC-based publishing also gave us tighter control over who could release packages and under what conditions. Releases were tied to specific GitHub workflows running from specific repositories and branches, rather than to a reusable credential that could be copied, shared, or quietly reused elsewhere.

With publishes tied back to workflow runs instead of a token, we also had a much easier time understanding the scope of the attack once we had the first report. It showed us exactly what workflow run triggered the publish, which branch it ran from, and when it ran. That audit trail was a significant advantage during incident response and helped us scope the what had happened much more quickly.

## The honest part

The way we had our workflow structured was inevitably how this was attack was made possible. The attack vector was a workflow that ran on [`pull_request_target`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target), which is a special event that runs in the context of the base repository instead of the fork. That means the fork, which was renamed to avoid being detected as a fork of the repo, had write access to the cache that our release workflow later read from. While this has been [documented as a known-bad pattern by GitHub's own security team](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/) for over three years, we still had it in our workflow and it was the root cause of this attack.

Knowing we had added in production is something we have to sit with now. While there are many things we had in place that worked as intended, not being on top of the fact that this pattern was in our workflow is a failure on our part. We had the information we needed to know that this was a potential problem, but we didn't connect the dots to our own setup.

While we can say that the npm provenance, SLSA, OIDC, and 2FA all worked as advertised and still didn't stop this attack, that's not the whole story. The workflow shape itself was the hole, and that's what we're rebuilding now.

Modern supply-chain defences are important, but they're not always enough on their own. We have to be more proactive about identifying and closing any holes in our workflows that could be exploited, rather than relying solely on the security features of the tools we use.

Knowing that we had a known-bad pattern in our workflow, and it wasn't on our radar, means there was a breakdown in our internal processes and that's where we have to do better. We have to be more proactive about identifying and closing any holes in our workflows that could be exploited, rather than relying solely on the security features of the tools we use.

## What we've already done

These are the changes that have landed since the incident. They're not the whole plan — they're the things we could do quickly.

- **Disabled the pnpm cache in our release pipeline.** We are still evaluating exactly what role the cache played here, whether it can be safely reintroduced (or if we even want it), and what additional hardening would be required if it is.
- **Removed all caches from GitHub Actions** across the affected workflows. Same reasoning.
- **Pinned every action in the org to a commit SHA.** No more `actions/checkout@v6.0.2`. A retargeted tag has the same blast radius as cache poisoning, and we'd just lived through cache poisoning, so we'd rather not open that wound again.
- **Enforced non-SMS 2FA across npm and GitHub.** 2FA was already required, but SMS was still allowed as a factor. It isn't anymore.
- **Removed every use of `pull_request_target` from our CI.** It was never in our CD pipeline but it shouldn't have been in CI either. If we need base-repo permissions to react to a PR, we'll do it through `workflow_run` against artefacts from a sandboxed `pull_request` job — the GitHub-recommended pattern for this exact scenario.
- **Upgraded every repo to pnpm 11**, so we inherit the ecosystem install-cooldown behaviour. It's not a fix on its own. It buys us a window.

Most of those are blast-radius reductions rather than root-cause fixes; they shrink what a similar attack could reach, but the workflow shape itself is what we're rebuilding in the next round.

## What we're working on next

Some of the changes we're making take more than a hotfix to land properly, and a few of them are still open questions we're working through together. We're including the unresolved ones because how we're thinking about them feels as relevant as what we've already shipped.

- **Adding [`zizmor`](https://github.com/woodruffw/zizmor) as a required PR check on every repo.** It's a static analyser for GitHub Actions workflows, and there's a chance if we had it running against the workflow this incident exploited, it could have flagged the `pull_request_target` + fork-checkout pattern before any of this happened.
- **Putting `CODEOWNERS` on `.github` folders**, restricting workflow changes to core maintainers. We're leaning toward "yes" on this one; workflow files are code that runs with our credentials, and that means they should be treated like the most privileged code in the repo, because that's effectively what they are.
- **Replacing the pnpm setup cache with `actions/cache/restore`**, which has more conservative defaults: explicit restore, no implicit write-on-exit. The auto-save behaviour of `actions/cache@v5` is what allowed the cache write to happen regardless of our `permissions:` block, and we want that path closed by design instead of by accident.

And then the more difficult thing...

### The PR question

This is the change we're least sure about.

We've been talking about closing the ability for external contributors to open pull requests against TanStack repos. Not closing source (to be very clear, we are absolutely not going closed source) but shifting from "PRs welcome from anyone" to something closer to "issues and discussions welcome from anyone, PRs from non-maintainers by invitation." Contributors who want to land code might do it by filing a detailed issue or patch suggestion, or by doing the kind of investigative and review work that earns a path into a committer role over time.

We have complicated feelings about this, because open PRs are part of how a lot of us became maintainers in the first place. The path from "user with a fix" to "trusted committer" tends to run straight through opening a PR and having someone review it, and closing that path narrows what it means to participate in the project in ways that aren't only about us. There's also a version of this where it doesn't actually solve the underlying problem; the attack vector wasn't "a malicious PR got merged," it was "a malicious PR ran in CI," and you can keep PRs open and still close the CI side of that hole, which is what most of the changes earlier in this post are doing.

So with that in mind... we haven't decided. The discussion is ongoing, and we're flagging it here because we'd rather you hear about it from us, with the context attached, than read about it sideways somewhere later. If we do go that route, it'll come with its own post about how the new contribution model actually works in practice since telling people to "send a patch via an issue" without the infrastructure to make that a real path is just a polite way of telling them to go away.

## What we're taking from this

It's tempting, after something like this, to end on a paragraph about how the ecosystem needs to change (and it does). Cache scoping in GitHub Actions shouldn't silently bridge fork PRs and base-repo branches. Provenance shouldn't be confused with innocence. The gap between "this is a known-bad pattern" and "this pattern is hard to write by accident" is a gap the platform itself should be closing, not one every project should have to notice on its own. All of that is true, and we'll be advocating for it where we can.

But it's not what we're sitting with right now. What we're sitting with is that the workflow shape that got exploited had been quietly working for a long time, and the parts of our security posture we actively thought about — OIDC, lockfiles, 2FA, signed commits — were the parts we'd already invested in. CI was the part we hadn't, and that's the part we're rebuilding now.

To everyone who reported, verified, and helped triage — thank you. The fact that an independent researcher caught the dead-man's switch in the payload and warned responders before anyone started revoking tokens is the single reason this incident isn't significantly worse (even though it _is_ bad). That kind of work doesn't tend to make the headline, but it makes the difference, and we noticed.

We'll do better.
