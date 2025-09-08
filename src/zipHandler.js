/**
 * ZipHandler - Handles ZIP file extraction with LRU cache for media files
 * Uses fflate for extraction and implements memory-efficient media handling
 */

class LRUCache {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.accessOrder = [];
    }

    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }
        // Move to end (most recently used)
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        this.accessOrder.push(key);
        return this.cache.get(key);
    }

    set(key, value, onEvict) {
        // If already exists, just update
        if (this.cache.has(key)) {
            this.cache.set(key, value);
            this.get(key); // Update access order
            return;
        }

        // Check if we need to evict
        if (this.cache.size >= this.maxSize) {
            const lru = this.accessOrder.shift();
            const evicted = this.cache.get(lru);
            this.cache.delete(lru);
            if (onEvict) {
                onEvict(lru, evicted);
            }
        }

        this.cache.set(key, value);
        this.accessOrder.push(key);
    }

    has(key) {
        return this.cache.has(key);
    }

    clear(onEvict) {
        if (onEvict) {
            for (const [key, value] of this.cache.entries()) {
                onEvict(key, value);
            }
        }
        this.cache.clear();
        this.accessOrder = [];
    }

    get size() {
        return this.cache.size;
    }
}

export class ZipHandler {
    constructor(options = {}) {
        this.maxCacheSize = options.maxCacheSize || 50;
        this.urlCache = new LRUCache(this.maxCacheSize);
        this.mediaFiles = new Map(); // filename -> compressed data
        this.chatContent = null;
        this.chatFilename = null;
        this.isLoaded = false;
    }

    /**
     * Load and extract ZIP file
     */
    async loadZip(file) {
        if (!file || !(file instanceof Blob)) {
            throw new Error('Invalid file provided');
        }

        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Check if fflate is available
            if (typeof window !== 'undefined' && !window.fflate) {
                throw new Error('fflate library not loaded');
            }
            
            // Extract ZIP
            const unzipped = window.fflate ? 
                window.fflate.unzipSync(uint8Array) : 
                fflate.unzipSync(uint8Array);
            
            // Clear previous data
            this.clear();
            
            // Process extracted files
            for (const [path, data] of Object.entries(unzipped)) {
                const filename = path.split('/').pop();
                
                // Check if it's the chat file
                if (filename.endsWith('.txt') && !this.chatContent) {
                    // Decode chat file immediately (it's needed right away)
                    this.chatContent = new TextDecoder('utf-8').decode(data);
                    this.chatFilename = filename;
                } 
                // Store media files as compressed data (not decoded yet)
                else if (this.isMediaFile(filename)) {
                    this.mediaFiles.set(filename, data);
                }
            }
            
            this.isLoaded = true;
            
            return {
                success: true,
                chatFound: !!this.chatContent,
                chatFilename: this.chatFilename,
                mediaCount: this.mediaFiles.size,
                mediaFiles: Array.from(this.mediaFiles.keys())
            };
            
        } catch (error) {
            throw new Error(`Failed to load ZIP: ${error.message}`);
        }
    }

    /**
     * Check if filename is a media file
     */
    isMediaFile(filename) {
        if (!filename) return false;
        const ext = filename.split('.').pop().toLowerCase();
        const mediaExtensions = [
            'jpg', 'jpeg', 'png', 'gif', 'webp', // images
            'mp4', '3gp', 'mov', 'avi', 'mkv', 'webm', // videos
            'opus', 'mp3', 'aac', 'm4a', 'wav', // audio
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'vcf' // documents
        ];
        return mediaExtensions.includes(ext);
    }

    /**
     * Get MIME type for file
     */
    getMimeType(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const mimeTypes = {
            // Images
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', 
            gif: 'image/gif', webp: 'image/webp',
            // Videos
            mp4: 'video/mp4', '3gp': 'video/3gpp', mov: 'video/quicktime',
            avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm',
            // Audio
            opus: 'audio/ogg', mp3: 'audio/mpeg', aac: 'audio/aac',
            m4a: 'audio/mp4', wav: 'audio/wav',
            // Documents
            pdf: 'application/pdf', doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint',
            pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain', vcf: 'text/vcard'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Get or create object URL for media file (with LRU caching)
     */
    getMediaURL(filename) {
        if (!filename || !this.mediaFiles.has(filename)) {
            return null;
        }

        // Check cache first
        const cached = this.urlCache.get(filename);
        if (cached) {
            return cached;
        }

        // Create new blob URL
        const data = this.mediaFiles.get(filename);
        const mimeType = this.getMimeType(filename);
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Store in cache with eviction callback
        this.urlCache.set(filename, url, (evictedKey, evictedUrl) => {
            // Revoke URL when evicted from cache
            URL.revokeObjectURL(evictedUrl);
        });
        
        return url;
    }

    /**
     * Preload specific media files into cache
     */
    preloadMedia(filenames) {
        const results = [];
        for (const filename of filenames) {
            const url = this.getMediaURL(filename);
            if (url) {
                results.push({ filename, url, cached: true });
            } else {
                results.push({ filename, url: null, cached: false });
            }
        }
        return results;
    }

    /**
     * Get chat content
     */
    getChatContent() {
        return this.chatContent;
    }

    /**
     * Get chat filename
     */
    getChatFilename() {
        return this.chatFilename;
    }

    /**
     * Check if a media file exists
     */
    hasMedia(filename) {
        return this.mediaFiles.has(filename);
    }

    /**
     * Get list of all media files
     */
    getMediaList() {
        return Array.from(this.mediaFiles.keys());
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cacheSize: this.urlCache.size,
            maxCacheSize: this.maxCacheSize,
            totalMedia: this.mediaFiles.size,
            cacheUtilization: (this.urlCache.size / this.maxCacheSize) * 100
        };
    }

    /**
     * Clear specific URL from cache
     */
    evictFromCache(filename) {
        const url = this.urlCache.get(filename);
        if (url) {
            URL.revokeObjectURL(url);
            this.urlCache.cache.delete(filename);
            this.urlCache.accessOrder = this.urlCache.accessOrder.filter(k => k !== filename);
        }
    }

    /**
     * Clear all data and revoke all URLs
     */
    clear() {
        // Revoke all cached URLs
        this.urlCache.clear((key, url) => {
            URL.revokeObjectURL(url);
        });
        
        // Clear all data
        this.mediaFiles.clear();
        this.chatContent = null;
        this.chatFilename = null;
        this.isLoaded = false;
    }

    /**
     * Get memory usage estimate (in bytes)
     */
    getMemoryEstimate() {
        let totalSize = 0;
        
        // Estimate chat content size
        if (this.chatContent) {
            totalSize += this.chatContent.length * 2; // UTF-16 chars
        }
        
        // Estimate compressed media size
        for (const data of this.mediaFiles.values()) {
            totalSize += data.byteLength;
        }
        
        return totalSize;
    }
}