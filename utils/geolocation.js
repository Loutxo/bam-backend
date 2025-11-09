/**
 * Utilitaires de géolocalisation pour BAM
 */

/**
 * Calcule la distance entre deux points GPS en utilisant la formule de Haversine
 * @param {number} lat1 - Latitude du premier point
 * @param {number} lon1 - Longitude du premier point
 * @param {number} lat2 - Latitude du second point
 * @param {number} lon2 - Longitude du second point
 * @returns {number} Distance en kilomètres
 */
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Rayon de la Terre en km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Valide les coordonnées GPS
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean} true si valides
 */
const isValidCoordinates = (latitude, longitude) => {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

/**
 * Calcule un bounding box autour d'un point pour optimiser les requêtes DB
 * @param {number} centerLat - Latitude du centre
 * @param {number} centerLon - Longitude du centre
 * @param {number} radiusKm - Rayon en kilomètres
 * @returns {Object} Bounding box {minLat, maxLat, minLon, maxLon}
 */
const getBoundingBox = (centerLat, centerLon, radiusKm) => {
  const latDelta = radiusKm / 111; // 1 degré ≈ 111 km
  const lonDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

  return {
    minLat: centerLat - latDelta,
    maxLat: centerLat + latDelta,
    minLon: centerLon - lonDelta,
    maxLon: centerLon + lonDelta,
  };
};

/**
 * Filtre les BAMs par distance réelle (après pré-filtrage avec bounding box)
 * @param {Array} bams - Liste des BAMs
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} maxDistanceKm
 * @returns {Array} BAMs filtrés avec distance ajoutée
 */
const filterBamsByDistance = (bams, centerLat, centerLon, maxDistanceKm) => {
  return bams
    .map(bam => ({
      ...bam,
      distance: getDistanceInKm(centerLat, centerLon, bam.latitude, bam.longitude),
    }))
    .filter(bam => bam.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance); // Tri par distance croissante
};

/**
 * Génère des coordonnées aléatoires dans un rayon donné (pour les tests)
 * @param {number} centerLat
 * @param {number} centerLon
 * @param {number} maxRadiusKm
 * @returns {Object} {latitude, longitude}
 */
const generateRandomCoordinatesInRadius = (centerLat, centerLon, maxRadiusKm) => {
  const angle = Math.random() * 2 * Math.PI;
  const radius = Math.random() * maxRadiusKm;

  const latOffset = (radius * Math.cos(angle)) / 111;
  const lonOffset = (radius * Math.sin(angle)) / (111 * Math.cos(centerLat * Math.PI / 180));

  return {
    latitude: centerLat + latOffset,
    longitude: centerLon + lonOffset,
  };
};

module.exports = {
  getDistanceInKm,
  isValidCoordinates,
  getBoundingBox,
  filterBamsByDistance,
  generateRandomCoordinatesInRadius,
};
