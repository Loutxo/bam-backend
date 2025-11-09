const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const fileUploadService = require('../services/fileUploadService');
const { 
  uploadProfilePhoto, 
  uploadBamImage, 
  uploadBamImages,
  validateUploadedFiles 
} = require('../middleware/uploadMiddleware');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// Middleware d'authentification pour toutes les routes
router.use(authenticateToken);

/**
 * @route POST /api/uploads/profile
 * @desc Upload d'une photo de profil
 * @access Private
 */
router.post('/profile', uploadProfilePhoto, validateUploadedFiles, async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileImageUrl: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé'
      });
    }

    // Upload de l'image
    const uploadResult = await fileUploadService.uploadProfilePhoto(file, userId);

    // Sauvegarder l'URL en base de données
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profileImageUrl: uploadResult.primaryUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        username: true,
        profileImageUrl: true,
        updatedAt: true
      }
    });

    // Supprimer l'ancienne image si elle existe
    if (user.profileImageUrl && user.profileImageUrl !== uploadResult.primaryUrl) {
      try {
        // Extraire le public_id de l'ancienne URL Cloudinary
        const oldPublicId = user.profileImageUrl.split('/').pop().split('.')[0];
        await fileUploadService.deleteImage(`bam-app/profiles/${oldPublicId}`);
      } catch (deleteError) {
        console.warn('Erreur suppression ancienne image:', deleteError.message);
        // Ne pas faire échouer la requête pour ça
      }
    }

    res.status(200).json({
      success: true,
      message: 'Photo de profil uploadée avec succès',
      data: {
        user: updatedUser,
        upload: {
          primaryUrl: uploadResult.primaryUrl,
          images: uploadResult.images,
          metadata: uploadResult.metadata
        }
      }
    });

  } catch (error) {
    console.error('Erreur upload photo profil:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Erreur lors de l\'upload de la photo de profil'
    });
  }
});

/**
 * @route POST /api/uploads/bam/:bamId
 * @desc Upload d'une image pour une BAM
 * @access Private
 */
router.post('/bam/:bamId', uploadBamImage, validateUploadedFiles, async (req, res) => {
  try {
    const userId = req.user.id;
    const bamId = parseInt(req.params.bamId);
    const file = req.file;

    // Vérifier que la BAM existe et appartient à l'utilisateur
    const bam = await prisma.bam.findFirst({
      where: { 
        id: bamId,
        userId: userId 
      },
      select: { id: true, imageUrl: true, title: true }
    });

    if (!bam) {
      return res.status(404).json({
        success: false,
        error: 'BAM_NOT_FOUND',
        message: 'BAM non trouvée ou non autorisée'
      });
    }

    // Upload de l'image
    const uploadResult = await fileUploadService.uploadBamImage(file, bamId, userId);

    // Sauvegarder l'URL en base de données
    const updatedBam = await prisma.bam.update({
      where: { id: bamId },
      data: {
        imageUrl: uploadResult.primaryUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            profileImageUrl: true
          }
        }
      }
    });

    // Supprimer l'ancienne image si elle existe
    if (bam.imageUrl && bam.imageUrl !== uploadResult.primaryUrl) {
      try {
        const oldPublicId = bam.imageUrl.split('/').pop().split('.')[0];
        await fileUploadService.deleteImage(`bam-app/bams/${oldPublicId}`);
      } catch (deleteError) {
        console.warn('Erreur suppression ancienne image BAM:', deleteError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Image de BAM uploadée avec succès',
      data: {
        bam: updatedBam,
        upload: {
          primaryUrl: uploadResult.primaryUrl,
          thumbnailUrl: uploadResult.thumbnailUrl,
          images: uploadResult.images,
          metadata: uploadResult.metadata
        }
      }
    });

  } catch (error) {
    console.error('Erreur upload image BAM:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Erreur lors de l\'upload de l\'image BAM'
    });
  }
});

/**
 * @route POST /api/uploads/bam/:bamId/multiple
 * @desc Upload multiple d'images pour une BAM (galerie)
 * @access Private
 */
router.post('/bam/:bamId/multiple', uploadBamImages, validateUploadedFiles, async (req, res) => {
  try {
    const userId = req.user.id;
    const bamId = parseInt(req.params.bamId);
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILES',
        message: 'Aucun fichier fourni'
      });
    }

    // Vérifier que la BAM existe et appartient à l'utilisateur
    const bam = await prisma.bam.findFirst({
      where: { 
        id: bamId,
        userId: userId 
      },
      select: { id: true, title: true }
    });

    if (!bam) {
      return res.status(404).json({
        success: false,
        error: 'BAM_NOT_FOUND',
        message: 'BAM non trouvée ou non autorisée'
      });
    }

    // Upload de toutes les images
    const uploadPromises = files.map((file, index) => 
      fileUploadService.uploadBamImage(file, `${bamId}-${index}`, userId)
    );

    const uploadResults = await Promise.allSettled(uploadPromises);

    // Traiter les résultats
    const successful = [];
    const failed = [];

    uploadResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push({
          index,
          file: files[index].originalname,
          ...result.value
        });
      } else {
        failed.push({
          index,
          file: files[index].originalname,
          error: result.reason.message
        });
      }
    });

    // Si au moins une image a réussi, mettre à jour la BAM avec la première image
    if (successful.length > 0) {
      const primaryImage = successful[0];
      await prisma.bam.update({
        where: { id: bamId },
        data: {
          imageUrl: primaryImage.primaryUrl,
          updatedAt: new Date()
        }
      });
    }

    const statusCode = failed.length === 0 ? 200 : (successful.length === 0 ? 400 : 207);

    res.status(statusCode).json({
      success: successful.length > 0,
      message: `${successful.length}/${files.length} images uploadées avec succès`,
      data: {
        successful,
        failed,
        summary: {
          total: files.length,
          successful: successful.length,
          failed: failed.length
        }
      }
    });

  } catch (error) {
    console.error('Erreur upload multiple images BAM:', error);
    
    res.status(500).json({
      success: false,
      error: 'UPLOAD_FAILED',
      message: error.message || 'Erreur lors de l\'upload des images'
    });
  }
});

/**
 * @route DELETE /api/uploads/profile
 * @desc Suppression de la photo de profil
 * @access Private
 */
router.delete('/profile', async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer l'utilisateur avec son image
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileImageUrl: true }
    });

    if (!user || !user.profileImageUrl) {
      return res.status(404).json({
        success: false,
        error: 'NO_PROFILE_IMAGE',
        message: 'Aucune photo de profil à supprimer'
      });
    }

    // Supprimer l'image de Cloudinary
    try {
      const publicId = user.profileImageUrl.split('/').pop().split('.')[0];
      await fileUploadService.deleteImage(`bam-app/profiles/${publicId}`);
    } catch (deleteError) {
      console.warn('Erreur suppression Cloudinary:', deleteError.message);
      // Continuer même si la suppression Cloudinary échoue
    }

    // Supprimer l'URL de la base de données
    await prisma.user.update({
      where: { id: userId },
      data: {
        profileImageUrl: null,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Photo de profil supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression photo profil:', error);
    
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Erreur lors de la suppression de la photo de profil'
    });
  }
});

/**
 * @route DELETE /api/uploads/bam/:bamId
 * @desc Suppression de l'image d'une BAM
 * @access Private
 */
router.delete('/bam/:bamId', async (req, res) => {
  try {
    const userId = req.user.id;
    const bamId = parseInt(req.params.bamId);

    // Vérifier que la BAM existe et appartient à l'utilisateur
    const bam = await prisma.bam.findFirst({
      where: { 
        id: bamId,
        userId: userId 
      },
      select: { id: true, imageUrl: true, title: true }
    });

    if (!bam) {
      return res.status(404).json({
        success: false,
        error: 'BAM_NOT_FOUND',
        message: 'BAM non trouvée ou non autorisée'
      });
    }

    if (!bam.imageUrl) {
      return res.status(404).json({
        success: false,
        error: 'NO_BAM_IMAGE',
        message: 'Aucune image à supprimer pour cette BAM'
      });
    }

    // Supprimer l'image de Cloudinary
    try {
      const publicId = bam.imageUrl.split('/').pop().split('.')[0];
      await fileUploadService.deleteImage(`bam-app/bams/${publicId}`);
    } catch (deleteError) {
      console.warn('Erreur suppression Cloudinary BAM:', deleteError.message);
    }

    // Supprimer l'URL de la base de données
    await prisma.bam.update({
      where: { id: bamId },
      data: {
        imageUrl: null,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      success: true,
      message: 'Image de BAM supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression image BAM:', error);
    
    res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: 'Erreur lors de la suppression de l\'image BAM'
    });
  }
});

/**
 * @route GET /api/uploads/info/:type/:id
 * @desc Informations sur les images uploadées
 * @access Private
 */
router.get('/info/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const userId = req.user.id;

    let imageUrl = null;
    let entityInfo = {};

    if (type === 'profile') {
      // Info photo de profil
      if (id !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Accès non autorisé'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, profileImageUrl: true, updatedAt: true }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé'
        });
      }

      imageUrl = user.profileImageUrl;
      entityInfo = { user: user };

    } else if (type === 'bam') {
      // Info image BAM
      const bamId = parseInt(id);
      const bam = await prisma.bam.findFirst({
        where: { 
          id: bamId,
          userId: userId 
        },
        select: { 
          id: true, 
          title: true, 
          imageUrl: true, 
          updatedAt: true,
          user: {
            select: { id: true, username: true }
          }
        }
      });

      if (!bam) {
        return res.status(404).json({
          success: false,
          error: 'BAM_NOT_FOUND',
          message: 'BAM non trouvée ou non autorisée'
        });
      }

      imageUrl = bam.imageUrl;
      entityInfo = { bam: bam };

    } else {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TYPE',
        message: 'Type invalide. Utilisez "profile" ou "bam"'
      });
    }

    // Obtenir les infos Cloudinary si une image existe
    let cloudinaryInfo = null;
    if (imageUrl) {
      try {
        const publicId = imageUrl.split('/').pop().split('.')[0];
        const info = await fileUploadService.getImageInfo(`bam-app/${type}s/${publicId}`);
        cloudinaryInfo = info.success ? info.info : null;
      } catch (error) {
        console.warn('Erreur récupération info Cloudinary:', error.message);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        hasImage: !!imageUrl,
        imageUrl,
        cloudinaryInfo,
        ...entityInfo
      }
    });

  } catch (error) {
    console.error('Erreur récupération info upload:', error);
    
    res.status(500).json({
      success: false,
      error: 'INFO_FAILED',
      message: 'Erreur lors de la récupération des informations'
    });
  }
});

/**
 * @route GET /api/uploads/test-connection
 * @desc Test de la connexion Cloudinary
 * @access Private (admin seulement en prod)
 */
router.get('/test-connection', async (req, res) => {
  try {
    // En production, limiter aux admins
    // if (process.env.NODE_ENV === 'production' && req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'FORBIDDEN',
    //     message: 'Accès réservé aux administrateurs'
    //   });
    // }

    // Vérifier la configuration
    const configValid = fileUploadService.validateCloudinaryConfig();
    
    // Tester la connexion
    const connectionTest = await fileUploadService.testConnection();

    res.status(200).json({
      success: configValid && connectionTest.success,
      data: {
        configurationValid: configValid,
        connectionTest: connectionTest,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur test connexion:', error);
    
    res.status(500).json({
      success: false,
      error: 'TEST_FAILED',
      message: 'Erreur lors du test de connexion'
    });
  }
});

module.exports = router;
