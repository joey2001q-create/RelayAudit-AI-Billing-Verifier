import { loadModelPricing, runBenchmark } from './api.js'
import { parseProviderConfig } from './config-parser.js'
import { setupFixtureEditor } from './fixture-editor.js'
import { createProgressView } from './progress.js'
import { applyPricingCatalog, MODEL_PRESETS } from './presets.js'
import { buildHtmlReport, downloadFile } from './report.js'
import { verifyProvider } from './verification.js'

const providerDefaults = [
  { id: 'a', label: 'A', name: '待测中转站 A', color: '#146c43' },
  { id: 'b', label: 'B', name: '待测中转站 B', color: '#155f8a' }
]

let latestBenchmark = null
let latestVerification = null
let toastTimer
let providerMode = 'single'
const reportedCharges = new Map()
const reportedMultipliers = new Map()
const fixtureEditor = setupFixtureEditor()
const progressView = createProgressView()

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function providerTemplate(provider) {
  return `<article class="provider-panel" style="--provider-color:${provider.color}">
    <div class="provider-head"><div><span class="provider-mark">${provider.label}</span><h3>平台 ${provider.label}</h3></div><span class="muted">OpenAI 兼容接口</span></div>
    <div class="provider-body">
      <details class="advanced-details import-details">
        <summary><i data-lucide="clipboard-paste"></i><span>从 cURL、JSON 或三行配置导入</span></summary>
        <div class="advanced-content import-content">
          <textarea id="${provider.id}-import" aria-label="平台 ${provider.label} 配置内容" autocomplete="off" spellcheck="false" placeholder="粘贴配置内容"></textarea>
          <button class="secondary-button import-action" type="button" data-import-provider="${provider.id}"><i data-lucide="wand-sparkles"></i><span>识别并填入</span></button>
        </div>
      </details>
      <div class="provider-fields">
        <label class="span-two">Base URL<input id="${provider.id}-url" type="url" placeholder="https://example.com/v1" required></label>
        <label class="span-two key-wrap">API Key<input id="${provider.id}-key" type="password" autocomplete="off" placeholder="sk-..." required><button class="key-toggle" type="button" data-key-target="${provider.id}-key" title="显示或隐藏 API Key" aria-label="显示或隐藏 API Key"><i data-lucide="eye"></i></button></label>
      </div>
      <details class="advanced-details provider-options">
        <summary><i data-lucide="settings-2"></i><span>平台更多设置</span></summary>
        <div class="advanced-content provider-advanced-grid">
          <label>平台名称<input id="${provider.id}-name" value="${provider.name}" required></label>
          <label>模型别名<input id="${provider.id}-model" value="gpt-5.6-sol" required></label>
        </div>
      </details>
    </div>
  </article>`
}

function numberValue(id) {
  const value = document.getElementById(id).value
  return value === '' ? null : Number(value)
}

function formPayload() {
  const activeProviders = providerMode === 'single' ? providerDefaults.slice(0, 1) : providerDefaults
  return {
    canonicalModel: document.getElementById('canonical-model').value,
    pricing: {
      inputPerMillion: numberValue('price-input'),
      cachedInputPerMillion: numberValue('price-cached'),
      cacheCreationPerMillion: numberValue('price-cache-create'),
      outputPerMillion: numberValue('price-output')
    },
    settings: {
      rounds: numberValue('rounds'),
      fixtureLines: numberValue('fixture-lines'),
      fixtureText: fixtureEditor.fixtureText(),
      maxOutputTokens: numberValue('max-output-tokens'),
      testSuite: document.getElementById('test-suite').value
    },
    providers: activeProviders.map(({ id }) => ({
      name: document.getElementById(`${id}-name`).value,
      baseUrl: document.getElementById(`${id}-url`).value,
      apiKey: document.getElementById(`${id}-key`).value,
      model: document.getElementById(`${id}-model`).value
    }))
  }
}

function money(value) {
  if (!Number.isFinite(value)) return '待填写'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function metricClass(item) {
  if (!Number.isFinite(item.differenceRate)) return ''
  if (Math.abs(item.differenceRate) <= 0.02) return 'good'
  return item.difference > 0 ? 'bad' : 'warn'
}

function scenarioAnalysisTemplate(provider) {
  const rows = provider.scenarios.map((scenario) => {
    const totalInput = scenario.usage.inputTokens + scenario.usage.cachedInputTokens + scenario.usage.cacheCreationTokens
    const cacheShare = Number.isFinite(scenario.cacheReadShare)
      ? `${(scenario.cacheReadShare * 100).toFixed(2)}%`
      : '未返回'
    const growth = scenario.id === 'multi_turn'
      ? `${scenario.inputGrowthTokens >= 0 ? '+' : ''}${scenario.inputGrowthTokens.toLocaleString()}`
      : '-'
    return `<tr><td>${escapeHtml(scenario.name)}</td><td>${scenario.successfulCalls}/${scenario.requestedCalls}</td><td>${totalInput.toLocaleString()}</td><td>${scenario.usage.outputTokens.toLocaleString()}</td><td>${cacheShare}</td><td>${money(scenario.costs.standardCost)}</td><td>${growth}</td></tr>`
  }).join('')
  return `<div class="scenario-analysis"><h4>分维度结果</h4><div class="table-wrap"><table class="scenario-table"><thead><tr><th>测试维度</th><th>请求</th><th>输入 Token</th><th>输出 Token</th><th>缓存读取占比</th><th>标称基础费用</th><th>输入增长</th></tr></thead><tbody>${rows}</tbody></table></div></div>`
}

function resultTemplate(provider, verification, color) {
  const usage = provider.usage
  const totalInputTokens = usage.inputTokens + usage.cachedInputTokens + usage.cacheCreationTokens
  const cacheReadShare = totalInputTokens > 0 ? (usage.cachedInputTokens / totalInputTokens) * 100 : 0
  const averageInput = provider.successfulCalls > 0 ? totalInputTokens / provider.successfulCalls : 0
  const conclusionIcon = verification.conclusionTone === 'passed'
    ? 'badge-check'
    : verification.conclusionTone === 'failed'
      ? 'circle-x'
      : verification.conclusionTone === 'warning'
        ? 'triangle-alert'
        : 'circle-dot'
  return `<article class="result-panel" style="--provider-color:${color}">
    <div class="result-head"><div><span class="provider-mark">${provider.id.toUpperCase()}</span><h3>${escapeHtml(provider.name)}</h3></div><span class="status-chip status-${provider.status}">${provider.successfulCalls}/${provider.requestedCalls} 成功</span></div>
    <div class="result-body">
      <div class="charge-entry">
        <div class="charge-control"><label class="actual-charge-field"><span>实际消费</span><small>填写平台消费明细中的高精度金额</small><input class="reported-charge" data-provider-charge="${provider.id}" type="number" inputmode="decimal" min="0" step="any" value="${Number.isFinite(verification.reportedCharge) ? verification.reportedCharge : ''}" placeholder="例如 0.0532"></label><label class="multiplier-field">自定义倍率<small>默认 1，无特殊倍率不用修改</small><input data-provider-multiplier="${provider.id}" type="number" inputmode="decimal" min="0.001" step="0.001" value="${Number.isFinite(verification.advertisedMultiplier) ? verification.advertisedMultiplier : 1}"></label><button class="secondary-button" data-calculate-charge="${provider.id}" type="button"><i data-lucide="calculator"></i><span>生成结论</span></button></div>
      </div>
      <div class="conclusion-banner ${verification.conclusionTone}"><i data-lucide="${conclusionIcon}"></i><div><strong>${escapeHtml(verification.conclusion)}</strong><span>${escapeHtml(verification.verdict)}</span></div></div>
      <div class="metric-secondary">
        <div class="metric"><span>标称基础费用</span><strong>${money(verification.standardCost)}</strong></div>
        <div class="metric"><span>按倍率应扣</span><strong>${money(verification.advertisedExpectedCost)}</strong></div>
        <div class="metric"><span>金额偏差</span><strong class="${metricClass(verification)}">${Number.isFinite(verification.differenceRate) ? `${verification.difference >= 0 ? '+' : '-'}${money(Math.abs(verification.difference))} / ${(Math.abs(verification.differenceRate) * 100).toFixed(2)}%` : '待核验'}</strong></div>
        <div class="metric"><span>实测 / 标称倍率</span><strong class="${metricClass(verification)}">${Number.isFinite(verification.effectiveMultiplier) ? `${verification.effectiveMultiplier.toFixed(4)}x` : '待核验'} / ${verification.advertisedMultiplier.toFixed(4)}x</strong></div>
      </div>
      <div class="usage-list">
        <div><span>总输入 Token</span><b>${totalInputTokens.toLocaleString()}</b></div><div><span>输出 Token</span><b>${usage.outputTokens.toLocaleString()}</b></div><div><span>缓存读取占比</span><b>${usage.cacheReadMetricsReported ? `${cacheReadShare.toFixed(2)}%` : '未返回'}</b></div><div><span>平均输入 / 次</span><b>${Math.round(averageInput).toLocaleString()}</b></div>
      </div>
      ${scenarioAnalysisTemplate(provider)}
    </div>
  </article>`
}

function renderResults() {
  latestVerification = {
    generatedAt: new Date().toISOString(),
    providers: latestBenchmark.providers.map((provider) => verifyProvider(
      provider,
      reportedCharges.get(provider.id),
      reportedMultipliers.get(provider.id) ?? 1
    ))
  }
  document.getElementById('results-section').hidden = false
  document.getElementById('test-id').textContent = `测试 ID ${latestBenchmark.testId}`
  document.getElementById('manifest-hash').textContent = `Manifest ${latestBenchmark.manifestSha256}`
  const allChargesReported = latestBenchmark.providers.every((provider) => reportedCharges.has(provider.id))
  document.getElementById('result-notice').textContent = latestBenchmark.readyForBalanceVerification
    ? allChargesReported
      ? '核验完成：结论已根据实际消费与按倍率应扣金额生成。'
      : '测试请求已完成：填写实际消费；倍率默认 1，可自行修改。'
    : '部分请求失败：请展开技术证据查看失败记录。'
  document.getElementById('result-notice').classList.toggle('error', !latestBenchmark.readyForBalanceVerification)
  setWorkflowStep(latestBenchmark.readyForBalanceVerification ? (allChargesReported ? 4 : 3) : 2)
  const resultsGrid = document.getElementById('results-grid')
  resultsGrid.classList.toggle('single-mode', latestBenchmark.providers.length === 1)
  resultsGrid.innerHTML = latestBenchmark.providers.map((provider, index) =>
    resultTemplate(provider, latestVerification.providers[index], providerDefaults[index].color)
  ).join('')
  document.getElementById('calls-body').innerHTML = latestBenchmark.rounds.flatMap((round) => round.calls.map((call) => {
    const usage = call.usage ?? null
    const status = call.status === 'success' ? '成功' : `失败：${call.error}`
    return `<tr><td>${escapeHtml(round.scenarioName)}</td><td>${round.step}</td><td class="hash" title="${round.semanticRequestSha256}">${round.semanticRequestSha256}</td><td>${escapeHtml(call.providerName)}</td><td>${escapeHtml(status)}</td><td>${escapeHtml(call.requestId || '-')}</td><td>${usage?.inputTokens ?? '-'}</td><td>${usage?.cachedInputTokens ?? '-'}</td><td>${usage?.cacheCreationTokens ?? '-'}</td><td>${usage?.outputTokens ?? '-'}</td></tr>`
  })).join('')
  function applyVerification(providerId) {
    const chargeInput = document.querySelector(`[data-provider-charge="${providerId}"]`)
    const multiplierInput = document.querySelector(`[data-provider-multiplier="${providerId}"]`)
    const charge = chargeInput.value === '' ? null : Number(chargeInput.value)
    const multiplier = Number(multiplierInput.value)
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      showToast('请输入有效倍率')
      multiplierInput.focus()
      return
    }
    if (Number.isFinite(charge) && charge >= 0) reportedCharges.set(providerId, charge)
    else reportedCharges.delete(providerId)
    reportedMultipliers.set(providerId, multiplier)
    renderResults()
  }
  document.querySelectorAll('[data-calculate-charge]').forEach((button) => button.addEventListener('click', () => {
    applyVerification(button.dataset.calculateCharge)
  }))
  document.querySelectorAll('[data-provider-charge], [data-provider-multiplier]').forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      applyVerification(input.dataset.providerCharge ?? input.dataset.providerMultiplier)
    }
  }))
  window.lucide.createIcons()
}

function evidencePackage() {
  return {
    version: 'relay-billing-verifier-evidence-v2',
    generatedAt: new Date().toISOString(),
    declaration: {
      chargeSource: '客户输入的实际消费明细数值',
      multiplierSource: '默认 1，客户可自行调整',
      apiKeysIncluded: false,
      fixtureContentIncluded: false,
      automaticRetries: false
    },
    benchmark: latestBenchmark,
    verification: latestVerification
  }
}

function verificationSummary() {
  const pricingSource = latestBenchmark.manifest.pricingSource
  const pricingSourceText = pricingSource.mode === 'manual'
    ? '用户手工设置'
    : `${pricingSource.mode === 'remote' ? 'GitHub 已校验远程价格' : '项目内置价格快照'}（SHA-256 ${pricingSource.sha256}）`
  const lines = [
    'RelayAudit 计费核验摘要',
    `测试 ID：${latestBenchmark.testId}`,
    `Manifest SHA-256：${latestBenchmark.manifestSha256}`,
    `固定语料 SHA-256：${latestBenchmark.manifest.fixture.sha256}`,
    `测试语料：${latestBenchmark.manifest.fixture.source === 'custom' ? '自定义' : '内置'}，${latestBenchmark.manifest.fixture.lineCount} 行，${latestBenchmark.manifest.fixture.characterCount} 字符`,
    `价格来源：${pricingSourceText}`,
    `测试轮数：${latestBenchmark.manifest.settings.rounds}`,
    ''
  ]
  latestVerification.providers.forEach((item) => {
    const provider = latestBenchmark.providers.find((entry) => entry.id === item.id)
    lines.push(
      `${item.name}：`,
      `接口：${provider.endpoint}`,
      `模型：${provider.model}`,
      `请求：${provider.successfulCalls}/${provider.requestedCalls} 成功`,
      `标称基础费用：${money(item.standardCost)}`,
      `实际消费：${money(item.actualDeduction)}`,
      `实测倍率：${Number.isFinite(item.effectiveMultiplier) ? `${item.effectiveMultiplier.toFixed(4)}x` : '待填写平台账单金额'}`,
      `标称倍率：${item.advertisedMultiplier.toFixed(4)}x`,
      `缓存读取占比：${provider.usage.cacheReadMetricsReported ? `${((provider.usage.cachedInputTokens / Math.max(provider.usage.inputTokens + provider.usage.cachedInputTokens + provider.usage.cacheCreationTokens, 1)) * 100).toFixed(2)}%` : '上游未返回'}`,
      `结论：${item.verdict}`,
      ''
    )
    provider.scenarios.forEach((scenario) => {
      lines.push(
        `- ${scenario.name}：${scenario.successfulCalls}/${scenario.requestedCalls} 成功，输入 ${scenario.usage.inputTokens + scenario.usage.cachedInputTokens + scenario.usage.cacheCreationTokens}，输出 ${scenario.usage.outputTokens}，标称基础费用 ${money(scenario.costs.standardCost)}`
      )
    })
    lines.push('')
  })
  lines.push('说明：摘要不包含 API Key。')
  return lines.join('\n')
}

function showToast(message) {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200)
}

function updateRunSummary() {
  const rounds = Math.min(Math.max(numberValue('rounds') || 3, 1), 20)
  const providerCount = providerMode === 'single' ? 1 : 2
  const scenarioCount = document.getElementById('test-suite').value === 'professional' ? 3 : 1
  const totalRequests = rounds * providerCount * scenarioCount
  document.querySelector('#run-summary strong').textContent = scenarioCount === 3
    ? `准备执行 3 个维度，共 ${totalRequests} 次请求`
    : `准备执行单轮稳定性，共 ${totalRequests} 次请求`
}

function setWorkflowStep(currentStep) {
  document.querySelectorAll('[data-workflow-step]').forEach((element) => {
    const step = Number(element.dataset.workflowStep)
    element.classList.toggle('active', step === currentStep)
    element.classList.toggle('completed', step < currentStep)
  })
}

function setProviderMode(mode) {
  const nextMode = mode === 'compare' ? 'compare' : 'single'
  const changed = providerMode !== nextMode
  providerMode = nextMode
  document.querySelectorAll('[data-provider-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.providerMode === providerMode))
  })
  const panelB = document.querySelectorAll('.provider-panel')[1]
  const single = providerMode === 'single'
  panelB.hidden = single
  panelB.querySelectorAll('input, textarea, button').forEach((element) => {
    element.disabled = single
  })
  document.getElementById('providers-grid').classList.toggle('single-mode', single)
  if (changed && latestBenchmark) {
    latestBenchmark = null
    latestVerification = null
    document.getElementById('results-section').hidden = true
  }
  if (changed) {
    reportedCharges.clear()
    reportedMultipliers.clear()
    setWorkflowStep(1)
  }
  updateRunSummary()
}

function applySelectedModelPricing(presetId) {
  const preset = MODEL_PRESETS[presetId]
  if (!preset) {
    document.getElementById('pricing-details').open = true
    document.querySelectorAll('.provider-options').forEach((details) => { details.open = true })
    return
  }
  document.getElementById('canonical-model').value = preset.model
  for (const provider of providerDefaults) document.getElementById(`${provider.id}-model`).value = preset.model
  if (!Number.isFinite(preset.input)) return
  document.getElementById('price-input').value = preset.input
  document.getElementById('price-cached').value = preset.cached
  document.getElementById('price-cache-create').value = preset.cacheCreate
  document.getElementById('price-output').value = preset.output
}

async function syncModelPricing() {
  const status = document.getElementById('pricing-source-status')
  try {
    const catalog = await loadModelPricing()
    applyPricingCatalog(catalog)
    applySelectedModelPricing(document.getElementById('pricing-preset').value)
    const revision = catalog.source.sha256?.slice(0, 8) ?? '未知版本'
    status.textContent = catalog.source.mode === 'remote'
      ? `价格已同步 · ${revision}`
      : `价格快照可用 · ${revision} · 正在检查更新`
    status.title = `价格来源：${catalog.source.repository}`
    status.dataset.state = catalog.source.mode
    document.getElementById('run-button').disabled = false

    if (catalog.source.mode === 'snapshot') {
      const refreshed = await loadModelPricing({ refresh: true })
      applyPricingCatalog(refreshed)
      applySelectedModelPricing(document.getElementById('pricing-preset').value)
      const refreshedRevision = refreshed.source.sha256?.slice(0, 8) ?? '未知版本'
      status.textContent = refreshed.source.mode === 'remote'
        ? `价格已同步 · ${refreshedRevision}`
        : `使用内置价格快照 · ${refreshedRevision}`
      status.title = `价格来源：${refreshed.source.repository}`
      status.dataset.state = refreshed.source.mode
    }
  } catch {
    if (!document.getElementById('run-button').disabled) {
      status.textContent = '远程更新失败 · 继续使用价格快照'
      status.title = '远程价格不可用，当前测试仍可正常使用已校验快照'
      status.dataset.state = 'snapshot'
    } else {
      status.textContent = '价格加载失败'
      status.title = '本机服务未能读取远程价格或内置快照'
      status.dataset.state = 'error'
    }
  }
}

document.getElementById('providers-grid').innerHTML = providerDefaults.map(providerTemplate).join('')
window.lucide.createIcons()
setProviderMode('single')
setWorkflowStep(1)
void syncModelPricing()

document.querySelectorAll('[data-provider-mode]').forEach((button) => button.addEventListener('click', () => {
  setProviderMode(button.dataset.providerMode)
}))

document.getElementById('pricing-preset').addEventListener('change', (event) => {
  applySelectedModelPricing(event.target.value)
})

document.querySelectorAll('[data-import-provider]').forEach((button) => button.addEventListener('click', () => {
  const providerId = button.dataset.importProvider
  const source = document.getElementById(`${providerId}-import`)
  try {
    const parsed = parseProviderConfig(source.value)
    if (parsed.baseUrl) document.getElementById(`${providerId}-url`).value = parsed.baseUrl
    if (parsed.apiKey) document.getElementById(`${providerId}-key`).value = parsed.apiKey
    if (parsed.model) document.getElementById(`${providerId}-model`).value = parsed.model
    source.value = ''
    button.closest('details').open = false
    const count = [parsed.baseUrl, parsed.apiKey, parsed.model].filter(Boolean).length
    showToast(`已识别并填入 ${count} 项配置`)
  } catch (error) {
    showToast(error.message)
  }
}))

document.querySelectorAll('.key-toggle').forEach((button) => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.keyTarget)
  input.type = input.type === 'password' ? 'text' : 'password'
  button.innerHTML = `<i data-lucide="${input.type === 'password' ? 'eye' : 'eye-off'}"></i>`
  window.lucide.createIcons()
}))

document.getElementById('rounds').addEventListener('input', updateRunSummary)
document.getElementById('test-suite').addEventListener('change', updateRunSummary)

document.getElementById('benchmark-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = document.getElementById('run-button')
  button.disabled = true
  setWorkflowStep(2)
  progressView.prepare()
  button.innerHTML = '<i data-lucide="loader-circle"></i><span>正在执行固定批次…</span>'
  window.lucide.createIcons()
  try {
    reportedCharges.clear()
    reportedMultipliers.clear()
    latestBenchmark = await runBenchmark(formPayload(), { onProgress: progressView.handle })
    progressView.complete()
    renderResults()
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch (error) {
    setWorkflowStep(1)
    progressView.fail(error.message)
    showToast(error.message)
  } finally {
    button.disabled = false
    button.innerHTML = '<i data-lucide="play"></i><span>运行计费测试</span>'
    window.lucide.createIcons()
  }
})

document.getElementById('export-json').addEventListener('click', () => {
  downloadFile(`billing-evidence-${latestBenchmark.testId}.json`, JSON.stringify(evidencePackage(), null, 2), 'application/json')
})
document.getElementById('copy-summary').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(verificationSummary())
    showToast('脱敏核验摘要已复制')
  } catch {
    showToast('浏览器未允许写入剪贴板，请导出 JSON 证据')
  }
})
document.getElementById('export-html').addEventListener('click', () => {
  downloadFile(`billing-report-${latestBenchmark.testId}.html`, buildHtmlReport(evidencePackage()), 'text/html')
})
document.getElementById('print-report').addEventListener('click', () => window.print())
