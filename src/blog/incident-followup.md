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
---

This week, fourteen of our packages were quietly republished to npm with malware baked in. None of us authored those releases. None of us approved them. By the time the first report landed in our issue tracker, the malicious versions had already been sitting on the registry for a while.

We've already published [the full incident postmortem](/blog/npm-supply-chain-compromise-postmortem), but if you want the timeline, the attack chain, the exact package list, the IOCs, and the "what to do if you installed a bad version" guidance, that's the source of truth. Read that first.

This post is the companion piece. The postmortem covered what happened. This one is about what we're changing because of it.

## The shortest possible recap

Just enough context so this post makes sense on its own:

Someone opened a pull request from a throwaway fork. The PR looked unremarkable, but it triggered a workflow that checked out the contributor's code and ran it in a job that had write access to our shared CI cache. The contributor's code poisoned the cache. Later, an entirely legitimate merge to main ran our release workflow, which restored the poisoned cache, extracted our short-lived publish token out of the runner's memory, and used it to push 84 malicious versions across our router-family packages.

No maintainer was phished. No password leaked. Our OIDC binding, lockfiles, signed commits, and 2FA were all configured correctly. The compromise rode in through the one path none of those covered: what the CI runner trusts in its own filesystem. That's the part we're rebuilding.

## How our releases normally work

We want to spend a minute on this, because it matters for understanding the shape of the attack; and because most people who use TanStack don't see this part of the project.

Every release that ships to npm under a `@tanstack/*` name goes through a staged process. Changes have to land on `main` via a reviewed pull request. Releases are cut from `main` by a CI workflow, not by a person running `npm publish` on a laptop. That workflow authenticates to npm through GitHub's OIDC trusted-publisher integration, which means there's no long-lived npm token sitting in any maintainer's account or in any secret store waiting to be stolen; the publish credential is minted at release time and expires almost immediately. Commits on `main` are signed. 2FA is required on every maintainer account on both GitHub and npm. Lockfiles are committed. Provenance metadata is attached to every published artefact.

That's the safeguard stack. It's the same kind of stack that, on a normal day, makes "steal a maintainer's npm token and publish malware" a non-starter, and most npm supply-chain attacks you've read about in the last two years are some variation of that exact scenario, which is why those defences exist and why we'd invested in them.

This incident happened because the attacker didn't try to defeat any of those safeguards directly. They didn't steal a token, bypass 2FA, forge a signature or sneak code past review. They engineered a path where our pipeline would steal its own token, for them, at the exact moment it was minted, by way of a cache that everyone in the chain implicitly trusted. That's a sophisticated piece of work, and pretending otherwise wouldn't be honest either.

## The honest part

The workflow pattern that made this possible — [`pull_request_target`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target) plus a checkout of fork code plus a cache write — has been [documented as a known-bad pattern by GitHub's own security team](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/) for over three years. We had it in production. We knew about the pattern in the abstract, and never connected it to our own workflows. That's a thing we have to sit with.

There's a version of this post where we lean on the fact that npm provenance, SLSA, OIDC, and 2FA all worked exactly as advertised and still didn't stop this. That's true, and it matters.

However, modern supply-chain defences are not enough on their own, and anyone telling you otherwise is selling something. But it's also a deflection. The hole was in our workflow design. We're the ones who left it open. So that's where the changes are going.

## What we've already done

These are the changes that have landed since the incident. They're not the whole plan — they're the things we could do quickly.

- **Removed the cache from our pnpm setup**, temporarily. Caching is coming back, but not in the form that got us into this.
- **Removed all caches from GitHub Actions** across the affected workflows. Same reasoning. If cache is the attack surface, we'd rather rebuild from scratch than restore from something we can't trust.
- **Pinned every action in the org to a commit SHA.** No more `actions/checkout@v6.0.2`. No more `pnpm/action-setup@v4.4.0`. A retargeted tag has the same blast radius as cache poisoning, and we'd just lived through cache poisoning, so the lesson was loud.
- **Enforced non-SMS 2FA across npm and GitHub.** 2FA was already required, but SMS was still allowed as a factor. It isn't anymore.
- **Removed every use of `pull_request_target` from our CI.** It was never in our CD pipeline. It shouldn't have been in CI either. If we need base-repo permissions to react to a PR, we'll do it through `workflow_run` against artefacts from a sandboxed `pull_request` job — the GitHub-recommended pattern for this exact scenario.
- **Upgraded every repo to pnpm 11**, so we inherit the ecosystem install-cooldown behaviour. It's not a fix on its own. It buys us a window.

Most of those are blast-radius reductions rather than root-cause fixes; they shrink what a similar attack could reach, but the workflow shape itself is what we're rebuilding in the next round.

## What we're working on next

Some of the changes we're making take more than a hotfix to land properly, and a few of them are still open questions we're working through together. We're including the unresolved ones because how we're thinking about them feels as relevant as what we've already shipped.

- **Adding [`zizmor`](https://github.com/woodruffw/zizmor) as a required PR check on every repo.** It's a static analyser for GitHub Actions workflows, and if we'd had it running against the workflow this incident exploited, it almost certainly would have flagged the `pull_request_target` + fork-checkout pattern before any of this happened.
- **Putting `CODEOWNERS` on `.github` folders**, restricting workflow changes to core maintainers. We're leaning toward "yes" on this one; workflow files are code that runs with our credentials, and that means they should be treated like the most privileged code in the repo, because that's effectively what they are.
- - **Replacing the pnpm setup cache with `actions/cache/restore`**, which has more conservative defaults: explicit restore, no implicit write-on-exit. The auto-save behaviour of `actions/cache@v5` is what allowed the cache write to happen regardless of our `permissions:` block, and we want that path closed by design instead of by accident.
- **Isolating the cache between release and PR environments.** Even with the safer restore action in place, we don't want a PR-context job to ever write into a cache namespace that a release-context job will read. Different keys, different scopes, different worlds.

And then the more difficult thing...

### The PR question

This is the change we're least sure about.

We've been talking about closing the ability for external contributors to open pull requests against TanStack repos. Not closing source (to be very clear, we are absolutely not going closed source) but shifting from "PRs welcome from anyone" to something closer to "issues and discussions welcome from anyone, PRs from non-maintainers by invitation." Contributors who want to land code would do it by filing a detailed issue or patch suggestion, or by doing the kind of investigative and review work that earns a path into a committer role over time.

We have complicated feelings about this, because open PRs are part of how a lot of us became maintainers in the first place. The path from "user with a fix" to "trusted committer" tends to run straight through opening a PR and having someone review it, and closing that path narrows what it means to participate in the project in ways that aren't only about us. There's also a version of this where it doesn't actually solve the underlying problem; the attack vector wasn't "a malicious PR got merged," it was "a malicious PR ran in CI," and you can keep PRs open and still close the CI side of that hole, which is what most of the changes earlier in this post are doing.

So we haven't decided. The discussion is ongoing, and we're flagging it here because we'd rather you hear that we're thinking about it from us, with the context attached, than read about it sideways somewhere later. If we do go that route, it'll come with its own post about how the new contribution model actually works in practice — because telling people to "send a patch via an issue" without the infrastructure to make that a real path is just a polite way of telling them to go away.

## What we're taking from this

It's tempting, after something like this, to end on a paragraph about how the ecosystem needs to change (and it does). Cache scoping in GitHub Actions shouldn't silently bridge fork PRs and base-repo branches. Provenance shouldn't be confused with innocence. The gap between "this is a known-bad pattern" and "this pattern is hard to write by accident" is a gap the platform itself should be closing, not one every project should have to notice on its own. All of that is true, and we'll be advocating for it where we can.

But it's not what we're sitting with right now. What we're sitting with is that the workflow shape that got exploited had been quietly working for a long time, and the parts of our security posture we actively thought about — OIDC, lockfiles, 2FA, signed commits — were the parts we'd already invested in. CI was the part we hadn't, and that's the part we're rebuilding now.

To everyone who reported, verified, and helped triage — thank you. The fact that an independent researcher caught the dead-man's switch in the payload and warned responders before anyone started revoking tokens is the single reason this incident isn't significantly worse (even though it _is_ bad). That kind of work doesn't tend to make the headline, but it makes the difference, and we noticed.

We'll do better.
