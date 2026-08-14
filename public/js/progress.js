function setIcon(slot, name, running = false) {
  slot.classList.toggle('running', running)
  slot.innerHTML = `<i data-lucide="${name}"></i>`
  window.lucide.createIcons()
}

export function createProgressView() {
  const root = document.getElementById('run-progress')
  const icon = document.getElementById('progress-icon')
  const title = document.getElementById('progress-title')
  const current = document.getElementById('progress-current')
  const count = document.getElementById('progress-count')
  const bar = document.getElementById('progress-bar')
  const scenariosRoot = document.getElementById('progress-scenarios')
  const scenarios = new Map()
  let totalRequests = 0
  let completedRequests = 0

  const updateTotal = (completed, total) => {
    completedRequests = completed
    totalRequests = total
    count.textContent = `${completedRequests} / ${totalRequests}`
    bar.max = Math.max(totalRequests, 1)
    bar.value = completedRequests
  }

  const prepare = () => {
    root.hidden = false
    title.textContent = '正在准备测试'
    current.textContent = '正在生成固定请求批次'
    scenariosRoot.replaceChildren()
    scenarios.clear()
    updateTotal(0, 0)
    setIcon(icon, 'loader-circle', true)
  }

  const start = (event) => {
    title.textContent = '正在执行计费测试'
    current.textContent = '请求将按测试维度依次执行'
    updateTotal(event.completedRequests, event.totalRequests)
    for (const scenario of event.scenarios) {
      const row = document.createElement('div')
      row.className = 'progress-scenario'
      row.dataset.status = 'pending'
      const labels = document.createElement('div')
      const name = document.createElement('strong')
      const state = document.createElement('span')
      const amount = document.createElement('b')
      name.textContent = scenario.name
      state.textContent = '等待执行'
      amount.textContent = `0 / ${scenario.totalRequests}`
      labels.append(name, state)
      row.append(labels, amount)
      scenariosRoot.append(row)
      scenarios.set(scenario.id, { row, state, amount, completed: 0, total: scenario.totalRequests, failed: false })
    }
  }

  const requestStarted = (event) => {
    const scenario = scenarios.get(event.scenarioId)
    if (scenario) {
      scenario.row.dataset.status = 'running'
      scenario.state.textContent = `第 ${event.step} / ${event.totalSteps} 轮`
    }
    current.textContent = `${event.scenarioName} · 第 ${event.step} / ${event.totalSteps} 轮 · ${event.providerName}`
  }

  const requestCompleted = (event) => {
    const scenario = scenarios.get(event.scenarioId)
    if (scenario) {
      scenario.completed += 1
      scenario.failed ||= event.status !== 'success'
      scenario.amount.textContent = `${scenario.completed} / ${scenario.total}`
      if (scenario.completed === scenario.total) {
        scenario.row.dataset.status = scenario.failed ? 'failed' : 'completed'
        scenario.state.textContent = scenario.failed ? '含失败请求' : '已完成'
      }
    }
    updateTotal(event.completedRequests, event.totalRequests)
    current.textContent = event.status === 'success'
      ? `${event.providerName} · 本次请求成功`
      : `${event.providerName} · 本次请求失败，继续记录后续步骤`
  }

  const handle = (event) => {
    if (event.type === 'benchmark_started') start(event)
    if (event.type === 'request_started') requestStarted(event)
    if (event.type === 'request_completed') requestCompleted(event)
    if (event.type === 'benchmark_completed') {
      title.textContent = '请求执行完成'
      current.textContent = '正在汇总 Token 与计费结果'
    }
  }

  const complete = () => {
    title.textContent = '测试执行完成'
    current.textContent = '可以填写平台账单金额并查看结论'
    updateTotal(totalRequests, totalRequests)
    setIcon(icon, 'circle-check', false)
  }

  const fail = (message) => {
    root.hidden = false
    title.textContent = '测试未完成'
    current.textContent = message
    setIcon(icon, 'circle-x', false)
  }

  return { prepare, handle, complete, fail }
}
