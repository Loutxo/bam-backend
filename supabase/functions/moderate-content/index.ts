// Edge Function Supabase pour modération de contenu IA
// Déployer avec: supabase functions deploy moderate-content

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ModerationRequest {
  content: string
  type: 'text' | 'image' | 'audio'
}

interface ModerationResult {
  approved: boolean
  confidence: number
  categories: string[]
  suggestions?: string[]
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { content, type }: ModerationRequest = await req.json()

    if (!content || !type) {
      return new Response(
        JSON.stringify({ error: 'Content et type requis' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    let result: ModerationResult = {
      approved: true,
      confidence: 0.95,
      categories: [],
      suggestions: []
    }

    // Modération par mots-clés (base)
    const bannedWords = [
      'spam', 'fake', 'arnaque', 'scam', 'harcèlement',
      'discrimination', 'violence', 'haine', 'injure'
    ]

    const contentLower = content.toLowerCase()
    const foundBannedWords = bannedWords.filter(word => 
      contentLower.includes(word)
    )

    if (foundBannedWords.length > 0) {
      result = {
        approved: false,
        confidence: 0.9,
        categories: ['inappropriate_language'],
        suggestions: [
          'Évitez les termes inappropriés',
          'Reformulez votre message de manière constructive'
        ]
      }
    }

    // Modération avancée avec OpenAI (si configuré)
    if (Deno.env.get('OPENAI_API_KEY') && type === 'text') {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/moderations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: content
          })
        })

        const moderation = await openaiResponse.json()
        
        if (moderation.results?.[0]) {
          const moderationResult = moderation.results[0]
          
          if (moderationResult.flagged) {
            const flaggedCategories = Object.entries(moderationResult.categories)
              .filter(([_, flagged]) => flagged)
              .map(([category, _]) => category)

            result = {
              approved: false,
              confidence: Math.max(...Object.values(moderationResult.category_scores) as number[]),
              categories: flaggedCategories,
              suggestions: [
                'Ce contenu ne respecte pas nos conditions d\'utilisation',
                'Veuillez modifier votre message'
              ]
            }
          }
        }
      } catch (openaiError) {
        console.error('Erreur OpenAI:', openaiError)
        // Continue avec la modération de base
      }
    }

    // Vérifications spécifiques pour BAM
    if (type === 'text') {
      // Vérifier la longueur minimale
      if (content.trim().length < 10) {
        result = {
          approved: false,
          confidence: 0.8,
          categories: ['too_short'],
          suggestions: [
            'Votre signalement doit contenir au moins 10 caractères',
            'Ajoutez plus de détails pour aider la communauté'
          ]
        }
      }

      // Vérifier si c'est potentiellement du spam
      const repeatedChars = /(.)\1{4,}/.test(content)
      const allCaps = content.length > 20 && content === content.toUpperCase()
      
      if (repeatedChars || allCaps) {
        result = {
          approved: false,
          confidence: 0.7,
          categories: ['spam_like'],
          suggestions: [
            'Évitez les répétitions excessives',
            'N\'utilisez pas uniquement des majuscules'
          ]
        }
      }
    }

    // Enregistrer le résultat de modération
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('ModerationLog')
      .insert({
        content: content.substring(0, 500), // Limiter la taille stockée
        type,
        result: result.approved,
        confidence: result.confidence,
        categories: result.categories,
        moderatedAt: new Date().toISOString()
      })

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Erreur modération:', error)
    
    return new Response(
      JSON.stringify({
        approved: true, // Fallback: approuver si erreur
        confidence: 0.5,
        categories: ['error'],
        error: 'Erreur de modération, contenu approuvé par défaut'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})