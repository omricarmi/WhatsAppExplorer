/**
 * MediaHandler - Creates DOM elements for media files
 * Single responsibility: Transform filename → DOM element
 */
export class MediaHandler {
    constructor(zipHandler) {
        this.zipHandler = zipHandler;
    }

    /**
     * Create DOM element for a media file
     * @param {string} filename - Name of the media file
     * @returns {HTMLElement} - DOM element ready to insert
     */
    createMediaElement(filename) {
        // Check if media exists
        if (!this.zipHandler.hasMedia(filename)) {
            return this.createMissingElement(filename);
        }
        
        // Get blob URL
        const url = this.zipHandler.getMediaURL(filename);
        
        // Create element based on type
        const type = this.getMediaType(filename);
        
        switch (type) {
            case 'image':
                return this.createImageElement(url, filename);
            case 'video':
                return this.createVideoElement(url, filename);
            case 'audio':
                return this.createAudioElement(url, filename);
            case 'document':
                return this.createDocumentElement(url, filename, type);
            default:
                return this.createDocumentElement(url, filename, 'file');
        }
    }

    /**
     * Get media type from filename
     * @param {string} filename - Name of the file
     * @returns {string} - Media type
     */
    getMediaType(filename) {
        if (!filename) return 'unknown';
        
        const ext = filename.toLowerCase().split('.').pop();
        
        const types = {
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
            video: ['mp4', 'mov', 'avi', 'wmv', '3gp', 'mkv', 'webm'],
            audio: ['mp3', 'wav', 'aac', 'm4a', 'opus', 'ogg', 'wma'],
            document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'vcf']
        };
        
        for (const [type, extensions] of Object.entries(types)) {
            if (extensions.includes(ext)) {
                return type;
            }
        }
        
        return 'file';
    }

    /**
     * Create element for missing media
     */
    createMissingElement(filename) {
        const container = document.createElement('div');
        container.className = 'media-container media-missing';
        container.innerHTML = `
            <span class="media-icon">📎</span>
            <span class="media-name">${this.escapeHtml(filename)}</span>
            <span class="media-status">Not found</span>
        `;
        return container;
    }

    /**
     * Create image element
     */
    createImageElement(url, filename) {
        const container = document.createElement('div');
        container.className = 'media-container media-image';
        
        const img = document.createElement('img');
        img.className = 'media-image-content';
        img.alt = filename;
        img.loading = 'lazy';
        
        // Add loading placeholder
        const loading = document.createElement('div');
        loading.className = 'media-loading';
        loading.textContent = 'Loading...';
        container.appendChild(loading);
        
        img.onload = () => {
            container.innerHTML = '';
            container.appendChild(img);
        };
        
        img.onerror = () => {
            container.innerHTML = `
                <div class="media-error">
                    <span>⚠️ Failed to load image</span>
                    <span class="media-name">${this.escapeHtml(filename)}</span>
                </div>
            `;
        };
        
        img.src = url;
        
        return container;
    }

    /**
     * Create video element
     */
    createVideoElement(url, filename) {
        const container = document.createElement('div');
        container.className = 'media-container media-video';
        
        const video = document.createElement('video');
        video.className = 'media-video-content';
        video.preload = 'metadata';
        video.controls = false;
        
        // Add play button overlay
        const playButton = document.createElement('div');
        playButton.className = 'media-play-button';
        playButton.innerHTML = '▶';
        
        video.onloadedmetadata = () => {
            container.innerHTML = '';
            container.appendChild(video);
            container.appendChild(playButton);
            
            // Seek to 1 second for thumbnail
            video.currentTime = 1;
        };
        
        video.onerror = () => {
            container.innerHTML = `
                <div class="media-error">
                    <span>⚠️ Failed to load video</span>
                    <span class="media-name">${this.escapeHtml(filename)}</span>
                </div>
            `;
        };
        
        video.src = url;
        
        return container;
    }

    /**
     * Create audio element
     */
    createAudioElement(url, filename) {
        const container = document.createElement('div');
        container.className = 'media-container media-audio';
        
        const label = document.createElement('div');
        label.className = 'media-audio-label';
        label.textContent = filename;
        
        const audio = document.createElement('audio');
        audio.className = 'media-audio-content';
        audio.controls = true;
        audio.preload = 'metadata';
        audio.src = url;
        
        container.appendChild(label);
        container.appendChild(audio);
        
        return container;
    }

    /**
     * Create document element
     */
    createDocumentElement(url, filename, type) {
        const container = document.createElement('div');
        container.className = `media-container media-${type}`;
        
        const ext = filename.split('.').pop().toUpperCase();
        const icon = this.getDocumentIcon(ext);
        
        container.innerHTML = `
            <div class="media-document-content">
                <span class="media-icon">${icon}</span>
                <span class="media-name">${this.escapeHtml(filename)}</span>
                <a href="${url}" download="${this.escapeHtml(filename)}" class="media-download">⬇</a>
            </div>
        `;
        
        return container;
    }

    /**
     * Get icon for document type
     */
    getDocumentIcon(ext) {
        const icons = {
            'PDF': '📄',
            'DOC': '📝',
            'DOCX': '📝',
            'XLS': '📊',
            'XLSX': '📊',
            'PPT': '📊',
            'PPTX': '📊',
            'TXT': '📃',
            'VCF': '👤'
        };
        
        return icons[ext] || '📎';
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}