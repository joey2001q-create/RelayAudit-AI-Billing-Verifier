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
    const totalInputTokens = provider.usage.inputTokens + provider.usage.cachedInputTokens + provider.usage.cacheCreationTokens
    const averageInput = provider.successfulCalls > 0 ? totalInputTokens / provider.successfulCalls : 0
    const cacheReadShare = provider.usage.cacheReadMetricsReported
      ? `${((provider.usage.cachedInputTokens / Math.max(totalInputTokens, 1)) * 100).toFixed(2)}%`
      : '上游未返回'
    const scenarioRows = provider.scenarios.map((scenario) => `
      <tr><td>${escapeHtml(scenario.name)}</td><td>${scenario.successfulCalls}/${scenario.requestedCalls}</td><td>${scenario.usage.inputTokens + scenario.usage.cachedInputTokens + scenario.usage.cacheCreationTokens}</td><td>${scenario.usage.outputTokens}</td><td>${Number.isFinite(scenario.cacheReadShare) ? `${(scenario.cacheReadShare * 100).toFixed(2)}%` : '未返回'}</td><td>${money(scenario.costs.standardCost)}</td><td>${scenario.id === 'multi_turn' ? `${scenario.inputGrowthTokens >= 0 ? '+' : ''}${scenario.inputGrowthTokens}` : '-'}</td></tr>`).join('')
    const billingVerification = Number.isFinite(item.actualDeduction)
      ? `<div class="billing"><h3>账单核验结论</h3><p class="verdict"><strong>${escapeHtml(item.conclusion)}</strong><br>${escapeHtml(item.verdict)}</p><div class="facts"><div><span>实际消费</span><b>${money(item.actualDeduction)}</b></div><div><span>标称应扣金额</span><b>${money(item.advertisedExpectedCost)}</b></div><div><span>金额偏差</span><b>${Number.isFinite(item.differenceRate) ? `${money(Math.abs(item.difference))} / ${(Math.abs(item.differenceRate) * 100).toFixed(2)}%` : '待核验'}</b></div><div><span>实测 / 标称倍率</span><b>${Number.isFinite(item.effectiveMultiplier) ? `${item.effectiveMultiplier.toFixed(4)}x` : '待核验'} / ${item.advertisedMultiplier.toFixed(4)}x</b></div></div></div>`
      : ''
    return `
      <section>
        <h2>${escapeHtml(item.name)}</h2>
        <div class="primary"><span>${provider.status === 'success' ? '请求已完成' : '请求未完整完成'}</span><small>标称应扣金额</small><b>${money(item.advertisedExpectedCost)}</b><em>${provider.status === 'success' ? `当前倍率 ${item.advertisedMultiplier.toFixed(4)}x` : '金额仅基于成功请求'}</em></div>
        <h3>分维度结果</h3>
        <table><thead><tr><th>测试维度</th><th>请求</th><th>输入</th><th>输出</th><th>缓存读取占比</th><th>标称基础费用</th><th>输入增长</th></tr></thead><tbody>${scenarioRows}</tbody></table>
        <h3>Token 汇总</h3>
        <div class="facts">
          <div><span>总输入 Token</span><b>${totalInputTokens}</b></div>
          <div><span>输出 Token</span><b>${provider.usage.outputTokens}</b></div>
          <div><span>缓存读取占比</span><b>${cacheReadShare}</b></div>
          <div><span>平均输入 / 次</span><b>${Math.round(averageInput)}</b></div>
        </div>
        ${billingVerification}
        <table><tbody>
          <tr><th>接口</th><td>${escapeHtml(provider.endpoint)}</td></tr>
          <tr><th>模型</th><td>${escapeHtml(provider.model)}</td></tr>
          <tr><th>成功请求</th><td>${provider.successfulCalls} / ${provider.requestedCalls}</td></tr>
          <tr><th>普通输入</th><td>${provider.usage.inputTokens}</td></tr>
          <tr><th>缓存读取</th><td>${provider.usage.cachedInputTokens}</td></tr>
          <tr><th>缓存创建</th><td>${provider.usage.cacheCreationTokens}</td></tr>
        </tbody></table>
      </section>`
  }).join('')

  const rows = benchmark.rounds.flatMap((round) => round.calls.map((call) => `
    <tr><td>${escapeHtml(round.scenarioName)}</td><td>${round.step}</td><td class="mono">${escapeHtml(round.semanticRequestSha256)}</td><td>${escapeHtml(call.providerName)}</td><td>${escapeHtml(call.status)}</td><td>${escapeHtml(call.requestId || '-')}</td></tr>`)).join('')

  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中转站扣费核验报告</title><style>
    *{box-sizing:border-box}body{margin:0;color:#18211d;font:14px/1.55 system-ui,-apple-system,sans-serif;background:#eef1ef}header,main{width:min(1080px,calc(100% - 32px));margin:auto}header{padding:32px 0 18px;border-bottom:3px solid #dca33a}h1{margin:0 0 5px;font-size:26px}h2{margin:0 0 14px;font-size:18px}h3{margin:20px 0 8px;font-size:14px}p{margin:0;color:#65716b}section{margin:20px 0;padding:20px;border:1px solid #d9dfdc;background:white;border-radius:6px}.primary{padding:20px;border-left:5px solid #146c43;background:#edf6f1}.primary span,.primary small,.primary b,.primary em{display:block}.primary span{font-size:18px;font-weight:800}.primary small{margin-top:12px;color:#0b4f30;font-weight:700}.primary b{margin:2px 0;font-size:34px}.primary em{color:#64706a;font-size:11px;font-style:normal}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.facts div{padding:10px;background:#f4f6f5;border-left:2px solid #146c43}.facts span,.facts b{display:block}.facts span{color:#64706a;font-size:11px}.facts b{font-size:18px}.billing{margin-top:20px;padding:16px;border-left:4px solid #146c43;background:#f8faf9}.billing h3{margin-top:0}.verdict{margin:12px 0;padding:10px;border:1px solid #d9dfdc}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{padding:8px;text-align:left;border-bottom:1px solid #e5e9e7}.mono{font-family:monospace;overflow-wrap:anywhere}@media(max-width:650px){.facts{grid-template-columns:1fr 1fr}}@media print{body{background:white}header,main{width:100%}section{break-inside:avoid}}
  </style></head><body><header><h1>RelayAudit 计费核验报告</h1><p>生成时间：${escapeHtml(generatedAt)} · 测试 ID：${escapeHtml(benchmark.testId)}</p><p>执行方式：${benchmark.manifest.executionMode === 'hosted_vercel' ? 'Vercel 托管版' : '本地独立运行'}</p><p>测试语料：${fixtureSource} · ${fixture.lineCount} 行 · ${fixture.characterCount} 字符 · SHA-256 ${escapeHtml(fixture.sha256)}</p><p>价格来源：${escapeHtml(pricingSourceText(benchmark.manifest.pricingSource))}</p><p>Manifest SHA-256：${escapeHtml(benchmark.manifestSha256)}</p></header><main>${providerSections}<section><h2>请求一致性记录</h2><table><thead><tr><th>测试维度</th><th>步骤</th><th>语义请求 SHA-256</th><th>平台</th><th>状态</th><th>Request ID</th></tr></thead><tbody>${rows}</tbody></table></section></main></body></html>`
}
