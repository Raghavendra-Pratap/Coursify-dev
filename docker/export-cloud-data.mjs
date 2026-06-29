/**
 * Export public schema data from Supabase Cloud using the service role key.
 * Usage: ./docker/pull-cloud-data.sh  (VPS / Hostinger terminal)
 *        ./docker/export-from-cloud.sh (laptop with .env.local)
 * Output: database/seed/cloud-data.json (gitignored)
 */
import { createNodeSupabaseClient } from './supabase-node-client.mjs'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function parseEnvFile(path) {
  const raw = readFileSync(path, 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[t.slice(0, i).trim()] = val
  }
  return env
}

function loadEnv() {
  if (process.env.CLOUD_SUPABASE_URL && process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY) {
    return {
      url: process.env.CLOUD_SUPABASE_URL,
      key: process.env.CLOUD_SUPABASE_SERVICE_ROLE_KEY,
    }
  }

  const cloudPath = join(root, '.env.cloud')
  if (existsSync(cloudPath)) {
    const e = parseEnvFile(cloudPath)
    const url = e.CLOUD_SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL
    const key = e.CLOUD_SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) return { url, key }
  }

  const localPath = join(root, '.env.local')
  if (existsSync(localPath)) {
    const e = parseEnvFile(localPath)
    const url = e.NEXT_PUBLIC_SUPABASE_URL
    const key = e.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) return { url, key }
  }

  return { url: '', key: '' }
}

/** FK-safe order for import */
const TABLES = [
  'courses',
  'course_versions',
  'course_templates',
  'course_collaborators',
  'modules',
  'lessons',
  'content_items',
  'video_segments',
  'reading_materials',
  'quizzes',
  'quiz_questions',
  'forms',
  'form_fields',
  'external_assessments',
  'enrollments',
  'progress',
  'learner_preferences',
  'learner_activity',
  'learner_notes',
  'learner_invites',
  'learner_reminders',
  'course_questions',
  'course_ratings',
  'user_notifications',
  'user_profiles',
  'course_analytics',
  'google_drive_connections',
  'quiz_attempts',
  'external_assessment_sessions',
  'external_assessment_responses',
  'webhook_assessment_events',
]

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`
  return `'${String(val).replace(/'/g, "''")}'`
}

async function fetchAll(supabase, table) {
  const rows = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return null
      }
      throw new Error(`${table}: ${error.message}`)
    }
    if (!data?.length) break
    rows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return rows
}

async function main() {
  const { url, key } = loadEnv()
  if (!url || !key) {
    console.error('Need Supabase Cloud credentials in one of:')
    console.error('  .env.cloud  (CLOUD_SUPABASE_URL + CLOUD_SUPABASE_SERVICE_ROLE_KEY)')
    console.error('  .env.local  (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
  }

  console.error(`Exporting from ${url} …`)

  const supabase = createNodeSupabaseClient(url, key)
  const outDir = join(root, 'database', 'seed')
  mkdirSync(outDir, { recursive: true })

  const payload = { exported_at: new Date().toISOString(), source: url, tables: {} }
  const sqlLines = [
    '-- Coursify cloud data export (public schema). Run after apply-schema.sh',
    'BEGIN;',
    "SET session_replication_role = 'replica';",
  ]

  for (const table of TABLES) {
    process.stderr.write(`Exporting ${table}… `)
    const rows = await fetchAll(supabase, table)
    if (rows === null) {
      process.stderr.write('skip (missing)\n')
      continue
    }
    payload.tables[table] = rows
    process.stderr.write(`${rows.length} rows\n`)

    if (rows.length === 0) continue

    const cols = Object.keys(rows[0])
    for (const row of rows) {
      const values = cols.map((c) => sqlLiteral(row[c]))
      sqlLines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;`)
    }
  }

  const authUsers = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    authUsers.push(...data.users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
    })))
    if (data.users.length < 1000) break
    page += 1
  }
  payload.auth_users = authUsers
  process.stderr.write(`Exported ${authUsers.length} auth users (metadata)\n`)

  sqlLines.push("SET session_replication_role = 'origin';")
  sqlLines.push('COMMIT;')

  writeFileSync(join(outDir, 'cloud-data.json'), JSON.stringify(payload, null, 2))
  writeFileSync(join(outDir, 'cloud-data.sql'), sqlLines.join('\n') + '\n')
  writeFileSync(join(outDir, 'auth-users.json'), JSON.stringify(authUsers, null, 2))

  console.log('Wrote database/seed/cloud-data.json — run ./docker/import-cloud-data.sh next')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
