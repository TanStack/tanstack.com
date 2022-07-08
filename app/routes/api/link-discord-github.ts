import { linkGithubAndDiscordUser } from '../../server/discord-github'
import { exchangeDiscordCodeForToken } from '../../server/discord'
import { exchangeGithubCodeForToken } from '../../server/github'
import { ActionFunction } from '@remix-run/react'

export const action: ActionFunction = async (ctx) => {
  const { discordCode, githubCode, githubState, redirectUrl } =
    await ctx.request.json()

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

    return { message }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
}
