const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class FileUploadService {
  constructor() {
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    
    // Configurations de redimensionnement
    this.imageSizes = {
      profile: {
        small: { width: 150, height: 150 },
        medium: { width: 300, height: 300 },
        large: { width: 600, height: 600 }
      },
      bam: {
        thumbnail: { width: 200, height: 200 },
        medium: { width: 800, height: 600 },
        large: { width: 1200, height: 900 }
      }
    };
  }

  /**
   * Valide un fichier uploadé
   * @param {Object} file - Fichier multer
   * @param {string} type - Type d'upload ('profile' ou 'bam')
   * @returns {Object} Validation result
   */
  validateFile(file, type = 'profile') {
    const errors = [];

    // Vérifier la présence du fichier
    if (!file) {
      errors.push('Aucun fichier fourni');
      return { isValid: false, errors };
    }

    // Vérifier le type MIME
    if (!this.allowedImageTypes.includes(file.mimetype)) {
      errors.push(`Type de fichier non autorisé. Types acceptés: ${this.allowedImageTypes.join(', ')}`);
    }

    // Vérifier la taille
    if (file.size > this.maxFileSize) {
      errors.push(`Fichier trop volumineux. Taille maximale: ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Vérifications spécifiques selon le type
    if (type === 'profile') {
      // Pour les photos de profil, limiter à 5MB
      const profileMaxSize = 5 * 1024 * 1024;
      if (file.size > profileMaxSize) {
        errors.push(`Photo de profil trop volumineuse. Taille maximale: ${profileMaxSize / (1024 * 1024)}MB`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Traite une image (redimensionnement, compression, formats multiples)
   * @param {Buffer} buffer - Buffer de l'image
   * @param {string} type - Type d'upload ('profile' ou 'bam')
   * @param {string} format - Format de sortie ('jpeg', 'png', 'webp')
   * @returns {Object} Images redimensionnées
   */
  async processImage(buffer, type = 'profile', format = 'jpeg') {
    const sizes = this.imageSizes[type];
    const processedImages = {};

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      try {
        let sharpInstance = sharp(buffer)
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
            position: 'center'
          });

        // Configuration selon le format
        switch (format) {
          case 'jpeg':
            sharpInstance = sharpInstance.jpeg({ 
              quality: sizeName === 'large' ? 90 : 80,
              progressive: true 
            });
            break;
          case 'png':
            sharpInstance = sharpInstance.png({ 
              compressionLevel: 6,
              progressive: true 
            });
            break;
          case 'webp':
            sharpInstance = sharpInstance.webp({ 
              quality: sizeName === 'large' ? 85 : 75 
            });
            break;
        }

        processedImages[sizeName] = await sharpInstance.toBuffer();
        
      } catch (error) {
        console.error(`Erreur traitement image ${sizeName}:`, error);
        throw new Error(`Erreur lors du redimensionnement de l'image`);
      }
    }

    return processedImages;
  }

  /**
   * Upload une image vers Cloudinary
   * @param {Buffer} buffer - Buffer de l'image
   * @param {Object} options - Options d'upload
   * @returns {Object} Résultat de l'upload
   */
  async uploadToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        resource_type: 'image',
        folder: options.folder || 'bam-app',
        public_id: options.public_id,
        transformation: options.transformation,
        quality: 'auto:good',
        fetch_format: 'auto',
        ...options
      };

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Erreur upload Cloudinary:', error);
            reject(new Error('Erreur lors de l\'upload vers le cloud'));
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Upload une photo de profil
   * @param {Object} file - Fichier multer
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} URLs des images uploadées
   */
  async uploadProfilePhoto(file, userId) {
    // Validation
    const validation = this.validateFile(file, 'profile');
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      // Traitement de l'image en différentes tailles
      const processedImages = await this.processImage(file.buffer, 'profile', 'jpeg');
      const uploadResults = {};

      // Upload de chaque taille
      for (const [sizeName, buffer] of Object.entries(processedImages)) {
        const result = await this.uploadToCloudinary(buffer, {
          folder: 'bam-app/profiles',
          public_id: `user-${userId}-${sizeName}-${Date.now()}`,
          overwrite: true
        });

        uploadResults[sizeName] = {
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          size: result.bytes
        };
      }

      return {
        success: true,
        images: uploadResults,
        primaryUrl: uploadResults.medium.url, // URL principale à stocker en DB
        metadata: {
          originalSize: file.size,
          uploadedAt: new Date().toISOString(),
          userId
        }
      };

    } catch (error) {
      console.error('Erreur upload photo profil:', error);
      throw new Error(`Erreur lors de l'upload: ${error.message}`);
    }
  }

  /**
   * Upload une image pour une BAM
   * @param {Object} file - Fichier multer
   * @param {string} bamId - ID de la BAM
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} URLs des images uploadées
   */
  async uploadBamImage(file, bamId, userId) {
    // Validation
    const validation = this.validateFile(file, 'bam');
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      // Traitement de l'image en différentes tailles
      const processedImages = await this.processImage(file.buffer, 'bam', 'jpeg');
      const uploadResults = {};

      // Upload de chaque taille
      for (const [sizeName, buffer] of Object.entries(processedImages)) {
        const result = await this.uploadToCloudinary(buffer, {
          folder: 'bam-app/bams',
          public_id: `bam-${bamId}-${sizeName}-${Date.now()}`,
          overwrite: true
        });

        uploadResults[sizeName] = {
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          size: result.bytes
        };
      }

      return {
        success: true,
        images: uploadResults,
        primaryUrl: uploadResults.medium.url, // URL principale
        thumbnailUrl: uploadResults.thumbnail.url, // Pour les listes
        metadata: {
          originalSize: file.size,
          uploadedAt: new Date().toISOString(),
          bamId,
          userId
        }
      };

    } catch (error) {
      console.error('Erreur upload image BAM:', error);
      throw new Error(`Erreur lors de l'upload: ${error.message}`);
    }
  }

  /**
   * Supprime une image de Cloudinary
   * @param {string} publicId - Public ID Cloudinary
   * @returns {Object} Résultat de la suppression
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === 'ok',
        result
      };
    } catch (error) {
      console.error('Erreur suppression image:', error);
      throw new Error('Erreur lors de la suppression de l\'image');
    }
  }

  /**
   * Supprime plusieurs images
   * @param {Array} publicIds - Array des public IDs
   * @returns {Object} Résultats de suppression
   */
  async deleteMultipleImages(publicIds) {
    try {
      const results = await Promise.allSettled(
        publicIds.map(id => this.deleteImage(id))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      return {
        success: failed === 0,
        deleted: successful,
        failed,
        results
      };
    } catch (error) {
      console.error('Erreur suppression multiple:', error);
      throw new Error('Erreur lors de la suppression des images');
    }
  }

  /**
   * Génère des URLs de transformation Cloudinary
   * @param {string} publicId - Public ID de l'image
   * @param {Object} transformations - Transformations à appliquer
   * @returns {string} URL transformée
   */
  generateTransformedUrl(publicId, transformations = {}) {
    try {
      return cloudinary.url(publicId, {
        ...transformations,
        quality: 'auto:good',
        fetch_format: 'auto'
      });
    } catch (error) {
      console.error('Erreur génération URL:', error);
      return null;
    }
  }

  /**
   * Obtient les informations d'une image
   * @param {string} publicId - Public ID de l'image
   * @returns {Object} Informations de l'image
   */
  async getImageInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        success: true,
        info: {
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          size: result.bytes,
          format: result.format,
          created_at: result.created_at
        }
      };
    } catch (error) {
      console.error('Erreur récupération info image:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Valide la configuration Cloudinary
   * @returns {boolean} Configuration valide
   */
  validateCloudinaryConfig() {
    const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.warn(`Variables Cloudinary manquantes: ${missing.join(', ')}`);
      return false;
    }
    
    return true;
  }

  /**
   * Test de connectivité Cloudinary
   * @returns {Object} Résultat du test
   */
  async testConnection() {
    try {
      await cloudinary.api.ping();
      return { success: true, message: 'Connexion Cloudinary OK' };
    } catch (error) {
      console.error('Erreur test Cloudinary:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export du singleton
const fileUploadService = new FileUploadService();
module.exports = fileUploadService;