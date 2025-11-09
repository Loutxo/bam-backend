const express = require('express');
const cors = require('cors');

// Charger .env.local en priorité
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test de Supabase
const testSupabase = async () => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Variables Supabase manquantes');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Test simple
    const { data, error } = await supabase
      .from('Badge')
      .select('count', { count: 'exact', head: true });

    if (error) throw error;

    console.log('✅ Supabase connecté - Badges disponibles');
    return true;
  } catch (error) {
    console.error('❌ Erreur Supabase:', error.message);
    return false;
  }
};

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    message: '🚀 BAM API - Bouteille À la Mer',
    version: '1.0.0',
    status: 'Production',
    endpoints: {
      health: '/health',
      supabase_test: '/api/test/supabase',
      badges: '/api/badges'
    },
    documentation: 'https://github.com/Loutxo/bam-backend'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    supabase: process.env.SUPABASE_URL ? 'Configuré' : 'Non configuré'
  });
});

// Test Supabase endpoint
app.get('/api/test/supabase', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error, count } = await supabase
      .from('Badge')
      .select('*', { count: 'exact' });

    if (error) throw error;

    res.json({
      status: 'Supabase OK',
      badges_count: count,
      badges: data,
      project: process.env.SUPABASE_URL.match(/([^.]+)\.supabase\.co/)?.[1] || 'unknown'
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      supabase_url: process.env.SUPABASE_URL || 'Non défini'
    });
  }
});

// API Badges
app.get('/api/badges', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('Badge')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`🔗 Supabase: ${process.env.SUPABASE_URL || 'Non configuré'}`);
  
  // Test initial
  const supabaseOk = await testSupabase();
  if (supabaseOk) {
    console.log(`\n✨ API prête ! Test: http://localhost:${PORT}/api/test/supabase`);
  }
});