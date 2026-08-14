const LINE_TEMPLATE = 'Billing verification fixture line {line}. Use this text only as immutable input evidence.'

function defaultFixtureText(lineCount) {
  const count = Math.min(Math.max(Number(lineCount) || 200, 20), 2000)
  return Array.from({ length: count }, (_, index) =>
    LINE_TEMPLATE.replace('{line}', String(index + 1).padStart(4, '0'))
  ).join('\n')
}

export function setupFixtureEditor() {
  const toggle = document.getElementById('custom-fixture-toggle')
  const panel = document.getElementById('custom-fixture-panel')
  const textarea = document.getElementById('fixture-text')
  const lineCount = document.getElementById('fixture-lines')
  const stats = document.getElementById('fixture-stats')
  const hint = document.getElementById('fixture-hint')

  const updateStats = () => {
    const content = textarea.value.trim()
    const lines = content ? content.split(/\r?\n/).length : 0
    stats.textContent = `${lines.toLocaleString()} 行 · ${content.length.toLocaleString()} 字符`
    if (toggle.checked) hint.textContent = `自定义语料 · ${lines.toLocaleString()} 行`
  }

  const updateMode = () => {
    const enabled = toggle.checked
    panel.hidden = !enabled
    textarea.required = enabled
    lineCount.disabled = enabled
    if (enabled && !textarea.value.trim()) textarea.value = defaultFixtureText(lineCount.value)
    if (enabled) {
      updateStats()
      textarea.focus()
    } else {
      hint.textContent = `内置固定语料 · ${Number(lineCount.value).toLocaleString()} 行`
    }
    window.lucide.createIcons()
  }

  toggle.addEventListener('change', updateMode)
  textarea.addEventListener('input', updateStats)
  lineCount.addEventListener('input', () => {
    if (!toggle.checked) hint.textContent = `内置固定语料 · ${Number(lineCount.value || 0).toLocaleString()} 行`
  })
  updateMode()

  return {
    fixtureText: () => toggle.checked ? textarea.value.trim() : ''
  }
}
