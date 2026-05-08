import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_POOL = [
  { name: 'Omakase dinner', category: 'Restaurant' },
  { name: 'Pottery class', category: 'Experience' },
  { name: 'Weekend in Ojai', category: 'Travel' },
  { name: 'Rooftop bar crawl', category: 'Experience' },
  { name: 'Farmers market brunch', category: 'Restaurant' },
  { name: 'Sunset hike', category: 'Experience' },
  { name: 'Natural wine tasting', category: 'Restaurant' },
  { name: 'Day trip to Santa Barbara', category: 'Travel' },
  { name: 'Cooking class', category: 'Experience' },
  { name: 'Night at a jazz club', category: 'Experience' },
]

function pickFallbacks(existingNames: Set<string>) {
  const available = FALLBACK_POOL.filter((s) => !existingNames.has(s.name.toLowerCase()))
  return available.sort(() => Math.random() - 0.5).slice(0, 3)
}

async function callLLM(prompt: string): Promise<{ text: string; rawResponse: unknown; error?: string }> {
  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openrouter'
  const apiKey = Deno.env.get('LLM_API_KEY')
  const model = Deno.env.get('LLM_MODEL')

  if (!apiKey) return { text: '[]', rawResponse: null, error: 'LLM_API_KEY is not set' }
  if (!model) return { text: '[]', rawResponse: null, error: 'LLM_MODEL is not set' }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const json = await res.json()
    const text = json.content?.[0]?.text ?? '[]'
    return { text, rawResponse: json }
  }

  // Default: OpenRouter (OpenAI-compatible)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const json = await res.json()
  if (json.error) {
    return { text: '[]', rawResponse: json, error: `openrouter error ${json.error.code ?? ''}: ${json.error.message ?? JSON.stringify(json.error)}` }
  }
  const text = json.choices?.[0]?.message?.content ?? '[]'
  return { text, rawResponse: json }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openrouter'
  const model = Deno.env.get('LLM_MODEL') ?? '(not set)'

  const { data: activities } = await supabase
    .from('activities')
    .select('name, category')
    .eq('user_id', user.id)
    .is('completed_at', null)

  const existing = (activities ?? []).map((a: { name: string; category: string }) => `${a.name} (${a.category})`).join(', ')

  const prompt = `A user has these activity plans: ${existing || 'none yet'}.
Suggest 3 new activities inspired by their taste but slightly more adventurous — a step up in experience, not just more of the same.
Rules:
- Activities must be safe, public, and social (things you'd do with friends)
- Do NOT repeat anything already in their list
- Lean into the vibe of what they already like but push it a little further
Reply with ONLY a JSON array: [{"name": "...", "category": "Restaurant"|"Experience"|"Travel"|"Other"}, ...]
No explanation, no markdown, just the JSON array.`

  const existingNames = new Set((activities ?? []).map((a: { name: string }) => a.name.toLowerCase()))
  const filterExisting = (list: { name: string; category: string }[]) =>
    list.filter((s) => !existingNames.has(s.name.toLowerCase()))

  let suggestions: { name: string; category: string }[]
  let usedFallback = false
  let llmResult: { text: string; rawResponse: unknown; error?: string } = { text: '[]', rawResponse: null }
  let parseError: string | null = null

  try {
    llmResult = await callLLM(prompt)
    console.log('[suggest-activities] provider:', provider, 'model:', model)
    console.log('[suggest-activities] raw:', llmResult.text)
    if (llmResult.error) throw new Error(llmResult.error)
    const cleaned = llmResult.text.replace(/```(?:json)?\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const filtered = filterExisting(Array.isArray(parsed) ? parsed : [])
    suggestions = filtered.length > 0 ? filtered : (() => { usedFallback = true; return pickFallbacks(existingNames) })()
  } catch (err) {
    parseError = String(err)
    console.log('[suggest-activities] error, using fallback:', parseError)
    usedFallback = true
    suggestions = pickFallbacks(existingNames)
  }

  return new Response(JSON.stringify({
    suggestions,
    _debug: {
      provider,
      model,
      existingActivities: existing || '(none)',
      prompt,
      rawResponse: llmResult.rawResponse,
      parsedText: llmResult.text,
      llmError: llmResult.error ?? null,
      parseError,
      usedFallback,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
