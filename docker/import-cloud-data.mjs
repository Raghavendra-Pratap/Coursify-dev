/**
 * Import cloud-data.json into local self-hosted Supabase.
 * Creates auth users (same UUIDs), then upserts public tables with column filtering.
 */
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SEED = join(root, 'database', 'seed', 'cloud-data.json')
const SUPABASE_ENV = join(root, 'docker', 'vendor', 'supabase', 'docker', '.env')

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

function readEnvVal(key, file) {
  const line = readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`))
  if (!line) return ''
  let val = line.slice(key.length + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  return val
}

function getLocalColumns(table) {
  const out = execSync(
    `docker exec supabase-db psql -U postgres -d postgres -tA -c "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position;"`,
    { encoding: 'utf8' }
  )
  return out.trim().split('\n').filter(Boolean)
}

function pickColumns(row, columns) {
  const colSet = new Set(columns)
  const picked = {}
  for (const [k, v] of Object.entries(row)) {
    if (colSet.has(k)) picked[k] = v
  }
  return picked
}

const moduleIdRemap = new Map()
const lessonIdRemap = new Map()
const contentItemIdRemap = new Map()

function dedupeByKey(rows, keyFn, idRemap) {
  const byKey = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (byKey.has(key)) {
      idRemap.set(row.id, byKey.get(key).id)
    } else {
      byKey.set(key, row)
    }
  }
  return [...byKey.values()]
}

function prepareTableRows(table, rows) {
  if (table === 'modules') {
    moduleIdRemap.clear()
    lessonIdRemap.clear()
    contentItemIdRemap.clear()
    return dedupeByKey(rows, (r) => `${r.course_id}|${r.order_index}`, moduleIdRemap)
  }

  if (table === 'lessons') {
    const remapped = rows.map((row) => ({
      ...row,
      module_id: moduleIdRemap.get(row.module_id) ?? row.module_id,
    }))
    return dedupeByKey(remapped, (r) => `${r.module_id}|${r.order_index}`, lessonIdRemap)
  }

  if (table === 'content_items') {
    const remapped = rows.map((row) => ({
      ...row,
      lesson_id: lessonIdRemap.get(row.lesson_id) ?? row.lesson_id,
    }))
    return dedupeByKey(remapped, (r) => `${r.lesson_id}|${r.order_index}`, contentItemIdRemap)
  }

  if (['video_segments', 'reading_materials', 'quizzes', 'forms', 'external_assessments'].includes(table)) {
    return rows.map((row) => ({
      ...row,
      content_item_id: contentItemIdRemap.get(row.content_item_id) ?? row.content_item_id,
    }))
  }

  if (table === 'progress' || table === 'learner_notes') {
    return rows.map((row) => ({
      ...row,
      lesson_id: lessonIdRemap.get(row.lesson_id) ?? row.lesson_id,
    }))
  }

  return rows
}

async function main() {
  if (!existsSync(SEED)) {
    console.error(`Missing ${SEED} — run ./docker/export-from-cloud.sh first.`)
    process.exit(1)
  }
  if (!existsSync(SUPABASE_ENV)) {
    console.error('Run ./docker/setup-supabase.sh first.')
    process.exit(1)
  }

  const url = 'http://localhost:8000'
  const key = readEnvVal('SERVICE_ROLE_KEY', SUPABASE_ENV)
  if (!key) {
    console.error('SERVICE_ROLE_KEY not found in Supabase docker .env')
    process.exit(1)
  }

  const payload = JSON.parse(readFileSync(SEED, 'utf8'))
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const authUsers = payload.auth_users || []
  console.error(`Creating ${authUsers.length} auth users (password: LocalDev123!)…`)
  for (const u of authUsers) {
    if (!u.email) continue
    const { error } = await supabase.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: 'LocalDev123!',
      email_confirm: true,
      user_metadata: u.user_metadata || {},
      app_metadata: u.app_metadata || {},
    })
    if (error && !/already|exists|registered/i.test(error.message)) {
      console.error(`  ${u.email}: ${error.message}`)
    }
  }

  for (const table of TABLES) {
    const rows = payload.tables?.[table]
    if (!rows?.length) continue

    let columns
    try {
      columns = getLocalColumns(table)
    } catch {
      console.error(`Skip ${table} (table missing locally)`)
      continue
    }
    if (!columns.length) continue

    const batch = prepareTableRows(table, rows).map((r) => pickColumns(r, columns))
    process.stderr.write(`Importing ${table} (${batch.length} rows)… `)

    let opts = undefined
    if (columns.includes('id')) {
      opts = { onConflict: 'id' }
    } else if (table === 'learner_preferences' && columns.includes('user_id')) {
      opts = { onConflict: 'user_id' }
    }

    const { error } = await supabase.from(table).upsert(batch, opts)
    if (error) {
      console.error(`FAIL: ${error.message}`)
    } else {
      console.error('ok')
    }
  }

  console.log('Import complete. Sign in with your cloud email + password LocalDev123!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
