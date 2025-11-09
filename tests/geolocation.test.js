const { getDistanceInKm, isValidCoordinates, getBoundingBox, filterBamsByDistance } = require('../utils/geolocation');

describe('Geolocation Utils', () => {
  describe('getDistanceInKm', () => {
    test('should calculate correct distance between Paris and Lyon', () => {
      const parisLat = 48.8566;
      const parisLon = 2.3522;
      const lyonLat = 45.7640;
      const lyonLon = 4.8357;

      const distance = getDistanceInKm(parisLat, parisLon, lyonLat, lyonLon);

      // Distance approximative entre Paris et Lyon ≈ 392 km
      expect(distance).toBeCloseTo(392, -1); // Précision à 10 km près
    });

    test('should return 0 for same coordinates', () => {
      const distance = getDistanceInKm(48.8566, 2.3522, 48.8566, 2.3522);
      expect(distance).toBe(0);
    });
  });

  describe('isValidCoordinates', () => {
    test('should validate correct coordinates', () => {
      expect(isValidCoordinates(48.8566, 2.3522)).toBe(true);
      expect(isValidCoordinates(0, 0)).toBe(true);
      expect(isValidCoordinates(-90, -180)).toBe(true);
      expect(isValidCoordinates(90, 180)).toBe(true);
    });

    test('should reject invalid coordinates', () => {
      expect(isValidCoordinates(91, 0)).toBe(false);
      expect(isValidCoordinates(-91, 0)).toBe(false);
      expect(isValidCoordinates(0, 181)).toBe(false);
      expect(isValidCoordinates(0, -181)).toBe(false);
    });
  });

  describe('getBoundingBox', () => {
    test('should calculate bounding box correctly', () => {
      const centerLat = 48.8566;
      const centerLon = 2.3522;
      const radius = 10; // 10 km

      const bbox = getBoundingBox(centerLat, centerLon, radius);

      expect(bbox.minLat).toBeLessThan(centerLat);
      expect(bbox.maxLat).toBeGreaterThan(centerLat);
      expect(bbox.minLon).toBeLessThan(centerLon);
      expect(bbox.maxLon).toBeGreaterThan(centerLon);
    });
  });

  describe('filterBamsByDistance', () => {
    const mockBams = [
      { id: '1', latitude: 48.8566, longitude: 2.3522, text: 'BAM Paris' },
      { id: '2', latitude: 48.8606, longitude: 2.3376, text: 'BAM proche Paris' },
      { id: '3', latitude: 45.7640, longitude: 4.8357, text: 'BAM Lyon' },
    ];

    test('should filter BAMs by distance', () => {
      const centerLat = 48.8566;
      const centerLon = 2.3522;
      const maxDistance = 5; // 5 km

      const filtered = filterBamsByDistance(mockBams, centerLat, centerLon, maxDistance);

      expect(filtered).toHaveLength(2); // Paris et proche Paris
      expect(filtered[0].id).toBe('1'); // Le plus proche en premier
      expect(filtered.every(bam => bam.distance <= maxDistance)).toBe(true);
    });

    test('should add distance property to BAMs', () => {
      const filtered = filterBamsByDistance(mockBams, 48.8566, 2.3522, 1000);

      filtered.forEach(bam => {
        expect(bam).toHaveProperty('distance');
        expect(typeof bam.distance).toBe('number');
      });
    });
  });
});
