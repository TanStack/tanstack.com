import Airtable from 'airtable'

// TEMPORARY FIX WHILE AIRTABLE API IS INVALID
// const airtable = () => new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
const airtable = () => {}

export async function getSponsorsTable() {
  // const base = airtable().base('apppS8mjo4MMR3pif')
  // return base('sponsors')
  return {}
}

export async function getTiersTable() {
  // const base = airtable().base('apppS8mjo4MMR3pif')
  // return base('tiers')
  return {}
}

export async function getDiscordInvitesTable() {
  // const base = airtable().base('apppS8mjo4MMR3pif')
  // return base('tiers')
  return {}
}
