const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Mock de Cloudinary
const mockCloudinary = {
  config: jest.fn(),
  uploader: {
    upload_stream: jest.fn(),
    destroy: jest.fn(),
  },
  api: {
    ping: jest.fn(),
    resource: jest.fn(),
  },
};

jest.mock('cloudinary', () => ({
  v2: mockCloudinary,
}));

// Mock de Sharp
const mockSharp = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
};

jest.mock('sharp', () => jest.fn(() => mockSharp));

// Import du service (singleton)
const service = require('../services/fileUploadService');

describe('FileUploadService', () => {  
  beforeEach(() => {
    // Reset des mocks
    jest.clearAllMocks();
    
    // Configuration des variables d'environnement de test
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    // Nettoyer les variables d'environnement
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  describe('validateFile', () => {
    it('should validate a correct image file', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 1024 * 1024, // 1MB
        originalname: 'test.jpg',
      };

      const result = service.validateFile(file, 'profile');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject file with invalid mime type', () => {
      const file = {
        mimetype: 'application/pdf',
        size: 1024 * 1024,
        originalname: 'document.pdf',
      };

      const result = service.validateFile(file, 'profile');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Type de fichier non autorisé')
      );
    });

    it('should reject file that is too large', () => {
      const file = {
        mimetype: 'image/jpeg',
        size: 15 * 1024 * 1024, // 15MB - trop gros
        originalname: 'huge-image.jpg',
      };

      const result = service.validateFile(file, 'profile');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('Fichier trop volumineux')
      );
    });

    it('should reject missing file', () => {
      const result = service.validateFile(null, 'profile');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Aucun fichier fourni');
    });

    it('should have different size limits for profile vs bam', () => {
      const largeFile = {
        mimetype: 'image/jpeg',
        size: 7 * 1024 * 1024, // 7MB
        originalname: 'large-image.jpg',
      };

      const profileResult = service.validateFile(largeFile, 'profile');
      const bamResult = service.validateFile(largeFile, 'bam');

      expect(profileResult.isValid).toBe(false); // Trop gros pour profil (5MB max)
      expect(bamResult.isValid).toBe(true); // OK pour BAM (10MB max)
    });
  });

  describe('processImage', () => {
    const mockBuffer = Buffer.from('fake-image-data');

    beforeEach(() => {
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('processed-image-data'));
    });

    it('should process image in multiple sizes for profile', async () => {
      const result = await service.processImage(mockBuffer, 'profile', 'jpeg');

      expect(result).toHaveProperty('small');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('large');
      
      expect(sharp).toHaveBeenCalledWith(mockBuffer);
      expect(mockSharp.resize).toHaveBeenCalledTimes(3);
      expect(mockSharp.jpeg).toHaveBeenCalledTimes(3);
    });

    it('should process image in multiple sizes for bam', async () => {
      const result = await service.processImage(mockBuffer, 'bam', 'jpeg');

      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('medium');
      expect(result).toHaveProperty('large');
    });

    it('should handle different output formats', async () => {
      await service.processImage(mockBuffer, 'profile', 'png');
      expect(mockSharp.png).toHaveBeenCalledTimes(3);

      jest.clearAllMocks();
      mockSharp.toBuffer.mockResolvedValue(Buffer.from('webp-data'));
      
      await service.processImage(mockBuffer, 'profile', 'webp');
      expect(mockSharp.webp).toHaveBeenCalledTimes(3);
    });

    it('should handle processing errors', async () => {
      mockSharp.toBuffer.mockRejectedValue(new Error('Processing failed'));

      await expect(
        service.processImage(mockBuffer, 'profile', 'jpeg')
      ).rejects.toThrow('Erreur lors du redimensionnement de l\'image');
    });
  });

  describe('uploadToCloudinary', () => {
    const mockBuffer = Buffer.from('image-data');
    const mockResult = {
      secure_url: 'https://cloudinary.com/image.jpg',
      public_id: 'test/image',
      width: 300,
      height: 300,
      bytes: 50000,
    };

    it('should upload image to Cloudinary successfully', async () => {
      // Simuler le stream d'upload réussi
      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        // Simuler l'appel du callback avec succès
        setTimeout(() => callback(null, mockResult), 0);
        return {
          end: jest.fn(),
        };
      });

      const result = await service.uploadToCloudinary(mockBuffer, {
        folder: 'test-folder',
        public_id: 'test-image',
      });

      expect(result).toEqual(mockResult);
      expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'test-folder',
          public_id: 'test-image',
          resource_type: 'image',
          quality: 'auto:good',
          fetch_format: 'auto',
        }),
        expect.any(Function)
      );
    });

    it('should handle Cloudinary upload errors', async () => {
      const error = new Error('Upload failed');
      
      mockCloudinary.uploader.upload_stream.mockImplementation((options, callback) => {
        setTimeout(() => callback(error, null), 0);
        return {
          end: jest.fn(),
        };
      });

      await expect(
        service.uploadToCloudinary(mockBuffer)
      ).rejects.toThrow('Erreur lors de l\'upload vers le cloud');
    });
  });

  describe('uploadProfilePhoto', () => {
    const mockFile = {
      buffer: Buffer.from('image-data'),
      mimetype: 'image/jpeg',
      size: 1024 * 1024,
      originalname: 'profile.jpg',
    };

    const mockUploadResult = {
      secure_url: 'https://cloudinary.com/profile.jpg',
      public_id: 'profiles/user-123',
      width: 300,
      height: 300,
      bytes: 50000,
    };

    beforeEach(() => {
      // Mock des méthodes internes
      service.validateFile = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      service.processImage = jest.fn().mockResolvedValue({
        small: Buffer.from('small-image'),
        medium: Buffer.from('medium-image'),
        large: Buffer.from('large-image'),
      });
      service.uploadToCloudinary = jest.fn().mockResolvedValue(mockUploadResult);
    });

    it('should upload profile photo successfully', async () => {
      const result = await service.uploadProfilePhoto(mockFile, 'user-123');

      expect(result.success).toBe(true);
      expect(result.primaryUrl).toBe(mockUploadResult.secure_url);
      expect(result.images).toHaveProperty('small');
      expect(result.images).toHaveProperty('medium');
      expect(result.images).toHaveProperty('large');
      expect(result.metadata.userId).toBe('user-123');
    });

    it('should throw error for invalid file', async () => {
      service.validateFile.mockReturnValue({
        isValid: false,
        errors: ['Type de fichier non autorisé'],
      });

      await expect(
        service.uploadProfilePhoto(mockFile, 'user-123')
      ).rejects.toThrow('Type de fichier non autorisé');
    });

    it('should handle processing errors', async () => {
      service.processImage.mockRejectedValue(new Error('Processing failed'));

      await expect(
        service.uploadProfilePhoto(mockFile, 'user-123')
      ).rejects.toThrow('Erreur lors de l\'upload: Processing failed');
    });
  });

  describe('uploadBamImage', () => {
    const mockFile = {
      buffer: Buffer.from('image-data'),
      mimetype: 'image/jpeg',
      size: 2 * 1024 * 1024,
      originalname: 'bam.jpg',
    };

    beforeEach(() => {
      service.validateFile = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      service.processImage = jest.fn().mockResolvedValue({
        thumbnail: Buffer.from('thumb-image'),
        medium: Buffer.from('medium-image'),
        large: Buffer.from('large-image'),
      });
      service.uploadToCloudinary = jest.fn().mockResolvedValue({
        secure_url: 'https://cloudinary.com/bam.jpg',
        public_id: 'bams/bam-456',
        width: 800,
        height: 600,
        bytes: 100000,
      });
    });

    it('should upload BAM image successfully', async () => {
      const result = await service.uploadBamImage(mockFile, 'bam-456', 'user-123');

      expect(result.success).toBe(true);
      expect(result.primaryUrl).toBe('https://cloudinary.com/bam.jpg');
      expect(result.thumbnailUrl).toBe('https://cloudinary.com/bam.jpg');
      expect(result.images).toHaveProperty('thumbnail');
      expect(result.images).toHaveProperty('medium');
      expect(result.images).toHaveProperty('large');
      expect(result.metadata.bamId).toBe('bam-456');
      expect(result.metadata.userId).toBe('user-123');
    });
  });

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });

      const result = await service.deleteImage('test-public-id');

      expect(result.success).toBe(true);
      expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith('test-public-id');
    });

    it('should handle deletion errors', async () => {
      mockCloudinary.uploader.destroy.mockRejectedValue(new Error('Delete failed'));

      await expect(
        service.deleteImage('test-public-id')
      ).rejects.toThrow('Erreur lors de la suppression de l\'image');
    });
  });

  describe('validateCloudinaryConfig', () => {
    it('should return true when all config is present', () => {
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';

      const result = service.validateCloudinaryConfig();

      expect(result).toBe(true);
    });

    it('should return false when config is missing', () => {
      delete process.env.CLOUDINARY_CLOUD_NAME;

      const result = service.validateCloudinaryConfig();

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return success on successful connection', async () => {
      mockCloudinary.api.ping.mockResolvedValue({});

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connexion Cloudinary OK');
    });

    it('should return error on failed connection', async () => {
      const error = new Error('Connection failed');
      mockCloudinary.api.ping.mockRejectedValue(error);

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe(error.message);
    });
  });

  describe('generateTransformedUrl', () => {
    beforeEach(() => {
      mockCloudinary.url = jest.fn().mockReturnValue('https://cloudinary.com/transformed.jpg');
    });

    it('should generate transformed URL', () => {
      const url = service.generateTransformedUrl('test-public-id', {
        width: 300,
        height: 300,
        crop: 'fill',
      });

      expect(url).toBe('https://cloudinary.com/transformed.jpg');
      expect(mockCloudinary.url).toHaveBeenCalledWith('test-public-id', {
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto:good',
        fetch_format: 'auto',
      });
    });

    it('should handle URL generation errors', () => {
      mockCloudinary.url.mockImplementation(() => {
        throw new Error('URL generation failed');
      });

      const url = service.generateTransformedUrl('test-public-id');

      expect(url).toBe(null);
    });
  });

  describe('getImageInfo', () => {
    const mockImageInfo = {
      public_id: 'test-image',
      secure_url: 'https://cloudinary.com/image.jpg',
      width: 300,
      height: 300,
      bytes: 50000,
      format: 'jpg',
      created_at: '2023-01-01T00:00:00Z',
    };

    it('should get image info successfully', async () => {
      mockCloudinary.api.resource.mockResolvedValue(mockImageInfo);

      const result = await service.getImageInfo('test-image');

      expect(result.success).toBe(true);
      expect(result.info.public_id).toBe('test-image');
      expect(result.info.width).toBe(300);
      expect(result.info.height).toBe(300);
    });

    it('should handle info retrieval errors', async () => {
      const error = new Error('Resource not found');
      mockCloudinary.api.resource.mockRejectedValue(error);

      const result = await service.getImageInfo('test-image');

      expect(result.success).toBe(false);
      expect(result.error).toBe(error.message);
    });
  });
});