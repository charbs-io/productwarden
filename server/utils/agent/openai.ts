import OpenAI from 'openai'
import { agentDecisionSchema, type AgentDecision, type ElementInventoryItem } from '../agent-types'
import type { GithubRepositoryContext } from '../github-context'

type DecideInput = {
  persona: string
  goal: string
  currentUrl: string
  stepNumber: number
  history: Array<{
    step: number
    observation: string
    action: Record<string, unknown>
    result: Record<string, unknown>
  }>
  elements: ElementInventoryItem[]
  screenshot: Buffer
  diagnostics: Record<string, unknown>
  credentialFields: string[]
  githubContext?: GithubRepositoryContext | null
  repositoryVectorStoreId?: string | null
  openai: {
    apiKey: string
    model: string
  }
}

export async function decideNextAction(input: DecideInput): Promise<AgentDecision> {
  const client = new OpenAI({ apiKey: input.openai.apiKey })
  const screenshotDataUrl = `data:image/png;base64,${input.screenshot.toString('base64')}`

  const response = await client.responses.create({
    model: input.openai.model,
    instructions: [
      'You are Ghost Customer, an AI QA/customer-simulation agent.',
      'Act strictly as the provided persona profile and use its responsibilities to decide what to inspect and report.',
      'Use the screenshot and element inventory to choose the next Playwright action toward the user goal.',
      'Use browser diagnostics when relevant, especially network timings, page-load timing, console messages, and page errors.',
      'Use repository file search when it is available to connect visible product behavior to likely implementation details.',
      'Prefer target_id from the element inventory. Use coordinates only indirectly by leaving target_id blank if no element matches.',
      'Do not stop because signup/login credentials were not supplied. Product Warden provides disposable test credential placeholders for this run.',
      'If a credential is needed, put the exact placeholder in next_action.text, for example credential.email, credential.username, or credential.password.',
      'You may create disposable test accounts and harmless profile/workspace values needed for the stated goal.',
      'Do not perform real purchases, paid upgrades, destructive account actions, phone verification, government identity checks, or external email/OTP access. Stop and report that blocker if the journey requires one.',
      'Report only issues visible from this journey. Be specific, concise, and avoid duplicates.'
    ].join('\n'),
    input: [{
      role: 'user',
      content: [{
        type: 'input_text',
        text: JSON.stringify({
          persona: input.persona,
          goal: input.goal,
          current_url: input.currentUrl,
          step_number: input.stepNumber,
          available_credential_fields: input.credentialFields,
          github_repository_context: input.githubContext || null,
          browser_diagnostics: input.diagnostics,
          history: input.history.slice(-8),
          elements: input.elements.slice(0, 80)
        })
      }, {
        type: 'input_image',
        image_url: screenshotDataUrl,
        detail: 'high'
      }]
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'ghost_customer_decision',
        strict: true,
        schema: agentDecisionSchema
      }
    },
    tools: input.repositoryVectorStoreId
      ? [{
          type: 'file_search',
          vector_store_ids: [input.repositoryVectorStoreId]
        }]
      : undefined
  })

  return parseAgentDecision(readFinalOutputText(response))
}

function readFinalOutputText(response: {
  output?: Array<{
    type: string
    content?: Array<{
      type: string
      text?: string
    }>
  }>
  output_text?: string
}) {
  const texts: string[] = []

  for (const output of response.output || []) {
    if (output.type !== 'message') {
      continue
    }

    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        texts.push(content.text)
      }
    }
  }

  const text = texts.at(-1) || response.output_text || ''
  if (!text.trim()) {
    throw new Error('OpenAI returned an empty agent decision')
  }

  return text
}

function parseAgentDecision(text: string): AgentDecision {
  try {
    return JSON.parse(text) as AgentDecision
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON'
    throw new Error(`OpenAI returned an invalid agent decision: ${message}`)
  }
}
