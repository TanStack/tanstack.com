import React from 'react'
import * as qss from 'qss'
import { FaGithub, FaDiscord, FaPlug, FaCheck } from 'react-icons/fa'

import tw from 'twin.macro'

import useSessionStorage from '../hooks/useSessionStorage'
import axios from 'axios'

const discordClientID = '725855554362146899'
const githubClientID = 'Iv1.3aa8d13a4a3fde91'

const discordOauthStateKey = 'discord_oauth_state'
const githubOauthStateKey = 'github_oauth_state'

const discordOauthCodeKey = 'discord_oauth_token'
const githubOauthCodeKey = 'github_oauth_token'

const discordScope = 'identify guilds.join'

const githubScope = 'user'

const Button = tw.button`
  px-4 py-2
  cursor-pointer
  rounded-lg
  flex items-center gap-2
`

export default function DiscordAuth() {
  const [loadingMessage, setIsLoading] = React.useState('Loading...')
  const [error, setError] = React.useState(null)
  const [message, setMessage] = React.useState(null)
  const [discordState, setDiscordState] = useSessionStorage(
    discordOauthStateKey
  )
  const [githubState, setGithubState] = useSessionStorage(githubOauthStateKey)
  const [discordCode, setDiscordCode] = useSessionStorage(discordOauthCodeKey)
  const [githubCode, setGithubCode] = useSessionStorage(githubOauthCodeKey)

  const loginToDiscord = async () => {
    setError(null)
    const state = generateState()
    setDiscordState(state)
    window.location = `https://discord.com/oauth2/authorize?response_type=code&client_id=${discordClientID}&state=${state}&scope=${discordScope}&redirect_uri=${getRedirectUrl()}`
  }

  const loginToGithub = async () => {
    setError(null)
    const state = generateState()
    setGithubState(state)
    window.location = `https://github.com/login/oauth/authorize?response_type=code&client_id=${githubClientID}&state=${state}&scope=${githubScope}&redirect_uri=${getRedirectUrl()}`
  }

  const linkAccounts = async () => {
    setIsLoading('Linking accounts...')

    try {
      const {
        data: { message, error },
      } = await axios.post('/api/link-discord-github', {
        discordCode,
        discordState,
        githubCode,
        githubState,
        redirectUrl: getRedirectUrl(),
      })

      if (error) {
        setError(error)
      } else {
        setMessage(message)
      }
    } catch (err) {
      setError(err)
    } finally {
      setDiscordCode(null)
      setGithubCode(null)
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    setIsLoading(false)

    const search = window.location.search.substring(1)

    if (search) {
      let { code, state } = qss.decode(search)

      state = state + ''

      if (state === githubState) {
        setGithubCode(code)
      } else if (state === discordState) {
        setDiscordCode(code)
      }

      window.location = getRedirectUrl()
    }
  }, [])

  return (
    <div>
      {error ? (
        <div tw="p-2 text-center bg-red-500 text-white">
          <p>{error}</p>
        </div>
      ) : message ? (
        <div tw="p-2 text-center bg-blue-500 text-white">
          <p>{message}</p>
        </div>
      ) : null}
      <div tw="h-4" />
      <h1 tw="text-center text-2xl">Sponsor Log-in</h1>
      <div tw="h-6" />
      <div>
        {loadingMessage ? (
          <div tw="text-center">{loadingMessage}</div>
        ) : (
          <div tw="flex flex-col gap-2 items-center">
            <div tw="flex items-center justify-center gap-2">
              <Button
                onClick={loginToGithub}
                css={[tw`bg-gray-900 text-white`, githubCode && tw`opacity-50`]}
              >
                {githubCode ? (
                  <>
                    <FaCheck /> Github
                  </>
                ) : (
                  <>
                    <FaGithub />
                    Log In to Github
                  </>
                )}
              </Button>
              <Button
                onClick={loginToDiscord}
                css={[
                  tw`bg-purple-500 text-white`,
                  discordCode && tw`opacity-50`,
                ]}
              >
                {discordCode ? (
                  <>
                    <FaCheck /> Discord
                  </>
                ) : (
                  <>
                    <FaDiscord /> Log In to Discord
                  </>
                )}
              </Button>
            </div>
            {githubCode && discordCode ? (
              <div tw="text-center">
                <Button
                  onClick={() => linkAccounts()}
                  disabled={loadingMessage}
                  css={[tw`bg-blue-500 text-white`]}
                >
                  <FaPlug /> Link Accounts
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div tw="h-6" />
      <div tw="text-center">
        <p>
          Not a sponsor yet?{' '}
          <a
            href="https://github.com/sponsors/tannerlinsley"
            tw="underline text-green-600 font-bold"
          >
            Sign up here!
          </a>
        </p>
      </div>
    </div>
  )
}

function generateState() {
  return `st_${(Math.random() + '').replace('.', '')}`
}

function getRedirectUrl() {
  return window.location.origin + window.location.pathname
}
