function money(value) {
  if (!Number.isFinite(value)) return '待填写'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

export function verifyProvider(provider, reportedCharge, advertisedMultiplier = 1) {
  const hasReportedCharge = Number.isFinite(reportedCharge) && reportedCharge >= 0
  const validMultiplier = Number.isFinite(advertisedMultiplier) && advertisedMultiplier > 0
  const actualDeduction = hasReportedCharge ? reportedCharge : null
  const multiplier = validMultiplier ? advertisedMultiplier : null
  const standardCost = provider.costs.standardCost
  const expected = validMultiplier ? standardCost * multiplier : null
  const effectiveMultiplier = hasReportedCharge && standardCost > 0 ? actualDeduction / standardCost : null
  const difference = hasReportedCharge && Number.isFinite(expected) ? actualDeduction - expected : null
  const differenceRate = Number.isFinite(difference) && expected > 0 ? difference / expected : null
  let conclusion = '等待账单金额'
  let conclusionTone = 'pending'
  let verdict = `请求已完成，标称应扣金额为 ${money(expected)}。`

  if (provider.status !== 'success') {
    conclusion = '请求未完整完成'
    conclusionTone = 'failed'
    verdict = '存在失败请求，本次数据不适合形成完整计费结论。'
  } else if (!validMultiplier) {
    conclusion = '标称倍率无效'
    conclusionTone = 'warning'
    verdict = '请输入有效倍率；平台没有特殊倍率时保持 1。'
  } else if (hasReportedCharge && standardCost === 0) {
    conclusion = '无法计算倍率'
    conclusionTone = 'warning'
    verdict = '上游 usage 未形成可计费金额。'
  } else if (hasReportedCharge) {
    const absoluteRate = Math.abs(differenceRate)
    if (absoluteRate <= 0.02) {
      conclusion = '与标称倍率一致'
      conclusionTone = 'passed'
    } else if (difference > 0) {
      conclusion = '高于标称倍率'
      conclusionTone = 'warning'
    } else {
      conclusion = '低于标称倍率'
      conclusionTone = 'warning'
    }
    verdict = `平台账单金额与标称应扣金额偏差 ${Math.abs(difference).toFixed(6)}（${(absoluteRate * 100).toFixed(2)}%）。`
  }

  return {
    id: provider.id,
    name: provider.name,
    reportedCharge: actualDeduction,
    actualDeduction,
    standardCost,
    advertisedMultiplier: multiplier,
    advertisedExpectedCost: expected,
    effectiveMultiplier,
    difference,
    differenceRate,
    conclusion,
    conclusionTone,
    verdict
  }
}
