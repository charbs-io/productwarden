type ReportRun = {
  target_url: string
  persona: string
  goal: string
  status: string
  result: string | null
  created_at: string
}

type ReportPersona = {
  name: string
  role: string
  responsibilities: string[]
  report_focus: string[]
  goal: string
  status: string
  result: string | null
  issue_count: number
  report_md?: string | null
}

type ReportStep = {
  step_number: number
  observation: string
  action: Record<string, unknown>
  screenshot_path: string | null
}

type ReportIssue = {
  title: string
  severity: string
  category: string
  description: string
  evidence: string
  suggested_fix: string
  step_number: number | null
  screenshot_path: string | null
}

export function generatePersonaMarkdownReport(run: ReportRun, persona: ReportPersona, steps: ReportStep[], issues: ReportIssue[]) {
  const result = persona.result || (persona.status === 'completed' ? 'completed' : persona.status)
  const summary = issues.length
    ? `${persona.name} found ${issues.length} issue${issues.length === 1 ? '' : 's'} while attempting the requested journey.`
    : `${persona.name} did not record any issues during this journey.`

  return `# ${persona.name} Report

## Test Setup
- URL: ${run.target_url}
- Persona: ${persona.name}
- Role: ${persona.role}
- Goal: ${persona.goal}
- Date/time: ${new Date(run.created_at).toISOString()}
- Result: ${result}

## Responsibilities
${persona.responsibilities.map(item => `- ${item}`).join('\n') || '- No responsibilities recorded.'}

## Executive Summary
${summary}

## Journey Trace
| Step | Action | Observation | Screenshot |
| --- | --- | --- | --- |
${steps.map(step => `| ${step.step_number} | ${readActionType(step.action)} | ${escapeTable(step.observation)} | ${step.screenshot_path || 'none'} |`).join('\n')}

## Issues Found
${issues.length
  ? issues.map(issue => `### ${issue.title}
- Severity: ${issue.severity}
- Category: ${issue.category}
- Repro steps: Review step ${issue.step_number || 'unknown'} and repeat the visible action.
- Expected behavior: The product should let the persona continue toward the stated goal without avoidable confusion or failure.
- Actual behavior: ${issue.description}
- Evidence screenshot: ${issue.screenshot_path || 'none'}
- Suggested fix: ${issue.suggested_fix}
`).join('\n')
  : 'No issues recorded.'}

## Report Focus
${persona.report_focus.map(item => `- ${item}`).join('\n') || '- No report focus recorded.'}

## Recommended Fix Priority
${priorityList(issues)}
`
}

export function generateOverarchingMarkdownReport(run: ReportRun, personas: ReportPersona[], issues: ReportIssue[]) {
  const result = run.result || (run.status === 'completed' ? 'completed' : run.status)
  const personaSummary = personas.length
    ? personas.map(persona => `- ${persona.name}: ${persona.status}${persona.issue_count ? `, ${persona.issue_count} issue${persona.issue_count === 1 ? '' : 's'}` : ', no issues'}`).join('\n')
    : `- ${run.persona}: ${result}`

  const byCategory = issues.reduce<Record<string, number>>((counts, issue) => {
    counts[issue.category] = (counts[issue.category] || 0) + 1
    return counts
  }, {})
  const categorySummary = Object.entries(byCategory)
    .map(([category, count]) => `- ${category}: ${count}`)
    .join('\n') || '- No issues recorded.'

  return `# Product Warden Run Report

## Test Setup
- URL: ${run.target_url}
- Goal: ${run.goal}
- Date/time: ${new Date(run.created_at).toISOString()}
- Result: ${result}
- Personas: ${personas.map(persona => persona.name).join(', ') || run.persona}

## Executive Summary
Product Warden ran ${personas.length || 1} persona${(personas.length || 1) === 1 ? '' : 's'} and found ${issues.length} issue${issues.length === 1 ? '' : 's'}.

## Persona Reports
${personaSummary}

## Issue Categories
${categorySummary}

## Issues Found
${issues.length
  ? issues.map(issue => `### ${issue.title}
- Severity: ${issue.severity}
- Category: ${issue.category}
- Persona step: ${issue.step_number || 'unknown'}
- Actual behavior: ${issue.description}
- Evidence screenshot: ${issue.screenshot_path || 'none'}
- Suggested fix: ${issue.suggested_fix}
`).join('\n')
  : 'No issues recorded.'}

## Recommended Fix Priority
${priorityList(issues)}
`
}

export function generateMarkdownReport(run: ReportRun, steps: ReportStep[], issues: ReportIssue[]) {
  return generatePersonaMarkdownReport(run, {
    name: run.persona,
    role: run.persona,
    responsibilities: [],
    report_focus: [],
    goal: run.goal,
    status: run.status,
    result: run.result,
    issue_count: issues.length
  }, steps, issues)
}

function priorityList(issues: ReportIssue[]) {
  const high = issues.filter(issue => issue.severity === 'high')
  const medium = issues.filter(issue => issue.severity === 'medium')
  const low = issues.filter(issue => issue.severity === 'low')

  return [
    `- P0: ${high.map(issue => issue.title).join(', ') || 'None'}`,
    `- P1: ${medium.map(issue => issue.title).join(', ') || 'None'}`,
    `- P2: ${low.map(issue => issue.title).join(', ') || 'None'}`
  ].join('\n')
}

function escapeTable(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function readActionType(action: Record<string, unknown>) {
  return typeof action.type === 'string' ? action.type : 'observe'
}
