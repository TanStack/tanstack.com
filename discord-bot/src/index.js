import path from 'path'
import Discord from 'discord.js'

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.resolve(process.cwd(), '../', '.env'),
  })
}

const guildId = '719702312431386674'

const channelIds = {
  welcome: '725435640673468500',
  fan: '803508045627654155',
  supporter: '803508117752119307',
  premierSponsor: '803508359378370600',
}

const roles = {
  fan: '🤘Fan',
  supporter: '🎗Supporter',
  permierSponsor: '🏅Premier Sponsor',
}

let clientPromise

init()

function getClient() {
  if (!clientPromise) {
    clientPromise = new Promise((resolve) => {
      const client = new Discord.Client()

      client.on('ready', async () => {
        console.info('Logged in to Discord.')
        resolve(client)
      })

      client.login(process.env.DISCORD_TOKEN)
    })
  }

  return clientPromise
}

async function getGuild() {
  const client = await getClient()
  return await client.guilds.fetch(guildId)
}

async function init() {
  const client = await getClient()

  // const guild = await getGuild()

  // console.info(guild)

  client.on('message', (message) => {
    // console.info(message)
    // let tierRole = message.guild.roles.cache.find(
    //   (role) => role.name === roles[tier.sponsorType]
    // )
  })

  //Welcome & goodbye messages\\
  client.on('guildMemberAdd', (member) => {
    console.info(member)

    member.roles.add(
      member.guild.roles.cache.find((i) => i.name === 'Among The Server'),
    )
  })
}
