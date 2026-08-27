export const MODEL_PRESETS = {
  sol: { model: 'gpt-5.6-sol' },
  terra: { model: 'gpt-5.6-terra' },
  luna: { model: 'gpt-5.6-luna' },
  'claude-sonnet-5': { model: 'claude-sonnet-5' },
  'claude-opus-4-8': { model: 'claude-opus-4-8' },
  'claude-haiku-4-5': { model: 'claude-haiku-4-5' },
  'claude-3-opus-20240229': { model: 'claude-3-opus-20240229' },
  'claude-3-haiku-20240307': { model: 'claude-3-haiku-20240307' },
  'gemini-2.5-pro': { model: 'gemini-2.5-pro' },
  'gemini-2.5-flash': { model: 'gemini-2.5-flash' },
  'gemini-2.0-flash': { model: 'gemini-2.0-flash' }
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
