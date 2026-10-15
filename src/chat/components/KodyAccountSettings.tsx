const destinations = [
  ['Profile and account export', '/account'],
  ['Two-factor authentication', '/account/two-factor'],
  ['Passkeys', '/account/passkeys'],
  ['Connected agents', '/account/connections'],
  ['Advanced OAuth clients', '/account/mcp-oauth-clients'],
  ['Billing and credits', '/account/billing'],
  ['Experiments', '/account/experiments'],
] as const

export function KodyAccountSettings() {
  return (
    <section className="home-detail">
      <p>These account controls open Kody's secure website.</p>
      <ul className="home-external">
        {destinations.map(([name, path]) => (
          <li key={path}>
            <a
              href={`https://kody.codes${path}`}
              target="_blank"
              rel="noreferrer"
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
