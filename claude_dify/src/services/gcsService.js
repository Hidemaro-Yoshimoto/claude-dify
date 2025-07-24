const { Storage } = require('@google-cloud/storage');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class GCSService {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.bucketName = process.env.GCS_BUCKET_NAME || 'claude-dify-checker-bucket';
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      logger.info(`📦 Initializing GCS service with bucket: ${this.bucketName}`);
      
      this.storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT,
        // Credentials will be automatically detected from environment
        // or from GOOGLE_APPLICATION_CREDENTIALS file
      });

      this.bucket = this.storage.bucket(this.bucketName);
      
      // Check if bucket exists and is accessible
      const [exists] = await this.bucket.exists();
      if (!exists) {
        logger.warn(`Bucket ${this.bucketName} does not exist or is not accessible`);
        // In production, bucket should be created manually by user
        // For development, we could create it automatically
      }

      this.isInitialized = true;
      logger.info('✅ GCS service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize GCS service:', error);
      throw new AppError('Failed to initialize cloud storage', 500, 'GCS_INIT_ERROR', {
        bucketName: this.bucketName,
        error: error.message
      });
    }
  }

  async uploadScreenshot(buffer, filename) {
    try {
      await this.initialize();
      
      logger.debug(`📤 Uploading screenshot: ${filename} (${buffer.length} bytes)`);
      
      const file = this.bucket.file(filename);
      
      const stream = file.createWriteStream({
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=3600',
          metadata: {
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'claude-dify-checker',
            category: 'screenshot'
          }
        },
        resumable: false, // For small files, resumable upload is not needed
        validation: 'crc32c'
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          logger.error(`Failed to upload screenshot ${filename}:`, error);
          reject(new AppError('Screenshot upload failed', 500, 'GCS_UPLOAD_ERROR', {
            filename,
            error: error.message
          }));
        });

        stream.on('finish', () => {
          const publicUrl = `gs://${this.bucketName}/${filename}`;
          logger.debug(`✅ Screenshot uploaded successfully: ${publicUrl}`);
          resolve(publicUrl);
        });

        stream.end(buffer);
      });

    } catch (error) {
      logger.error(`Screenshot upload error for ${filename}:`, error);
      throw error instanceof AppError ? error : new AppError(
        'Screenshot upload failed',
        500,
        'GCS_UPLOAD_ERROR',
        { filename, error: error.message }
      );
    }
  }

  async uploadReport(content, filename, contentType = 'text/html') {
    try {
      await this.initialize();
      
      logger.debug(`📤 Uploading report: ${filename} (${content.length} bytes)`);
      
      const file = this.bucket.file(filename);
      
      const stream = file.createWriteStream({
        metadata: {
          contentType,
          cacheControl: 'public, max-age=86400', // 24 hours cache for reports
          metadata: {
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'claude-dify-checker',
            category: 'report'
          }
        },
        resumable: false,
        validation: 'crc32c'
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          logger.error(`Failed to upload report ${filename}:`, error);
          reject(new AppError('Report upload failed', 500, 'GCS_UPLOAD_ERROR', {
            filename,
            error: error.message
          }));
        });

        stream.on('finish', async () => {
          try {
            // Make the file publicly readable
            await file.makePublic();
            
            const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filename}`;
            logger.debug(`✅ Report uploaded successfully: ${publicUrl}`);
            resolve(publicUrl);
          } catch (error) {
            logger.error(`Failed to make report public: ${filename}`, error);
            // Still resolve with gs:// URL even if making public fails
            resolve(`gs://${this.bucketName}/${filename}`);
          }
        });

        stream.end(content);
      });

    } catch (error) {
      logger.error(`Report upload error for ${filename}:`, error);
      throw error instanceof AppError ? error : new AppError(
        'Report upload failed',
        500,
        'GCS_UPLOAD_ERROR',
        { filename, error: error.message }
      );
    }
  }

  async getSignedUrl(filename, action = 'read', expiresInMinutes = 60) {
    try {
      await this.initialize();
      
      const file = this.bucket.file(filename);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action,
        expires: Date.now() + expiresInMinutes * 60 * 1000
      });

      logger.debug(`🔗 Generated signed URL for ${filename} (expires in ${expiresInMinutes}min)`);
      return url;
    } catch (error) {
      logger.error(`Failed to generate signed URL for ${filename}:`, error);
      throw new AppError('Failed to generate signed URL', 500, 'GCS_SIGNED_URL_ERROR', {
        filename,
        error: error.message
      });
    }
  }

  async deleteFile(filename) {
    try {
      await this.initialize();
      
      const file = this.bucket.file(filename);
      await file.delete();
      
      logger.info(`🗑️ File deleted: ${filename}`);
    } catch (error) {
      if (error.code === 404) {
        logger.warn(`File not found for deletion: ${filename}`);
        return; // Not an error if file doesn't exist
      }
      
      logger.error(`Failed to delete file ${filename}:`, error);
      throw new AppError('File deletion failed', 500, 'GCS_DELETE_ERROR', {
        filename,
        error: error.message
      });
    }
  }

  async deleteOldFiles(olderThanHours = 72) {
    try {
      await this.initialize();
      
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
      logger.info(`🧹 Cleaning up files older than ${olderThanHours} hours (before ${cutoffTime.toISOString()})`);
      
      const [files] = await this.bucket.getFiles({
        prefix: 'screenshots/'
      });

      let deletedCount = 0;
      const deletePromises = [];

      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const uploadTime = new Date(metadata.timeCreated);
        
        if (uploadTime < cutoffTime) {
          deletePromises.push(
            file.delete().then(() => {
              deletedCount++;
              logger.debug(`🗑️ Deleted old file: ${file.name}`);
            }).catch(error => {
              logger.warn(`Failed to delete old file ${file.name}:`, error);
            })
          );
        }
      }

      await Promise.all(deletePromises);
      logger.info(`✅ Cleanup completed: ${deletedCount} files deleted`);
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean up old files:', error);
      throw new AppError('File cleanup failed', 500, 'GCS_CLEANUP_ERROR', {
        error: error.message
      });
    }
  }

  async getBucketInfo() {
    try {
      await this.initialize();
      
      const [metadata] = await this.bucket.getMetadata();
      const [files] = await this.bucket.getFiles();
      
      const totalSize = files.reduce((sum, file) => {
        return sum + (file.metadata.size ? parseInt(file.metadata.size) : 0);
      }, 0);

      return {
        name: this.bucketName,
        location: metadata.location,
        storageClass: metadata.storageClass,
        fileCount: files.length,
        totalSize: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        created: metadata.timeCreated,
        updated: metadata.updated
      };
    } catch (error) {
      logger.error('Failed to get bucket info:', error);
      throw new AppError('Failed to get bucket information', 500, 'GCS_INFO_ERROR', {
        bucketName: this.bucketName,
        error: error.message
      });
    }
  }

  async healthCheck() {
    try {
      await this.initialize();
      
      // Try to list files as a simple health check
      const [files] = await this.bucket.getFiles({ maxResults: 1 });
      
      return {
        status: 'healthy',
        bucket: this.bucketName,
        accessible: true,
        sampleFileCount: files.length
      };
    } catch (error) {
      logger.error('GCS health check failed:', error);
      return {
        status: 'unhealthy',
        bucket: this.bucketName,
        accessible: false,
        error: error.message
      };
    }
  }

  // Method to setup lifecycle rules (for automatic cleanup)
  async setupLifecycleRules() {
    try {
      await this.initialize();
      
      const lifecycleRule = {
        lifecycle: {
          rule: [
            {
              action: { type: 'Delete' },
              condition: {
                age: 3, // Delete files older than 3 days
                matchesPrefix: ['screenshots/']
              }
            }
          ]
        }
      };

      await this.bucket.setMetadata(lifecycleRule);
      logger.info('✅ GCS lifecycle rules configured for automatic cleanup');
    } catch (error) {
      logger.error('Failed to setup lifecycle rules:', error);
      throw new AppError('Failed to setup lifecycle rules', 500, 'GCS_LIFECYCLE_ERROR', {
        error: error.message
      });
    }
  }
}

// Singleton instance
const gcsService = new GCSService();

// Schedule cleanup every 6 hours
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await gcsService.deleteOldFiles(72); // 72 hours
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
    }
  }, 6 * 60 * 60 * 1000); // 6 hours
}

module.exports = gcsService;