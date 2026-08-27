export const MODEL_PRESETS = {
  sol: { model: 'gpt-5.6-sol' },
  terra: { model: 'gpt-5.6-terra' },
  luna: { model: 'gpt-5.6-luna' },
  'claude-opus-4-8': { model: 'claude-opus-4-8' },
  'claude-sonnet-5': { model: 'claude-sonnet-5' },
  'claude-3-5-sonnet-20241022': { model: 'claude-3-5-sonnet-20241022' },
  'claude-3-5-haiku-20241022': { model: 'claude-3-5-haiku-20241022' },
  'claude-3-opus-20240229': { model: 'claude-3-opus-20240229' },
  'gemini-2.0-flash-exp': { model: 'gemini-2.0-flash-exp' },
  'gemini-1.5-pro': { model: 'gemini-1.5-pro' },
  'gemini-1.5-flash': { model: 'gemini-1.5-flash' },
  'gemini-1.5-flash-8b': { model: 'gemini-1.5-flash-8b' }
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
