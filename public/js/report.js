function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function money(value) {
  return Number.isFinite(value) ? value.toFixed(6) : '待填写'
}

function pricingSourceText(source) {
  if (source?.mode === 'manual') return '用户手工设置'
  const label = source?.mode === 'remote' ? 'GitHub 已校验远程价格' : '项目内置价格快照'
  return `${label} · SHA-256 ${source?.sha256 ?? '未知'}`
}

export function buildHtmlReport(evidencePackage) {
  const { benchmark, verification, generatedAt } = evidencePackage
  const fixture = benchmark.manifest.fixture
  const fixtureSource = fixture.source === 'custom' ? '自定义语料' : '内置语料'
  const providerSections = verification.providers.map((item) => {
    const provider = benchmark.providers.find((entry) => entry.id === item.id)
    const scenarioRows = provider.scenarios.map((scenario) => `
      <tr><td>${escapeHtml(scenario.name)}</td><td>${scenario.successfulCalls}/${scenario.requestedCalls}</td><td>${scenario.usage.inputTokens + scenario.usage.cachedInputTokens + scenario.usage.cacheCreationTokens}</td><td>${scenario.usage.outputTokens}</td><td>${Number.isFinite(scenario.cacheReadShare) ? `${(scenario.cacheReadShare * 100).toFixed(2)}%` : '未返回'}</td><td>${money(scenario.costs.standardCost)}</td><td>${scenario.id === 'multi_turn' ? `${scenario.inputGrowthTokens >= 0 ? '+' : ''}${scenario.inputGrowthTokens}` : '-'}</td></tr>`).join('')
    return `
      <section>
        <h2>${escapeHtml(item.name)}</h2>
        <p class="verdict"><strong>${escapeHtml(item.conclusion)}</strong><br>${escapeHtml(item.verdict)}</p>
        <div class="facts">
          <div><span>平台账单金额</span><b>${money(item.actualDeduction)}</b></div>
          <div><span>标称应扣金额</span><b>${money(item.advertisedExpectedCost)}</b></div>
          <div><span>相对偏差</span><b>${Number.isFinite(item.differenceRate) ? `${money(Math.abs(item.difference))} / ${(Math.abs(item.differenceRate) * 100).toFixed(2)}%` : '待核验'}</b></div>
          <div><span>实测 / 标称倍率</span><b>${Number.isFinite(item.effectiveMultiplier) ? `${item.effectiveMultiplier.toFixed(4)}x` : '待核验'} / ${item.advertisedMultiplier.toFixed(4)}x</b></div>
        </div>
        <table><tbody>
          <tr><th>接口</th><td>${escapeHtml(provider.endpoint)}</td></tr>
          <tr><th>模型</th><td>${escapeHtml(provider.model)}</td></tr>
          <tr><th>成功请求</th><td>${provider.successfulCalls} / ${provider.requestedCalls}</td></tr>
          <tr><th>标称基础费用</th><td>${money(item.standardCost)}</td></tr>
          <tr><th>普通输入</th><td>${provider.usage.inputTokens}</td></tr>
          <tr><th>缓存读取</th><td>${provider.usage.cachedInputTokens}</td></tr>
          <tr><th>缓存创建</th><td>${provider.usage.cacheCreationTokens}</td></tr>
          <tr><th>输出</th><td>${provider.usage.outputTokens}</td></tr>
          <tr><th>缓存读取占比</th><td>${provider.usage.cacheReadMetricsReported ? `${((provider.usage.cachedInputTokens / Math.max(provider.usage.inputTokens + provider.usage.cachedInputTokens + provider.usage.cacheCreationTokens, 1)) * 100).toFixed(2)}%` : '上游未返回'}</td></tr>
        </tbody></table>
        <h3>分维度结果</h3>
        <table><thead><tr><th>测试维度</th><th>请求</th><th>输入</th><th>输出</th><th>缓存读取占比</th><th>标称基础费用</th><th>输入增长</th></tr></thead><tbody>${scenarioRows}</tbody></table>
      </section>`
  }).join('')

  const rows = benchmark.rounds.flatMap((round) => round.calls.map((call) => `
    <tr><td>${escapeHtml(round.scenarioName)}</td><td>${round.step}</td><td class="mono">${escapeHtml(round.semanticRequestSha256)}</td><td>${escapeHtml(call.providerName)}</td><td>${escapeHtml(call.status)}</td><td>${escapeHtml(call.requestId || '-')}</td></tr>`)).join('')

  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中转站扣费核验报告</title><style>
    *{box-sizing:border-box}body{margin:0;color:#18211d;font:14px/1.55 system-ui,-apple-system,sans-serif;background:#eef1ef}header,main{width:min(1080px,calc(100% - 32px));margin:auto}header{padding:32px 0 18px;border-bottom:3px solid #dca33a}h1{margin:0 0 5px;font-size:26px}h2{margin:0 0 14px;font-size:18px}p{margin:0;color:#65716b}section{margin:20px 0;padding:20px;border:1px solid #d9dfdc;background:white;border-radius:6px}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.facts div{padding:10px;background:#f4f6f5;border-left:2px solid #146c43}.facts span,.facts b{display:block}.facts span{color:#64706a;font-size:11px}.facts b{font-size:18px}.verdict{margin:14px 0;padding:10px;border:1px solid #d9dfdc}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{padding:8px;text-align:left;border-bottom:1px solid #e5e9e7}.mono{font-family:monospace;overflow-wrap:anywhere}@media(max-width:650px){.facts{grid-template-columns:1fr 1fr}}@media print{body{background:white}header,main{width:100%}section{break-inside:avoid}}
  </style></head><body><header><h1>RelayAudit 计费核验报告</h1><p>生成时间：${escapeHtml(generatedAt)} · 测试 ID：${escapeHtml(benchmark.testId)}</p><p>测试语料：${fixtureSource} · ${fixture.lineCount} 行 · ${fixture.characterCount} 字符 · SHA-256 ${escapeHtml(fixture.sha256)}</p><p>价格来源：${escapeHtml(pricingSourceText(benchmark.manifest.pricingSource))}</p><p>Manifest SHA-256：${escapeHtml(benchmark.manifestSha256)}</p></header><main>${providerSections}<section><h2>请求一致性记录</h2><table><thead><tr><th>测试维度</th><th>步骤</th><th>语义请求 SHA-256</th><th>平台</th><th>状态</th><th>Request ID</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`
}
