export const MODEL_PRESETS = {
  sol: { model: 'gpt-5.6-sol' },
  terra: { model: 'gpt-5.6-terra' },
  luna: { model: 'gpt-5.6-luna' }
}

export function applyPricingCatalog(catalog) {
  for (const preset of Object.values(MODEL_PRESETS)) {
    const remote = catalog?.models?.[preset.model]
    if (!remote) throw new Error(`同步价格缺少 ${preset.model}`)
    Object.assign(preset, {
      input: remote.input,
      cached: remote.cached,
      cacheCreate: remote.cacheCreate,
      output: remote.output
    })
  }
}
