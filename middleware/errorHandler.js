// Middleware de gestion d'erreurs centralisé

const errorHandler = (err, req, res, _next) => {
  console.error(`Error ${req.method} ${req.path}:`, err);

  // Erreur Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Données en conflit',
      message: 'Un enregistrement avec ces données existe déjà',
    });
  }

  // Erreur Prisma - Enregistrement non trouvé
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Ressource non trouvée',
      message: 'L\'enregistrement demandé n\'existe pas',
    });
  }

  // Erreur de validation Prisma
  if (err.code && err.code.startsWith('P2')) {
    return res.status(400).json({
      error: 'Erreur de base de données',
      message: 'Les données fournies sont invalides',
    });
  }

  // Erreur JSON malformé
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON invalide',
      message: 'Le format des données envoyées est incorrect',
    });
  }

  // Erreur de taille de payload trop importante
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload trop volumineux',
      message: 'Les données envoyées sont trop importantes',
    });
  }

  // Erreurs de production vs développement
  if (process.env.NODE_ENV === 'production') {
    // En production, ne pas exposer les détails des erreurs
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      message: 'Une erreur inattendue s\'est produite',
    });
  } else {
    // En développement, afficher plus de détails
    return res.status(500).json({
      error: 'Erreur interne du serveur',
      message: err.message,
      stack: err.stack,
    });
  }
};

// Middleware pour routes non trouvées
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.method} ${req.path} n'existe pas`,
  });
};

// Middleware pour logger les requêtes
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log de la requête entrante
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);

  // Intercepter la réponse pour logger le temps de traitement
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    return originalSend.call(this, body);
  };

  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger,
};
