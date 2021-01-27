import { middleware } from '../../server/middleware'
import { linkGithubAndDiscordUser } from '../../server/discord-github'
import { exchangeDiscordCodeForToken } from '../../server/discord'
import { exchangeGithubCodeForToken } from '../../server/github'

export default async function handler(req, res) {
  await middleware(req, res)

  const { discordCode, githubCode, githubState, redirectUrl } = req.body

  try {
    let [githubToken, discordToken] = await Promise.all([
      exchangeGithubCodeForToken({
        code: githubCode,
        state: githubState,
        redirectUrl,
      }),
      exchangeDiscordCodeForToken({
        code: discordCode,
        redirectUrl,
      }),
    ])

    const message = await linkGithubAndDiscordUser({
      githubToken,
      discordToken,
    })

    return res.json({ message })
  } catch (err) {
    return res.json({ error: err.message })
  }
}
