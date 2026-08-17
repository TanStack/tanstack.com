import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { chromium, type Frame, type Page, type Response } from 'playwright-core'
import { parseNotebookAiExecution } from '../../src/utils/notebook-ai'
import { notebookAiEvalCases } from './cases'
import { gradeNotebookAiWorkspace } from './grade'
import type {
  NotebookAiEvalAction,
  NotebookAiEvalAttemptResult,
  NotebookAiEvalCase,
  NotebookAiEvalCheckResult,
  NotebookAiEvalPreviewCheck,
  NotebookAiEvalPreviewStep,
} from './types'

type Connection = 'chatgpt' | 'openai' | 'anthropic'

type Options = {
  baseUrl: string
  caseIds: ReadonlyArray<string>
  connection: Connection
  headed: boolean
  model: string | null
  outputDirectory: string
  runs: number
}

type AgentTelemetry = {
  requestCount: number
  toolCalls: Array<string>
  usage: Record<string, number>
}

const options = parseOptions(process.argv.slice(2))
const cases = selectCases(options.caseIds)
const apiKey = readApiKey(options.connection)

await assertServerAvailable(options.baseUrl)
await fs.mkdir(options.outputDirectory, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: !options.headed,
  ...(process.env.NOTEBOOK_EVAL_BROWSER
    ? { executablePath: process.env.NOTEBOOK_EVAL_BROWSER }
    : {}),
})

const results: Array<NotebookAiEvalAttemptResult> = []
try {
  for (const testCase of cases) {
    for (let run = 1; run <= options.runs; run += 1) {
      const result = await runCase(testCase, run)
      results.push(result)
      await writeSummary(results)
      printResult(result)
    }
  }
} finally {
  await browser.close()
}

const passed = results.filter((result) => result.passed).length
console.log(`\n${passed}/${results.length} notebook eval runs passed.`)
console.log(`Results: ${path.join(options.outputDirectory, 'results.json')}`)
process.exitCode = passed === results.length ? 0 : 1

async function runCase(testCase: NotebookAiEvalCase, run: number) {
  const startedAt = Date.now()
  const artifactDirectory = path.join(
    options.outputDirectory,
    `${testCase.id}-${run}`,
  )
  await fs.mkdir(artifactDirectory, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  })
  const page = await context.newPage()
  const browserErrors: Array<string> = []
  const telemetry: AgentTelemetry = {
    requestCount: 0,
    toolCalls: [],
    usage: {},
  }
  const responseTasks: Array<Promise<void>> = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(limitText(message.text(), 2_000))
    }
  })
  page.on('pageerror', (error) => {
    browserErrors.push(limitText(error.message, 2_000))
  })
  page.on('response', (response) => {
    if (!isAssistResponse(response)) return
    responseTasks.push(collectAgentTelemetry(response, telemetry))
  })

  let assistantError: string | null = null
  let assistantMessage: string | null = null
  let selectedModel: string | null = null
  let checks: Array<NotebookAiEvalCheckResult> = []
  let passed = false

  try {
    try {
      await page.goto(`${options.baseUrl}/notebook/ai`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      })
      const editor = page.locator('section[aria-label="Notebook AI editor"]')
      await editor.waitFor({ state: 'visible', timeout: 60_000 })
      await page.waitForFunction(
        () => {
          const bridge: unknown = Reflect.get(
            window,
            '__TANSTACK_NOTEBOOK_AI_EVAL__',
          )
          return typeof bridge === 'object' && bridge !== null
        },
        undefined,
        { timeout: 60_000 },
      )

      await configureConnection(page, options.connection, options.model, apiKey)
      selectedModel = await page
        .locator('[data-notebook-ai-selected-model]')
        .getAttribute('data-notebook-ai-selected-model')

      await page.getByLabel('Notebook change').fill(testCase.prompt)
      await page.getByRole('button', { name: 'Send message' }).click()
      await page.waitForFunction(
        () =>
          document
            .querySelector('section[aria-label="Notebook AI editor"]')
            ?.getAttribute('aria-busy') === 'true',
        undefined,
        { timeout: 10_000 },
      )
      await page.waitForFunction(
        () =>
          document
            .querySelector('section[aria-label="Notebook AI editor"]')
            ?.getAttribute('aria-busy') === 'false',
        undefined,
        { timeout: testCase.timeoutMs },
      )
      await Promise.allSettled(responseTasks)

      const alerts = await editor.locator('[role="alert"]').allTextContents()
      assistantError = alerts.map((text) => text.trim()).find(Boolean) ?? null
      const assistantMessages = await editor
        .locator('article[aria-label="Assistant"]')
        .allTextContents()
      assistantMessage =
        assistantMessages.length > 0
          ? limitText(assistantMessages.at(-1)?.trim() ?? '', 4_000) || null
          : null

      const executionValue: unknown = await page.evaluate(() => {
        const bridge: unknown = Reflect.get(
          window,
          '__TANSTACK_NOTEBOOK_AI_EVAL__',
        )
        if (typeof bridge !== 'object' || bridge === null) return undefined
        const getExecution: unknown = Reflect.get(bridge, 'getExecution')
        if (typeof getExecution !== 'function') return undefined
        return Reflect.apply(getExecution, bridge, [])
      })
      const execution = parseNotebookAiExecution(executionValue)
      await fs.writeFile(
        path.join(artifactDirectory, 'execution.json'),
        `${JSON.stringify(execution, null, 2)}\n`,
      )

      checks = gradeNotebookAiWorkspace(execution, testCase.workspaceChecks)
      if (assistantError || checks.some((check) => !check.passed)) {
        checks.push({
          description: 'preview validation',
          passed: false,
          evidence: assistantError
            ? 'skipped because the assistant failed'
            : 'skipped because workspace requirements failed',
        })
      } else {
        const browserErrorOffset = browserErrors.length
        checks.push(
          ...(await gradePreviewSteps(
            page,
            testCase.previewSteps,
            testCase.timeoutMs,
          )),
        )
        const previewErrors = browserErrors.slice(browserErrorOffset)
        checks.push({
          description: 'preview interactions do not raise browser errors',
          passed: previewErrors.length === 0,
          evidence: previewErrors.length
            ? previewErrors.join('\n')
            : 'no new console or page errors',
        })
      }
    } catch (error) {
      assistantError ??= formatError(error)
    }

    passed =
      assistantError === null &&
      checks.length > 0 &&
      checks.every((check) => check.passed)

    if (!passed) {
      try {
        await page.screenshot({
          path: path.join(artifactDirectory, 'failure.png'),
          fullPage: true,
        })
      } catch (error) {
        browserErrors.push(
          `Could not capture failure screenshot: ${formatError(error)}`,
        )
      }
    }
  } finally {
    try {
      await context.close()
    } catch (error) {
      browserErrors.push(
        `Could not close browser context: ${formatError(error)}`,
      )
    }
  }

  return {
    caseId: testCase.id,
    run,
    passed,
    durationMs: Date.now() - startedAt,
    model: selectedModel,
    connection: options.connection,
    agentRequests: telemetry.requestCount,
    toolCalls: telemetry.toolCalls,
    usage: Object.keys(telemetry.usage).length ? telemetry.usage : null,
    assistantMessage,
    assistantError,
    browserErrors: browserErrors.slice(0, 20),
    checks,
    artifactDirectory,
  } satisfies NotebookAiEvalAttemptResult
}

async function configureConnection(
  page: Page,
  connection: Connection,
  model: string | null,
  key: string | null,
) {
  if (connection === 'chatgpt') {
    try {
      await page.getByLabel('Notebook change').waitFor({
        state: 'visible',
        timeout: 30_000,
      })
    } catch {
      throw new Error(
        'ChatGPT is not connected. Open /notebook/ai, choose Continue with ChatGPT, and finish device login first.',
      )
    }
    if (model) await selectModel(page, model, 'chatgpt')
    return
  }

  if (!key) throw new Error(`Missing ${connection.toUpperCase()} API key`)
  const prompt = page.getByLabel('Notebook change')
  if (await prompt.isVisible()) {
    await page.getByRole('button', { name: 'Open model connections' }).click()
  } else {
    await page.getByRole('button', { name: 'Use an API key' }).click()
  }

  await page.getByLabel('Provider').selectOption(connection)
  const providerName = connection === 'openai' ? 'OpenAI' : 'Anthropic'
  await page.getByLabel(`${providerName} API key`).fill(key)
  await page.getByRole('button', { name: 'Use key' }).click()
  await prompt.waitFor({ state: 'visible', timeout: 30_000 })
  await selectModel(page, model ?? defaultModel(connection), 'byok')
}

async function selectModel(
  page: Page,
  model: string,
  connection: 'byok' | 'chatgpt',
) {
  if (!/^[A-Za-z0-9._:-]+$/.test(model)) {
    throw new Error(`Invalid model id: ${model}`)
  }
  await page.getByRole('button', { name: /^Select model/ }).click()
  const item = page.locator(
    `[data-notebook-ai-connection="${connection}"][data-notebook-ai-model="${model}"]`,
  )
  await item.waitFor({ state: 'visible', timeout: 10_000 })
  await item.click()
}

async function gradePreviewSteps(
  page: Page,
  steps: ReadonlyArray<NotebookAiEvalPreviewStep>,
  caseTimeoutMs: number,
) {
  const results: Array<NotebookAiEvalCheckResult> = []
  for (const step of steps) {
    let documentToken: string | null = null
    if (step.documentMustPersist) {
      documentToken = randomUUID()
      const frame = await getPreviewFrame(page, step.timeoutMs ?? caseTimeoutMs)
      await frame.evaluate((token) => {
        Reflect.set(globalThis, '__tanstackNotebookEvalDocument', token)
      }, documentToken)
    }

    if (step.action) await performAction(page, step.action, caseTimeoutMs)
    for (const check of step.checks) {
      results.push(
        await pollPreviewCheck(
          page,
          check,
          step.timeoutMs ?? Math.min(caseTimeoutMs, 30_000),
        ),
      )
    }

    if (documentToken) {
      const frame = await getPreviewFrame(page, step.timeoutMs ?? caseTimeoutMs)
      const currentToken: unknown = await frame.evaluate(() =>
        Reflect.get(globalThis, '__tanstackNotebookEvalDocument'),
      )
      results.push({
        description: `${step.description}: preserves the preview document`,
        passed: currentToken === documentToken,
        evidence:
          currentToken === documentToken
            ? 'client navigation kept the same document'
            : 'navigation replaced the document',
      })
    }
  }
  return results
}

async function performAction(
  page: Page,
  action: NotebookAiEvalAction,
  timeoutMs: number,
) {
  if (action.kind === 'resize') {
    await page.setViewportSize({ width: action.width, height: action.height })
    await page.waitForTimeout(300)
    return
  }

  const frame = await getPreviewFrame(page, timeoutMs)
  if (action.kind === 'reload') {
    await frame.goto(frame.url(), {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(timeoutMs, 60_000),
    })
  } else if (action.kind === 'clickUntil') {
    const target = action.text
      ? frame.locator(action.selector).filter({ hasText: action.text }).first()
      : frame.locator(action.selector).first()
    const condition = action.untilText
      ? frame
          .locator(action.untilSelector)
          .filter({ hasText: action.untilText })
          .first()
      : frame.locator(action.untilSelector).first()
    const maximumClicks = action.maximumClicks ?? 3
    for (let clicks = 0; clicks <= maximumClicks; clicks += 1) {
      if (await condition.count()) return
      if (clicks < maximumClicks) {
        await target.click({ timeout: Math.min(timeoutMs, 30_000) })
      }
    }
    throw new Error(
      `Click condition did not match after ${maximumClicks} clicks: ${action.untilSelector}`,
    )
  } else if (action.kind === 'click') {
    const locator = action.text
      ? frame.locator(action.selector).filter({ hasText: action.text }).first()
      : frame.locator(action.selector).first()
    await locator.click({ timeout: Math.min(timeoutMs, 30_000) })
  } else {
    const locator = frame.locator(action.selector).first()
    await locator.fill(action.value, { timeout: Math.min(timeoutMs, 30_000) })
  }
}

async function pollPreviewCheck(
  page: Page,
  check: NotebookAiEvalPreviewCheck,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs
  let lastResult: NotebookAiEvalCheckResult | undefined
  do {
    try {
      const frame = await getPreviewFrame(page, Math.min(timeoutMs, 5_000))
      lastResult = await gradePreviewCheck(frame, check)
      if (lastResult.passed) return lastResult
    } catch (error) {
      lastResult = {
        description: check.description,
        passed: false,
        evidence: formatError(error),
      }
    }
    await page.waitForTimeout(100)
  } while (Date.now() < deadline)

  return (
    lastResult ?? {
      description: check.description,
      passed: false,
      evidence: 'preview check timed out',
    }
  )
}

async function gradePreviewCheck(
  frame: Frame,
  check: NotebookAiEvalPreviewCheck,
): Promise<NotebookAiEvalCheckResult> {
  switch (check.kind) {
    case 'selector': {
      const locator = frame.locator(check.selector)
      const count = await locator.count()
      const minimum = check.minimum ?? 1
      const countPassed =
        count >= minimum &&
        (check.maximum === undefined || count <= check.maximum)
      const contents = check.textIncludes
        ? (await locator.allTextContents()).join('\n')
        : ''
      const textPassed =
        check.textIncludes?.every((text) => contents.includes(text)) ?? true
      return checkResult(
        check.description,
        countPassed && textPassed,
        `matched ${count}; expected ${minimum}${check.maximum === undefined ? '+' : `-${check.maximum}`}${check.textIncludes ? `; text: ${limitText(contents, 400)}` : ''}`,
      )
    }
    case 'text': {
      const body = await frame.locator('body').innerText()
      const found = body.includes(check.text)
      const passed = check.absent ? !found : found
      return checkResult(
        check.description,
        passed,
        `${JSON.stringify(check.text)} was ${found ? '' : 'not '}present`,
      )
    }
    case 'texts': {
      const actual = (
        await frame.locator(check.selector).allTextContents()
      ).map((text) => text.trim())
      return checkResult(
        check.description,
        JSON.stringify(actual) === JSON.stringify(check.expected),
        `expected ${JSON.stringify(check.expected)}; received ${JSON.stringify(actual)}`,
      )
    }
    case 'geometry': {
      const geometry = await frame
        .locator(check.selector)
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect()
            return { width: rect.width, height: rect.height }
          }),
        )
      const visible = geometry.filter(
        ({ width, height }) =>
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0,
      )
      const distinctHeights = new Set(
        visible.map(({ height }) => Math.round(height * 10) / 10),
      ).size
      const passed =
        visible.length >= check.minimum &&
        (check.distinctHeights === undefined ||
          distinctHeights >= check.distinctHeights)
      return checkResult(
        check.description,
        passed,
        `${visible.length}/${geometry.length} visible; ${distinctHeights} distinct heights`,
      )
    }
    case 'url': {
      const pathname = new URL(frame.url()).pathname
      return checkResult(
        check.description,
        pathname === check.pathname,
        `expected ${check.pathname}; received ${pathname}`,
      )
    }
    case 'title': {
      const title = await frame.title()
      return checkResult(
        check.description,
        title.includes(check.text),
        `received ${JSON.stringify(title)}`,
      )
    }
    case 'label': {
      const count = await frame.getByLabel(check.label).count()
      const minimum = check.minimum ?? 1
      return checkResult(
        check.description,
        count >= minimum,
        `matched ${count}; expected ${minimum}+ controls labeled ${JSON.stringify(check.label)}`,
      )
    }
  }
}

async function getPreviewFrame(page: Page, timeoutMs: number) {
  const iframe = page.locator('iframe[title="AI notebook spike output"]')
  await iframe.waitFor({
    state: 'attached',
    timeout: Math.min(timeoutMs, 30_000),
  })
  const element = await iframe.elementHandle()
  const frame = await element?.contentFrame()
  if (!frame) throw new Error('Notebook preview frame is unavailable')
  return frame
}

async function collectAgentTelemetry(
  response: Response,
  telemetry: AgentTelemetry,
) {
  telemetry.requestCount += 1
  try {
    const source = await response.text()
    for (const line of source.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue
      const event = parseRecord(JSON.parse(line.slice(5).trim()))
      if (!event) continue
      if (
        event.type === 'TOOL_CALL_START' &&
        typeof event.toolCallName === 'string'
      ) {
        telemetry.toolCalls.push(event.toolCallName)
      }
      if (event.type === 'RUN_FINISHED') {
        addUsage(telemetry.usage, event.usage)
      }
    }
  } catch {
    // Telemetry is best-effort and never affects correctness.
  }
}

function addUsage(target: Record<string, number>, value: unknown) {
  const usage = parseRecord(value)
  if (!usage) return
  for (const [key, count] of Object.entries(usage)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      target[key] = (target[key] ?? 0) + count
    }
  }
}

function isAssistResponse(response: Response) {
  const pathname = new URL(response.url()).pathname
  return (
    pathname === '/api/notebook/assist' ||
    pathname === '/api/notebook/chatgpt/assist'
  )
}

function selectCases(caseIds: ReadonlyArray<string>) {
  if (!caseIds.length) return notebookAiEvalCases
  const selected = notebookAiEvalCases.filter((testCase) =>
    caseIds.includes(testCase.id),
  )
  const missing = caseIds.filter(
    (id) => !notebookAiEvalCases.some((testCase) => testCase.id === id),
  )
  if (missing.length)
    throw new Error(`Unknown eval case: ${missing.join(', ')}`)
  return selected
}

function parseOptions(args: ReadonlyArray<string>): Options {
  let baseUrl = process.env.NOTEBOOK_EVAL_BASE_URL ?? 'http://localhost:4173'
  const caseIds: Array<string> = []
  let connection: Connection = 'chatgpt'
  let headed = false
  let model: string | null = null
  let runs = 1
  let outputDirectory = path.resolve(
    '.cache/notebook-ai/evals',
    new Date().toISOString().replace(/[:.]/g, '-'),
  )

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    const value = args[index + 1]
    if (argument === '--') continue
    if (argument === '--headed') {
      headed = true
      continue
    }
    if (!value) throw new Error(`Missing value for ${argument}`)
    if (argument === '--base-url') baseUrl = value
    else if (argument === '--case') caseIds.push(value)
    else if (argument === '--connection') connection = parseConnection(value)
    else if (argument === '--model') model = value
    else if (argument === '--output') outputDirectory = path.resolve(value)
    else if (argument === '--runs') {
      runs = Number(value)
      if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
        throw new Error('--runs must be an integer from 1 to 20')
      }
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
    index += 1
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    caseIds,
    connection,
    headed,
    model,
    outputDirectory,
    runs,
  }
}

function parseConnection(value: string): Connection {
  if (value === 'chatgpt' || value === 'openai' || value === 'anthropic') {
    return value
  }
  throw new Error(`Unknown connection: ${value}`)
}

function readApiKey(connection: Connection) {
  if (connection === 'chatgpt') return null
  const key =
    connection === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY
  return key?.trim() || null
}

function defaultModel(connection: Exclude<Connection, 'chatgpt'>) {
  return connection === 'openai' ? 'gpt-5.4-mini' : 'claude-sonnet-4-6'
}

async function assertServerAvailable(baseUrl: string) {
  try {
    const response = await fetch(`${baseUrl}/notebook/ai`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    throw new Error(
      `Notebook dev server is unavailable at ${baseUrl}: ${formatError(error)}`,
    )
  }
}

async function writeSummary(
  results: ReadonlyArray<NotebookAiEvalAttemptResult>,
) {
  const passed = results.filter((result) => result.passed).length
  await fs.writeFile(
    path.join(options.outputDirectory, 'results.json'),
    `${JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        configuration: {
          baseUrl: options.baseUrl,
          caseIds: cases.map((testCase) => testCase.id),
          connection: options.connection,
          model: options.model,
          runs: options.runs,
        },
        summary: {
          passed,
          failed: results.length - passed,
          total: results.length,
        },
        results,
      },
      null,
      2,
    )}\n`,
  )
}

function printResult(result: NotebookAiEvalAttemptResult) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.caseId} #${result.run} (${formatDuration(result.durationMs)}, ${result.agentRequests} agent ${result.agentRequests === 1 ? 'request' : 'requests'})`,
  )
  for (const check of result.checks.filter((item) => !item.passed)) {
    console.log(`  - ${check.description}: ${check.evidence}`)
  }
  if (result.assistantError) console.log(`  - ${result.assistantError}`)
}

function checkResult(
  description: string,
  passed: boolean,
  evidence: string,
): NotebookAiEvalCheckResult {
  return { description, passed, evidence }
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const record: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) record[key] = entry
  return record
}

function formatDuration(milliseconds: number) {
  return `${Math.round(milliseconds / 1_000)}s`
}

function limitText(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}…`
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
