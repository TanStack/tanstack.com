#!/usr/bin/env tsx
/**
 * Test script to verify database connection and basic queries
 * Run with: npx tsx scripts/test-db-connection.ts
 */

import { db } from '../src/db/client'
import { users, roles, feedEntries } from '../src/db/schema'
import { sql } from 'drizzle-orm'

async function testConnection() {
  console.log('Testing database connection...\n')

  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...')
    const result = await db.execute(sql`SELECT 1 as test`)
    console.log('✓ Connection successful\n')

    // Test 2: Check tables exist
    console.log('2. Checking tables exist...')
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    console.log(`✓ Found ${tables.length} tables:`)
    tables.forEach((row: any) => {
      console.log(`  - ${row.table_name}`)
    })
    console.log()

    // Test 3: Count records
    console.log('3. Counting records...')
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users)
    const roleCount = await db.select({ count: sql<number>`count(*)` }).from(roles)
    const feedCount = await db.select({ count: sql<number>`count(*)` }).from(feedEntries)

    console.log(`✓ Users: ${userCount[0]?.count ?? 0}`)
    console.log(`✓ Roles: ${roleCount[0]?.count ?? 0}`)
    console.log(`✓ Feed Entries: ${feedCount[0]?.count ?? 0}`)
    console.log()

    // Test 4: Test a simple query
    console.log('4. Testing simple query...')
    const firstUser = await db.select().from(users).limit(1)
    console.log(`✓ Query successful (found ${firstUser.length} user(s))`)
    console.log()

    console.log('✅ All database tests passed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Database test failed:', error)
    process.exit(1)
  }
}

testConnection()

