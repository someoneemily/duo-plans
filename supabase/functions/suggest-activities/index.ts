import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_SUGGESTIONS = [
  { name: 'Omakase dinner', category: 'Restaurant' },
  { name: 'Pottery class', category: 'Experience' },
]

async function callLLM(prompt: string): Promise<string> {
  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openrouter'
  const apiKey = Deno.env.get('LLM_API_KEY')!
  const model = Deno.env.get('LLM_MODEL')!

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
    return json.content?.[0]?.text ?? '[]'
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
  console.log('[suggest-activities] OpenRouter response:', JSON.stringify(json))
  if (json.error?.code === 429) throw new Error('rate_limited')
  return json.choices?.[0]?.message?.content ?? '[]'
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

  console.log('[suggest-activities] provider:', Deno.env.get('LLM_PROVIDER'), 'model:', Deno.env.get('LLM_MODEL'), 'key set:', !!Deno.env.get('LLM_API_KEY'))

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
  try {
    const raw = await callLLM(prompt)
    console.log('[suggest-activities] prompt:', prompt)
    console.log('[suggest-activities] raw LLM output:', raw)
    const text = raw.replace(/```(?:json)?\n?/g, '').trim()
    const parsed = JSON.parse(text)
    const filtered = filterExisting(Array.isArray(parsed) ? parsed : [])
    suggestions = filtered.length > 0 ? filtered : filterExisting(FALLBACK_SUGGESTIONS)
  } catch {
    console.log('[suggest-activities] using fallback suggestions')
    suggestions = filterExisting(FALLBACK_SUGGESTIONS)
  }

  return new Response(JSON.stringify({ suggestions }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
