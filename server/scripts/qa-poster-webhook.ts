type QaCase = {
  name: string
  payload: Record<string, unknown>
  expectedStatus: number
}

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3000'
const endpoint = `${baseUrl.replace(/\/$/, '')}/webhooks/poster`

const cases: QaCase[] = [
  {
    name: 'empty payload returns ack',
    payload: {},
    expectedStatus: 200,
  },
  {
    name: 'unknown account is safely ignored',
    payload: {
      object: 'transaction',
      action: 'closed',
      object_id: 123456,
      account: 'non-existing-poster-account',
    },
    expectedStatus: 200,
  },
  {
    name: 'non-transaction event is safely ignored',
    payload: {
      object: 'client',
      action: 'changed',
      object_id: 777,
      account: 'non-existing-poster-account',
    },
    expectedStatus: 200,
  },
]

async function run() {
  let failed = 0

  for (const testCase of cases) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase.payload),
      })
      const text = await response.text()

      if (response.status !== testCase.expectedStatus) {
        failed += 1
        console.error(`❌ ${testCase.name}`)
        console.error(`   expected status: ${testCase.expectedStatus}, got: ${response.status}`)
        console.error(`   body: ${text}`)
      } else {
        console.log(`✅ ${testCase.name}`)
      }
    } catch (error: any) {
      failed += 1
      console.error(`❌ ${testCase.name}`)
      console.error(`   request failed: ${error?.message || String(error)}`)
    }
  }

  if (failed > 0) {
    console.error(`\nPoster webhook QA failed: ${failed} case(s)`)
    process.exit(1)
  }

  console.log('\nPoster webhook QA passed')
}

run()
