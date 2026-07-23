import * as React from 'react'
import {
  ArrowsSplit,
  BracketsCurly,
  CircleNotch,
  Fingerprint,
} from '@phosphor-icons/react'

import {
  LandingEyebrow,
  LandingSection,
  LandingSectionIntro,
  LandingWindow,
  LibraryLandingShell,
} from './LibraryLanding'

const formPrompt =
  'Build a TanStack Form experience for a TypeScript app. Use typed form and field APIs, synchronous and debounced async validators, deeply nested object and array fields, and granular subscriptions so only relevant UI updates. Keep it headless and render accessible, product-specific controls.'

const validationEvents = [
  {
    event: 'onChange',
    use: 'Shape the value while the user types',
    example: 'Required fields, formatting',
  },
  {
    event: 'onBlur',
    use: 'Wait until the user leaves the field',
    example: 'Longer rules, calmer feedback',
  },
  {
    event: 'onChangeAsync',
    use: 'Debounce work that crosses the network',
    example: 'Username and coupon checks',
  },
  {
    event: 'onSubmit',
    use: 'Guard the final business invariant',
    example: 'Cross-field and server rules',
  },
] as const

const compositionLayers = [
  {
    label: 'Form hook',
    code: 'useAppForm()',
    body: 'Defaults, validators, submit behavior',
  },
  {
    label: 'Field kit',
    code: '<form.AppField>',
    body: 'Your inputs, labels, hints, errors',
  },
  {
    label: 'Product form',
    code: 'withForm()',
    body: 'Typed composition for each workflow',
  },
] as const

export default function FormLanding() {
  return (
    <LibraryLandingShell
      description="Form connects deeply typed values, validation events, async checks, derived submit state, and your own field components—without hiding the form model behind a UI kit."
      headline="A form model for the forms your product is actually built around."
      hero={<FormCockpit />}
      libraryId="form"
      prompt={formPrompt}
      promptLabel="Copy Form prompt"
    >
      <LandingSection tone="accent">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <LandingSectionIntro
            body="Create the field components and defaults your team agrees on, then compose product-specific forms without giving up inference or markup control."
            eyebrow="Composition"
            icon={<BracketsCurly aria-hidden="true" size={17} />}
            title="Build your form system once. Keep every form specific."
          />

          <div className="grid gap-3 md:grid-cols-3">
            {compositionLayers.map((layer, index) => (
              <div
                key={layer.label}
                className="relative rounded-xl border border-border-subtle bg-background-surface p-5"
              >
                <span className="font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
                  0{index + 1} / {layer.label}
                </span>
                <p className="mt-8 break-words font-ds-mono text-ds-mono-sm text-text-primary">
                  {layer.code}
                </p>
                <p className="mt-3 text-ds-body-xs text-text-primary/40">
                  {layer.body}
                </p>
                {index < compositionLayers.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 rotate-45 border-r border-t border-[var(--landing-accent-bright)] bg-background-surface md:block"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </LandingSection>

      <LandingSection tone="raised">
        <LandingSectionIntro
          body="Validation is not one callback. Put each rule at the event where it helps, debounce expensive checks, and expose pending state to the exact surface that needs it."
          eyebrow="Validation orchestration"
          icon={<CircleNotch aria-hidden="true" size={17} />}
          title="Run each rule at the speed of the user."
        />

        <div className="mt-10 overflow-hidden rounded-xl border border-border-subtle">
          <div className="hidden grid-cols-[0.72fr_1.35fr_1fr] bg-background-subtle px-5 py-3 font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30 md:grid">
            <span>Event</span>
            <span>Job</span>
            <span>Good for</span>
          </div>
          {validationEvents.map((item) => (
            <div
              key={item.event}
              className="grid gap-3 border-t border-border-subtle px-5 py-5 first:border-t-0 md:grid-cols-[0.72fr_1.35fr_1fr] md:items-center"
            >
              <code className="w-fit rounded-md bg-[color:rgb(var(--landing-glow)/0.16)] px-2 py-1 font-ds-mono text-ds-mono-xs text-[var(--landing-accent-bright)]">
                {item.event}
              </code>
              <p className="text-ds-body-sm text-text-primary/75">{item.use}</p>
              <p className="text-ds-body-xs text-text-primary/35">
                {item.example}
              </p>
            </div>
          ))}
        </div>
      </LandingSection>

      <LandingSection tone="ink">
        <div className="grid gap-12 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <LandingSectionIntro
              body="A price preview can listen to the plan. A submit button can listen to canSubmit. Field feedback can listen to its own metadata. The rest of the form stays quiet."
              eyebrow="Granular subscriptions"
              icon={<ArrowsSplit aria-hidden="true" size={17} />}
              title="Large forms update in small pieces."
            />
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                ['field', '1 render'],
                ['summary', '0 renders'],
                ['submit', '1 render'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="border-l border-text-primary/10 pl-4"
                >
                  <p className="font-ds-mono text-ds-mono-caps-xs uppercase text-text-primary/30">
                    {label}
                  </p>
                  <p className="mt-2 text-ds-label-md text-text-primary">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <LandingWindow label="subscription graph">
            <div className="p-5 sm:p-7">
              <pre className="overflow-x-auto">
                <code className="font-ds-mono text-ds-mono-xs text-text-primary/65">
                  <span className="text-[var(--landing-accent-bright)]">
                    {'<form.Subscribe>'}
                  </span>
                  {'\n  selector={(state) => state.canSubmit}\n'}
                  {'  {canSubmit => ('}
                  {'\n    <button disabled={!canSubmit}>Save</button>\n'}
                  {'  )}\n'}
                  <span className="text-[var(--landing-accent-bright)]">
                    {'</form.Subscribe>'}
                  </span>
                </code>
              </pre>
              <div className="mt-6 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <StateNode label="form.state.canSubmit" status="changed" />
                <ArrowsSplit
                  aria-hidden="true"
                  className="mx-auto rotate-90 text-[var(--landing-accent-bright)] sm:rotate-0"
                  size={20}
                />
                <StateNode label="SaveButton" status="rendered" />
              </div>
            </div>
          </LandingWindow>
        </div>
      </LandingSection>
    </LibraryLandingShell>
  )
}

function FormCockpit() {
  const [email, setEmail] = React.useState('sarah@tanstack.com')
  const [plan, setPlan] = React.useState<'team' | 'enterprise'>('team')
  const [role, setRole] = React.useState('admin')
  const isEmailValid = /^\S+@\S+\.\S+$/.test(email)
  const isRolePending = role.length > 0 && role.length < 5
  const isRoleValid = role.length >= 5
  const dirtyCount =
    Number(email !== 'sarah@tanstack.com') +
    Number(plan !== 'team') +
    Number(role !== 'admin')
  const canSubmit = isEmailValid && isRoleValid && !isRolePending

  return (
    <LandingWindow label="member onboarding">
      <div className="grid min-h-[23rem] md:grid-cols-[1.18fr_0.82fr]">
        <div className="space-y-4 border-border-subtle p-5 md:border-r">
          <FieldShell
            feedback={
              isEmailValid
                ? 'Email shape is valid.'
                : 'Enter an email with an @ and a domain.'
            }
            feedbackId="form-demo-email-feedback"
            path="profile.email"
            state={isEmailValid ? 'valid' : 'error'}
          >
            <input
              aria-describedby="form-demo-email-feedback"
              aria-invalid={!isEmailValid}
              aria-label="Profile email"
              className="w-full rounded-md border border-border-default bg-background-subtle px-3 py-2 font-ds-mono text-ds-mono-xs text-text-primary outline-none focus:border-[var(--landing-accent-bright)]"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </FieldShell>

          <FieldShell
            path="company.plan"
            state={plan === 'enterprise' ? 'dirty' : 'valid'}
          >
            <div
              aria-label="Company plan"
              className="grid grid-cols-2 gap-2"
              role="group"
            >
              {(['team', 'enterprise'] as const).map((option) => (
                <button
                  key={option}
                  aria-pressed={plan === option}
                  className="rounded-md border border-border-default px-3 py-2 text-ds-label-sm capitalize text-text-primary/45 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent-bright)] aria-pressed:border-[var(--landing-accent)] aria-pressed:bg-[var(--landing-accent)] aria-pressed:text-[var(--landing-accent-ink)]"
                  onClick={() => setPlan(option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </FieldShell>

          <FieldShell
            feedback={
              isRolePending
                ? 'Checking permissions…'
                : isRoleValid
                  ? 'Role is available.'
                  : 'Enter a role to begin the availability check.'
            }
            feedbackId="form-demo-role-feedback"
            path="members[2].role"
            state={isRolePending ? 'pending' : isRoleValid ? 'valid' : 'error'}
          >
            <input
              aria-busy={isRolePending}
              aria-describedby="form-demo-role-feedback"
              aria-invalid={!isRolePending && !isRoleValid}
              aria-label="Member role"
              className="w-full rounded-md border border-border-default bg-background-subtle px-3 py-2 font-ds-mono text-ds-mono-xs text-text-primary outline-none focus:border-[var(--landing-accent-bright)]"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            />
          </FieldShell>
        </div>

        <div className="flex flex-col p-5">
          <LandingEyebrow icon={<Fingerprint aria-hidden="true" size={14} />}>
            live form state
          </LandingEyebrow>
          <dl className="mt-6 space-y-4">
            <Metric label="value type" value="OnboardingForm" />
            <Metric label="dirty" value={`${dirtyCount} fields`} />
            <Metric
              label="validating"
              value={isRolePending ? '1 async' : '0 async'}
            />
            <Metric label="can submit" value={String(canSubmit)} />
          </dl>
          <button
            className="mt-auto rounded-lg bg-[var(--landing-accent)] px-4 py-3 text-ds-label-md text-[var(--landing-accent-ink)] disabled:cursor-not-allowed disabled:opacity-30"
            disabled={!canSubmit}
            type="button"
          >
            Create member
          </button>
        </div>
      </div>
    </LandingWindow>
  )
}

function FieldShell({
  children,
  feedback,
  feedbackId,
  path,
  state,
}: {
  children: React.ReactNode
  feedback?: string
  feedbackId?: string
  path: string
  state: 'dirty' | 'error' | 'pending' | 'valid'
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background-subtle p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <code className="truncate font-ds-mono text-ds-mono-xs text-text-primary/75">
          {path}
        </code>
        <span className="rounded bg-[color:rgb(var(--landing-glow)/0.18)] px-2 py-1 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
          {state}
        </span>
      </div>
      {children}
      {feedback && feedbackId ? (
        <p
          aria-live="polite"
          className={`mt-2 text-ds-body-xs ${state === 'error' ? 'text-text-error' : state === 'pending' ? 'text-[var(--landing-accent-bright)]' : 'text-text-primary/35'}`}
          id={feedbackId}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-3">
      <dt className="text-ds-body-xs text-text-primary/35">{label}</dt>
      <dd className="font-ds-mono text-ds-mono-xs text-text-primary">
        {value}
      </dd>
    </div>
  )
}

function StateNode({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-lg border border-[color:rgb(var(--landing-glow)/0.35)] bg-[color:rgb(var(--landing-glow)/0.09)] p-4 text-center">
      <p className="font-ds-mono text-ds-mono-xs text-text-primary">{label}</p>
      <p className="mt-2 font-ds-mono text-ds-mono-caps-xs uppercase text-[var(--landing-accent-bright)]">
        {status}
      </p>
    </div>
  )
}
