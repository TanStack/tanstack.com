import axios from 'axios'
import * as qss from 'qss'

const discordClientId = '725855554362146899'
const discordClientSecret = process.env.DISCORD_APP_CLIENT_SECRET
const guildId = '719702312431386674'
const discordBaseURL = 'https://discord.com/api/'

// const channelsBySponsorType = {
//   welcome: '725435640673468500',
//   fan: '803508045627654155',
//   supporter: '803508117752119307',
//   premierSponsor: '803508359378370600',
// }

const rolesBySponsorType = {
  fan: 'Fan',
  supporter: 'Supporter',
  premierSponsor: 'Premier Sponsor',
}

const TanBotToken = process.env.DISCORD_TOKEN

// const clientsByToken = {}

// async function getClient(discordToken) {
//   if (!discordToken) {
//     throw new Error('No discord token found')
//   }
//   if (!clientsByToken[discordToken]) {
//     const client = new Discord.Client()

//     clientsByToken[discordToken] = new Promise((resolve, reject) => {
//       client.on('ready', async () => {
//         console.info('Discord Connected.')
//         resolve(client)
//       })
//       client.login(discordToken).catch(reject)
//     })
//   }

//   return clientsByToken[discordToken]
// }

// export async function getInviteLink({ tier }) {
//   await getClient()

//   const invite = await channel.createInvite({
//     maxUses: 1,
//   })

//   return `https://discord.gg/${invite.code}`
// }

export async function linkSponsorToken({ discordToken, sponsorType }) {
  if (sponsorType === 'sleep-aid') {
    throw new Error(
      '😔 You must be at least a "Fan" sponsor to access exclusive discord channels.',
    )
  }

  if (!rolesBySponsorType[sponsorType]) {
    throw new Error('Invalid sponsor type! Contact support, please!')
  }

  const botClient = axios.create({
    baseURL: discordBaseURL,
    headers: {
      authorization: `Bot ${TanBotToken}`,
    },
  })

  const userClient = axios.create({
    baseURL: discordBaseURL,
    headers: {
      authorization: `Bearer ${discordToken}`,
    },
  })

  let roles, userData
  try {
    const { data } = await botClient.get(`/guilds/${guildId}/roles`)
    roles = data
  } catch (err) {
    console.error(err)
    throw new Error('Unable to fetch Discord roles. Please contact support!')
  }

  try {
    const { data } = await userClient.get('/users/@me')
    userData = data
  } catch (err) {
    console.error(err)
    throw new Error(
      'Unable to fetch Discord user info. Please contact support!',
    )
  }

  let tierRole = roles.find((role) =>
    role.name.includes(rolesBySponsorType[sponsorType]),
  )

  if (!tierRole) {
    throw new Error(
      'Could not find Discord role for sponsor tier! Please contact support.',
    )
  }

  let addData

  try {
    const { data } = await botClient.put(
      `/guilds/${guildId}/members/${userData.id}`,
      {
        roles: [tierRole.id],
        access_token: discordToken,
      },
    )

    addData = data
  } catch (err) {
    throw new Error(
      'Unable to add user to TanStack Discord. Please contact support.',
    )
  }

  if (!addData) {
    try {
      await botClient.patch(`/guilds/${guildId}/members/${userData.id}`, {
        roles: [tierRole.id],
        access_token: discordToken,
      })
    } catch (err) {
      throw new Error(
        'Could not update Discord role for user! Please contact support.',
      )
    }
  }

  return `You have been successfully added to the TanStack discord, along with the exclusive access to the sponsors-only "${tierRole.name}" channel!`
}

export async function exchangeDiscordCodeForToken({ code, redirectUrl }) {
  try {
    const body = qss.encode({
      client_id: discordClientId,
      client_secret: discordClientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUrl,
      scope: 'identify guilds.join',
    })

    const { data } = await axios.post(
      'https://discord.com/api/oauth2/token',
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    return data.access_token
  } catch (err) {
    console.error(err)
    throw new Error('Unable to authenticate with Discord. Please log in again.')
  }
}
