import path from 'path'
import Discord from 'discord.js'

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({
    path: path.resolve(process.cwd(), '../', '.env'),
  })
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

async function init() {
  const client = await getClient()

  client.on('message', (message) => {})

  //Welcome & goodbye messages\\
  client.on('guildMemberAdd', (member) => {
    console.info(member)

    member.roles.add(
      member.guild.roles.cache.find((i) => i.name === 'Among The Server')
    )
  })
}
