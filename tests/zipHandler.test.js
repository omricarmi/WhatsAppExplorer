import { ZipHandler } from '../src/zipHandler.js';

describe('ZipHandler', () => {
    let handler;
    
    // Mock fflate
    beforeEach(() => {
        handler = new ZipHandler({ maxCacheSize: 3 }); // Small cache for testing
        
        // Mock fflate if not in browser
        if (typeof window !== 'undefined') {
            window.fflate = window.fflate || {
                unzipSync: jasmine.createSpy('unzipSync')
            };
        }
        
        // Mock URL.createObjectURL and revokeObjectURL
        // Return a valid data URL to avoid console errors
        spyOn(URL, 'createObjectURL').and.returnValue('data:application/octet-stream;base64,AA==');
        spyOn(URL, 'revokeObjectURL');
    });

    afterEach(() => {
        handler.clear();
    });

    describe('LRU Cache', () => {
        it('should evict least recently used items', () => {
            // Create a handler with cache size 3
            handler = new ZipHandler({ maxCacheSize: 3 });
            
            // Mock media files
            handler.mediaFiles.set('file1.jpg', new Uint8Array([1]));
            handler.mediaFiles.set('file2.jpg', new Uint8Array([2]));
            handler.mediaFiles.set('file3.jpg', new Uint8Array([3]));
            handler.mediaFiles.set('file4.jpg', new Uint8Array([4]));
            
            // Access files to fill cache
            handler.getMediaURL('file1.jpg');
            handler.getMediaURL('file2.jpg');
            handler.getMediaURL('file3.jpg');
            
            expect(handler.urlCache.size).toBe(3);
            
            // Adding 4th file should evict file1
            handler.getMediaURL('file4.jpg');
            expect(handler.urlCache.has('file1.jpg')).toBe(false);
            expect(handler.urlCache.has('file4.jpg')).toBe(true);
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should update access order on repeated access', () => {
            handler.mediaFiles.set('file1.jpg', new Uint8Array([1]));
            handler.mediaFiles.set('file2.jpg', new Uint8Array([2]));
            handler.mediaFiles.set('file3.jpg', new Uint8Array([3]));
            handler.mediaFiles.set('file4.jpg', new Uint8Array([4]));
            
            // Access in order: 1, 2, 3
            handler.getMediaURL('file1.jpg');
            handler.getMediaURL('file2.jpg');
            handler.getMediaURL('file3.jpg');
            
            // Re-access file1 (moves it to most recently used)
            handler.getMediaURL('file1.jpg');
            
            // Adding file4 should evict file2 (now least recently used)
            handler.getMediaURL('file4.jpg');
            expect(handler.urlCache.has('file1.jpg')).toBe(true);
            expect(handler.urlCache.has('file2.jpg')).toBe(false);
        });

        it('should return cached URL without creating new one', () => {
            handler.mediaFiles.set('file1.jpg', new Uint8Array([1]));
            
            const url1 = handler.getMediaURL('file1.jpg');
            expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
            
            const url2 = handler.getMediaURL('file1.jpg');
            expect(url1).toBe(url2);
            expect(URL.createObjectURL).toHaveBeenCalledTimes(1); // Still only once
        });
    });

    describe('ZIP Loading', () => {
        it('should extract ZIP contents', async () => {
            const mockZipContents = {
                'WhatsApp Chat.txt': new TextEncoder().encode('Chat content'),
                'IMG_001.jpg': new Uint8Array([1, 2, 3]),
                'VID_002.mp4': new Uint8Array([4, 5, 6])
            };
            
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            
            const mockFile = new Blob(['fake zip']);
            const result = await handler.loadZip(mockFile);
            
            expect(result.success).toBe(true);
            expect(result.chatFound).toBe(true);
            expect(result.chatFilename).toBe('WhatsApp Chat.txt');
            expect(result.mediaCount).toBe(2);
            expect(result.mediaFiles).toContain('IMG_001.jpg');
            expect(result.mediaFiles).toContain('VID_002.mp4');
        });

        it('should handle ZIP without chat file', async () => {
            const mockZipContents = {
                'IMG_001.jpg': new Uint8Array([1, 2, 3]),
                'VID_002.mp4': new Uint8Array([4, 5, 6])
            };
            
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            
            const mockFile = new Blob(['fake zip']);
            const result = await handler.loadZip(mockFile);
            
            expect(result.success).toBe(true);
            expect(result.chatFound).toBe(false);
            expect(result.mediaCount).toBe(2);
        });

        it('should handle nested folder structure', async () => {
            const mockZipContents = {
                'WhatsApp/Chat.txt': new TextEncoder().encode('Chat content'),
                'WhatsApp/Media/IMG_001.jpg': new Uint8Array([1, 2, 3])
            };
            
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            
            const mockFile = new Blob(['fake zip']);
            const result = await handler.loadZip(mockFile);
            
            expect(result.chatFilename).toBe('Chat.txt');
            expect(result.mediaFiles).toContain('IMG_001.jpg');
        });

        it('should throw error for invalid file', async () => {
            await expectAsync(handler.loadZip(null))
                .toBeRejectedWithError('Invalid file provided');
            
            await expectAsync(handler.loadZip('not a blob'))
                .toBeRejectedWithError('Invalid file provided');
        });

        it('should clear previous data when loading new ZIP', async () => {
            // Load first ZIP
            window.fflate.unzipSync.and.returnValue({
                'chat1.txt': new TextEncoder().encode('Chat 1')
            });
            await handler.loadZip(new Blob(['zip1']));
            expect(handler.getChatContent()).toBe('Chat 1');
            
            // Load second ZIP
            window.fflate.unzipSync.and.returnValue({
                'chat2.txt': new TextEncoder().encode('Chat 2')
            });
            await handler.loadZip(new Blob(['zip2']));
            expect(handler.getChatContent()).toBe('Chat 2');
        });
    });

    describe('Media File Detection', () => {
        it('should identify media files correctly', () => {
            // Images
            expect(handler.isMediaFile('photo.jpg')).toBe(true);
            expect(handler.isMediaFile('image.png')).toBe(true);
            expect(handler.isMediaFile('animation.gif')).toBe(true);
            
            // Videos
            expect(handler.isMediaFile('video.mp4')).toBe(true);
            expect(handler.isMediaFile('clip.mov')).toBe(true);
            
            // Audio
            expect(handler.isMediaFile('audio.mp3')).toBe(true);
            expect(handler.isMediaFile('voice.opus')).toBe(true);
            
            // Documents
            expect(handler.isMediaFile('document.pdf')).toBe(true);
            expect(handler.isMediaFile('contact.vcf')).toBe(true);
            
            // Non-media
            expect(handler.isMediaFile('script.js')).toBe(false);
            expect(handler.isMediaFile('style.css')).toBe(false);
            expect(handler.isMediaFile('')).toBe(false);
            expect(handler.isMediaFile(null)).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(handler.isMediaFile('PHOTO.JPG')).toBe(true);
            expect(handler.isMediaFile('Video.MP4')).toBe(true);
        });
    });

    describe('MIME Type Detection', () => {
        it('should return correct MIME types', () => {
            expect(handler.getMimeType('photo.jpg')).toBe('image/jpeg');
            expect(handler.getMimeType('video.mp4')).toBe('video/mp4');
            expect(handler.getMimeType('audio.mp3')).toBe('audio/mpeg');
            expect(handler.getMimeType('document.pdf')).toBe('application/pdf');
            expect(handler.getMimeType('unknown.xyz')).toBe('application/octet-stream');
        });
    });

    describe('Media URL Management', () => {
        beforeEach(async () => {
            const mockZipContents = {
                'chat.txt': new TextEncoder().encode('Chat'),
                'photo.jpg': new Uint8Array([1, 2, 3]),
                'video.mp4': new Uint8Array([4, 5, 6])
            };
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            await handler.loadZip(new Blob(['zip']));
        });

        it('should create object URL for existing media', () => {
            const url = handler.getMediaURL('photo.jpg');
            expect(url).toBe('data:application/octet-stream;base64,AA==');
            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should return null for non-existent media', () => {
            const url = handler.getMediaURL('missing.jpg');
            expect(url).toBeNull();
        });

        it('should preload multiple media files', () => {
            const results = handler.preloadMedia(['photo.jpg', 'video.mp4', 'missing.jpg']);
            
            expect(results[0].filename).toBe('photo.jpg');
            expect(results[0].cached).toBe(true);
            expect(results[1].filename).toBe('video.mp4');
            expect(results[1].cached).toBe(true);
            expect(results[2].filename).toBe('missing.jpg');
            expect(results[2].cached).toBe(false);
        });
    });

    describe('Cache Management', () => {
        beforeEach(async () => {
            const mockZipContents = {
                'file1.jpg': new Uint8Array([1]),
                'file2.jpg': new Uint8Array([2]),
                'file3.jpg': new Uint8Array([3]),
                'file4.jpg': new Uint8Array([4])
            };
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            await handler.loadZip(new Blob(['zip']));
        });

        it('should provide cache statistics', () => {
            handler.getMediaURL('file1.jpg');
            handler.getMediaURL('file2.jpg');
            handler.getMediaURL('missing.jpg'); // This doesn't exist
            
            const stats = handler.getCacheStats();
            expect(stats.cacheSize).toBe(2);
            expect(stats.maxCacheSize).toBe(3);
            expect(stats.totalMedia).toBe(4);
            expect(stats.missingFiles).toBe(1);
            expect(stats.cacheUtilization).toBeCloseTo(66.67, 1);
        });

        it('should manually evict from cache', () => {
            handler.getMediaURL('file1.jpg');
            expect(handler.urlCache.has('file1.jpg')).toBe(true);
            
            handler.evictFromCache('file1.jpg');
            expect(handler.urlCache.has('file1.jpg')).toBe(false);
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should clear all URLs on clear()', () => {
            handler.getMediaURL('file1.jpg');
            handler.getMediaURL('file2.jpg');
            handler.getMediaURL('missing.jpg'); // Track a missing file
            
            handler.clear();
            
            expect(handler.urlCache.size).toBe(0);
            expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
            expect(handler.chatContent).toBeNull();
            expect(handler.mediaFiles.size).toBe(0);
            expect(handler.missingFiles.size).toBe(0);
        });
    });

    describe('Utility Methods', () => {
        beforeEach(async () => {
            const mockZipContents = {
                'chat.txt': new TextEncoder().encode('Test chat content'),
                'photo.jpg': new Uint8Array([1, 2, 3]),
                'video.mp4': new Uint8Array([4, 5, 6, 7, 8])
            };
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            await handler.loadZip(new Blob(['zip']));
        });

        it('should return chat content', () => {
            expect(handler.getChatContent()).toBe('Test chat content');
        });

        it('should return chat filename', () => {
            expect(handler.getChatFilename()).toBe('chat.txt');
        });

        it('should check if media exists', () => {
            expect(handler.hasMedia('photo.jpg')).toBe(true);
            expect(handler.hasMedia('missing.jpg')).toBe(false);
        });

        it('should return media list', () => {
            const list = handler.getMediaList();
            expect(list).toContain('photo.jpg');
            expect(list).toContain('video.mp4');
            expect(list.length).toBe(2);
        });

        it('should estimate memory usage', () => {
            const estimate = handler.getMemoryEstimate();
            // Chat content (17 chars * 2 bytes) + photo (3 bytes) + video (5 bytes)
            expect(estimate).toBe(34 + 3 + 5);
        });
    });

    describe('Missing Files Tracking', () => {
        beforeEach(async () => {
            const mockZipContents = {
                'chat.txt': new TextEncoder().encode('Chat'),
                'photo1.jpg': new Uint8Array([1, 2, 3]),
                'photo2.jpg': new Uint8Array([4, 5, 6])
            };
            window.fflate.unzipSync.and.returnValue(mockZipContents);
            await handler.loadZip(new Blob(['zip']));
        });

        it('should track missing files', () => {
            const url = handler.getMediaURL('missing.jpg');
            expect(url).toBeNull();
            expect(handler.missingFiles.has('missing.jpg')).toBe(true);
        });

        it('should not track existing files as missing', () => {
            const url = handler.getMediaURL('photo1.jpg');
            expect(url).toBe('data:application/octet-stream;base64,AA==');
            expect(handler.missingFiles.has('photo1.jpg')).toBe(false);
        });

        it('should warn when too many files are missing', () => {
            spyOn(console, 'warn'); // Suppress console.warn output
            spyOn(window, 'alert'); // Suppress alert popup
            
            // Add many missing files
            for (let i = 0; i < 10001; i++) {
                handler.getMediaURL(`missing${i}.jpg`);
            }
            
            expect(console.warn).toHaveBeenCalledWith(jasmine.stringContaining('10001'));
            expect(window.alert).toHaveBeenCalledWith(jasmine.stringContaining('10001 media files are missing'));
        });

        it('should only alert once', () => {
            spyOn(console, 'warn'); // Suppress console.warn output
            spyOn(window, 'alert'); // Suppress alert popup
            
            // Add many missing files
            for (let i = 0; i < 10005; i++) {
                handler.getMediaURL(`missing${i}.jpg`);
            }
            
            // Only one alert despite multiple files over threshold
            expect(window.alert).toHaveBeenCalledTimes(1);
        });

        it('should not count missing files against LRU cache', () => {
            // Add 3 real files to cache (max is 3)
            handler.getMediaURL('photo1.jpg');
            handler.getMediaURL('photo2.jpg');
            
            // Add missing file - should not affect cache
            handler.getMediaURL('missing.jpg');
            
            // Now add a third real file
            const mockZipContents = {
                'chat.txt': new TextEncoder().encode('Chat'),
                'photo1.jpg': new Uint8Array([1]),
                'photo2.jpg': new Uint8Array([2]),
                'photo3.jpg': new Uint8Array([3])
            };
            handler.mediaFiles.set('photo3.jpg', new Uint8Array([3]));
            handler.getMediaURL('photo3.jpg');
            
            // All 3 real files should be in cache
            expect(handler.urlCache.size).toBe(3);
            expect(handler.missingFiles.size).toBe(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle fflate not loaded', async () => {
            window.fflate = undefined;
            await expectAsync(handler.loadZip(new Blob(['zip'])))
                .toBeRejectedWithError('Failed to load ZIP: fflate library not loaded');
        });

        it('should handle ZIP extraction errors', async () => {
            window.fflate = { unzipSync: jasmine.createSpy('unzipSync') };
            window.fflate.unzipSync.and.throwError('Corrupt ZIP');
            
            await expectAsync(handler.loadZip(new Blob(['bad zip'])))
                .toBeRejectedWithError('Failed to load ZIP: Corrupt ZIP');
        });
    });
});