// Edge Function Supabase pour notifications push
// Déployer avec: supabase functions deploy send-push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, title, body, data } = await req.json()

    // Initialiser Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer les tokens push de l'utilisateur
    const { data: userTokens, error: tokenError } = await supabaseClient
      .from('UserPushToken')
      .select('token, platform')
      .eq('userId', userId)
      .eq('active', true)

    if (tokenError) {
      throw new Error(`Erreur récupération tokens: ${tokenError.message}`)
    }

    if (!userTokens || userTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Aucun token push trouvé' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      )
    }

    // Envoyer les notifications
    const results = []
    
    for (const userToken of userTokens) {
      try {
        // FCM pour Android/Web
        if (userToken.platform === 'android' || userToken.platform === 'web') {
          const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              to: userToken.token,
              notification: {
                title,
                body,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/badge-72x72.png',
                click_action: data?.url || '/'
              },
              data: data || {}
            })
          })

          const fcmResult = await fcmResponse.json()
          results.push({
            platform: userToken.platform,
            success: fcmResponse.ok,
            result: fcmResult
          })
        }
        
        // APNs pour iOS
        else if (userToken.platform === 'ios') {
          const apnsResponse = await fetch(`https://api.push.apple.com/3/device/${userToken.token}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('APNS_JWT_TOKEN')}`,
              'Content-Type': 'application/json',
              'apns-topic': Deno.env.get('APNS_BUNDLE_ID'),
              'apns-priority': '10'
            },
            body: JSON.stringify({
              aps: {
                alert: {
                  title,
                  body
                },
                badge: 1,
                sound: 'default',
                'content-available': 1
              },
              data: data || {}
            })
          })

          results.push({
            platform: userToken.platform,
            success: apnsResponse.ok,
            result: apnsResponse.status
          })
        }
      } catch (error) {
        results.push({
          platform: userToken.platform,
          success: false,
          error: error.message
        })
      }
    }

    // Enregistrer la notification en base
    const { error: saveError } = await supabaseClient
      .from('Notification')
      .insert({
        userId,
        title,
        body,
        data,
        sentAt: new Date().toISOString(),
        results
      })

    if (saveError) {
      console.error('Erreur sauvegarde notification:', saveError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${results.filter(r => r.success).length} notifications envoyées`,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})