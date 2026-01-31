import OpenAI from 'openai'

// Singleton client
let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

export async function chat(
  systemPrompt: string,
  userMessage: string,
  options?: {
    maxTokens?: number
    temperature?: number
  }
): Promise<string> {
  const openai = getOpenAIClient()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: options?.maxTokens || 2048,
    temperature: options?.temperature || 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  })

  return response.choices[0]?.message?.content || ''
}

export async function chatWithJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options?: {
    maxTokens?: number
    temperature?: number
  }
): Promise<T> {
  const response = await chat(systemPrompt, userMessage, options)

  // Extract JSON from response
  const jsonMatch =
    response.match(/```json\n?([\s\S]*?)\n?```/) || response.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0]
  return JSON.parse(jsonStr) as T
}
