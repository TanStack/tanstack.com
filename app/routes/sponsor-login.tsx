import React from 'react'
import * as qss from 'qss'
import { FaGithub, FaDiscord, FaPlug, FaCheck } from 'react-icons/fa'

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

const getbuttonStyles = () => `
  px-4 py-2
  cursor-pointer
  rounded-lg
  flex items-center gap-2
`

export default function SponsorsLogin() {
  const [loadingMessage, setIsLoading] = React.useState<string | boolean>(
    'Loading...'
  )
  const [error, setError] = React.useState(null)
  const [message, setMessage] = React.useState(null)
  const [discordState, setDiscordState] =
    useSessionStorage(discordOauthStateKey)
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
        <div className={`p-2 text-center bg-red-500 text-white`}>
          <p>{error}</p>
        </div>
      ) : message ? (
        <div className={`p-2 text-center bg-blue-500 text-white`}>
          <p>{message}</p>
        </div>
      ) : null}
      <div className={`h-4`} />
      <div className={`p-2`}>
        <h1 className={`text-center text-2xl`}>Sponsor Log-in</h1>
        <div className={`h-6`} />
        <div>
          {loadingMessage ? (
            <div className={`text-center`}>{loadingMessage}</div>
          ) : (
            <div className={`flex flex-col gap-2 flex-wrap items-center`}>
              <div className={`flex items-center justify-center gap-2`}>
                <button
                  className={[
                    getbuttonStyles(),
                    `bg-gray-900 text-white`,
                    githubCode && `opacity-50`,
                  ].join(' ')}
                  onClick={loginToGithub}
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
                </button>
                <button
                  className={[
                    getbuttonStyles(),
                    `bg-purple-500 text-white`,
                    discordCode && `opacity-50`,
                  ].join(' ')}
                  onClick={loginToDiscord}
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
                </button>
              </div>
              {githubCode && discordCode ? (
                <div className={`text-center`}>
                  <button
                    className={[
                      getbuttonStyles(),
                      `bg-blue-500 text-white`,
                    ].join(' ')}
                    onClick={() => linkAccounts()}
                    disabled={loadingMessage}
                  >
                    <FaPlug /> Link Accounts
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className={`h-6`} />
        <div className={`text-center`}>
          <p>
            Not a sponsor yet?{' '}
            <a
              href="https://github.com/sponsors/tannerlinsley"
              className={`underline text-green-600 font-bold`}
            >
              Sign up here!
            </a>
          </p>
        </div>
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
