/**
 * Routes API pour le système de géolocalisation avancée
 * Géofencing, historique, zones favorites, notifications
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const advancedLocationService = require('../services/advancedLocationService');

const router = express.Router();

// Middleware de validation des erreurs
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }
  next();
};

// =============================================================================
// HISTORIQUE DES POSITIONS
// =============================================================================

/**
 * POST /api/location/record
 * Enregistrer une nouvelle position
 */
router.post('/record', [
  auth,
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Précision invalide'),
  body('address').optional().isString().trim().isLength({ max: 255 }),
  body('city').optional().isString().trim().isLength({ max: 100 }),
  body('country').optional().isString().trim().isLength({ max: 100 }),
  body('source').optional().isIn(['GPS', 'NETWORK', 'MANUAL']).withMessage('Source invalide'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { latitude, longitude, accuracy, address, city, country, source } = req.body;

    const location = await advancedLocationService.recordLocation(req.user.id, {
      latitude,
      longitude,
      accuracy,
      address,
      city,
      country,
      source
    });

    res.json({
      success: true,
      data: location,
      message: 'Position enregistrée avec succès'
    });
  } catch (error) {
    console.error('Erreur enregistrement position:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'enregistrement de la position'
    });
  }
});

/**
 * GET /api/location/history
 * Récupérer l'historique des positions
 */
router.get('/history', [
  auth,
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limite invalide'),
  query('startDate').optional().isISO8601().withMessage('Date de début invalide'),
  query('endDate').optional().isISO8601().withMessage('Date de fin invalide'),
  query('includeCity').optional().isBoolean().withMessage('includeCity doit être boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { limit, startDate, endDate, includeCity } = req.query;

    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (includeCity !== undefined) options.includeCity = includeCity === 'true';

    const history = await advancedLocationService.getUserLocationHistory(req.user.id, options);

    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Erreur récupération historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

/**
 * GET /api/location/current
 * Récupérer la dernière position connue
 */
router.get('/current', auth, async (req, res) => {
  try {
    const lastLocation = await advancedLocationService.getLastUserLocation(req.user.id);

    res.json({
      success: true,
      data: lastLocation
    });
  } catch (error) {
    console.error('Erreur récupération position actuelle:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la position actuelle'
    });
  }
});

/**
 * DELETE /api/location/history/cleanup
 * Nettoyer l'historique ancien
 */
router.delete('/history/cleanup', auth, async (req, res) => {
  try {
    const deletedCount = await advancedLocationService.cleanOldHistory();

    res.json({
      success: true,
      data: { deletedCount },
      message: `${deletedCount} positions anciennes supprimées`
    });
  } catch (error) {
    console.error('Erreur nettoyage historique:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du nettoyage de l\'historique'
    });
  }
});

// =============================================================================
// ZONES FAVORITES
// =============================================================================

/**
 * POST /api/location/zones
 * Créer une zone favorite
 */
router.post('/zones', [
  auth,
  body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Nom requis (1-100 caractères)'),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
  body('radius').optional().isFloat({ min: 10, max: 10000 }).withMessage('Rayon invalide (10-10000m)'),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i).withMessage('Couleur invalide (format #RRGGBB)'),
  body('notifyOnEnter').optional().isBoolean(),
  body('notifyOnExit').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const zone = await advancedLocationService.createFavoriteZone(req.user.id, req.body);

    res.status(201).json({
      success: true,
      data: zone,
      message: 'Zone favorite créée avec succès'
    });
  } catch (error) {
    console.error('Erreur création zone:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la zone'
    });
  }
});

/**
 * GET /api/location/zones
 * Récupérer les zones favorites
 */
router.get('/zones', auth, async (req, res) => {
  try {
    const zones = await advancedLocationService.getUserFavoriteZones(req.user.id);

    res.json({
      success: true,
      data: zones,
      count: zones.length
    });
  } catch (error) {
    console.error('Erreur récupération zones:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des zones'
    });
  }
});

/**
 * PUT /api/location/zones/:zoneId
 * Modifier une zone favorite
 */
router.put('/zones/:zoneId', [
  auth,
  param('zoneId').isString().withMessage('ID de zone invalide'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().trim().isLength({ max: 500 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('radius').optional().isFloat({ min: 10, max: 10000 }),
  body('color').optional().matches(/^#[0-9A-F]{6}$/i),
  body('notifyOnEnter').optional().isBoolean(),
  body('notifyOnExit').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { zoneId } = req.params;
    const updateData = req.body;

    const zone = await advancedLocationService.updateFavoriteZone(req.user.id, zoneId, updateData);

    res.json({
      success: true,
      data: zone,
      message: 'Zone modifiée avec succès'
    });
  } catch (error) {
    console.error('Erreur modification zone:', error);
    
    if (error.message.includes('introuvable') || error.message.includes('autorisé')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de la zone'
    });
  }
});

/**
 * DELETE /api/location/zones/:zoneId
 * Supprimer une zone favorite
 */
router.delete('/zones/:zoneId', [
  auth,
  param('zoneId').isString().withMessage('ID de zone invalide'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { zoneId } = req.params;

    await advancedLocationService.deleteFavoriteZone(req.user.id, zoneId);

    res.json({
      success: true,
      message: 'Zone supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur suppression zone:', error);
    
    if (error.message.includes('introuvable') || error.message.includes('autorisé')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la zone'
    });
  }
});

// =============================================================================
// ALERTES ET NOTIFICATIONS
// =============================================================================

/**
 * GET /api/location/alerts
 * Récupérer les alertes géofence
 */
router.get('/alerts', [
  auth,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite invalide'),
  query('unreadOnly').optional().isBoolean().withMessage('unreadOnly doit être boolean'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;

    const options = {};
    if (limit) options.limit = parseInt(limit);
    if (unreadOnly !== undefined) options.unreadOnly = unreadOnly === 'true';

    const alerts = await advancedLocationService.getUserAlerts(req.user.id, options);

    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Erreur récupération alertes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des alertes'
    });
  }
});

/**
 * PUT /api/location/alerts/read
 * Marquer des alertes comme lues
 */
router.put('/alerts/read', [
  auth,
  body('alertIds').isArray({ min: 1 }).withMessage('Liste d\'IDs d\'alertes requise'),
  body('alertIds.*').isString().withMessage('ID d\'alerte invalide'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { alertIds } = req.body;

    const result = await advancedLocationService.markAlertsAsRead(req.user.id, alertIds);

    res.json({
      success: true,
      data: { updatedCount: result.count },
      message: `${result.count} alertes marquées comme lues`
    });
  } catch (error) {
    console.error('Erreur marquage alertes lues:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage des alertes'
    });
  }
});

// =============================================================================
// STATISTIQUES
// =============================================================================

/**
 * GET /api/location/stats
 * Récupérer les statistiques de géolocalisation
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await advancedLocationService.getUserLocationStats(req.user.id);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// =============================================================================
// UTILS
// =============================================================================

/**
 * POST /api/location/distance
 * Calculer la distance entre deux points
 */
router.post('/distance', [
  auth,
  body('from.latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude de départ invalide'),
  body('from.longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude de départ invalide'),
  body('to.latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude d\'arrivée invalide'),
  body('to.longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude d\'arrivée invalide'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { from, to } = req.body;

    const distance = advancedLocationService.calculateDistance(
      from.latitude, from.longitude,
      to.latitude, to.longitude
    );

    res.json({
      success: true,
      data: {
        distance: Math.round(distance),
        unit: 'meters'
      }
    });
  } catch (error) {
    console.error('Erreur calcul distance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de la distance'
    });
  }
});

module.exports = router;