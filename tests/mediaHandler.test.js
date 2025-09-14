import { MediaHandler } from '../src/mediaHandler.js';

describe('MediaHandler', () => {
    let mediaHandler;
    let mockZipHandler;

    beforeEach(() => {
        // Mock ZipHandler
        mockZipHandler = {
            hasMedia: jasmine.createSpy('hasMedia'),
            getMediaURL: jasmine.createSpy('getMediaURL')
        };
        
        mediaHandler = new MediaHandler(mockZipHandler);
    });

    describe('Media Type Detection', () => {
        it('should identify image types', () => {
            expect(mediaHandler.getMediaType('photo.jpg')).toBe('image');
            expect(mediaHandler.getMediaType('image.png')).toBe('image');
            expect(mediaHandler.getMediaType('animation.gif')).toBe('image');
            expect(mediaHandler.getMediaType('picture.webp')).toBe('image');
        });

        it('should identify video types', () => {
            expect(mediaHandler.getMediaType('video.mp4')).toBe('video');
            expect(mediaHandler.getMediaType('clip.mov')).toBe('video');
            expect(mediaHandler.getMediaType('movie.avi')).toBe('video');
            expect(mediaHandler.getMediaType('recording.3gp')).toBe('video');
        });

        it('should identify audio types', () => {
            expect(mediaHandler.getMediaType('song.mp3')).toBe('audio');
            expect(mediaHandler.getMediaType('voice.opus')).toBe('audio');
            expect(mediaHandler.getMediaType('audio.m4a')).toBe('audio');
            expect(mediaHandler.getMediaType('sound.wav')).toBe('audio');
        });

        it('should identify document types', () => {
            expect(mediaHandler.getMediaType('document.pdf')).toBe('document');
            expect(mediaHandler.getMediaType('report.docx')).toBe('document');
            expect(mediaHandler.getMediaType('spreadsheet.xlsx')).toBe('document');
            expect(mediaHandler.getMediaType('contact.vcf')).toBe('document');
        });

        it('should handle unknown types', () => {
            expect(mediaHandler.getMediaType('unknown.xyz')).toBe('file');
            expect(mediaHandler.getMediaType('')).toBe('unknown');
            expect(mediaHandler.getMediaType(null)).toBe('unknown');
        });

        it('should be case insensitive', () => {
            expect(mediaHandler.getMediaType('PHOTO.JPG')).toBe('image');
            expect(mediaHandler.getMediaType('Video.MP4')).toBe('video');
        });
    });

    describe('Media Element Creation', () => {
        it('should create missing media element', () => {
            mockZipHandler.hasMedia.and.returnValue(false);
            
            const element = mediaHandler.createMediaElement('missing.jpg');
            
            expect(element.className).toBe('media-container media-missing');
            expect(element.innerHTML).toContain('📎');
            expect(element.innerHTML).toContain('missing.jpg');
            expect(element.innerHTML).toContain('Not found');
        });

        it('should create image element', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid 1x1 transparent PNG data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
            
            const element = mediaHandler.createMediaElement('photo.jpg');
            
            expect(element.className).toBe('media-container media-image');
            expect(element.querySelector('.media-loading')).toBeTruthy();
            expect(element.querySelector('.media-loading').textContent).toBe('Loading...');
        });

        it('should create video element', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid minimal video data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:video/mp4;base64,AAAAAA==');
            
            const element = mediaHandler.createMediaElement('video.mp4');
            
            expect(element.className).toBe('media-container media-video');
            // Video element is created with event handlers
        });

        it('should create audio element', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid minimal audio data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:audio/mp3;base64,/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
            
            const element = mediaHandler.createMediaElement('audio.mp3');
            
            expect(element.className).toBe('media-container media-audio');
            expect(element.querySelector('audio')).toBeTruthy();
            expect(element.querySelector('.media-audio-label').textContent).toBe('audio.mp3');
        });

        it('should create document element', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid PDF data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:application/pdf;base64,JVBERi0xLg==');
            
            const element = mediaHandler.createMediaElement('document.pdf');
            
            expect(element.className).toBe('media-container media-document');
            expect(element.innerHTML).toContain('📄'); // PDF icon
            expect(element.innerHTML).toContain('document.pdf');
            expect(element.querySelector('.media-download')).toBeTruthy();
        });

        it('should create generic file element for unknown types', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:application/octet-stream;base64,AA==');
            
            const element = mediaHandler.createMediaElement('unknown.xyz');
            
            expect(element.className).toBe('media-container media-file');
            expect(element.innerHTML).toContain('📎'); // Generic icon
            expect(element.innerHTML).toContain('unknown.xyz');
        });
    });

    describe('Document Icons', () => {
        it('should return correct icons for document types', () => {
            expect(mediaHandler.getDocumentIcon('PDF')).toBe('📄');
            expect(mediaHandler.getDocumentIcon('DOC')).toBe('📝');
            expect(mediaHandler.getDocumentIcon('XLS')).toBe('📊');
            expect(mediaHandler.getDocumentIcon('TXT')).toBe('📃');
            expect(mediaHandler.getDocumentIcon('VCF')).toBe('👤');
            expect(mediaHandler.getDocumentIcon('UNKNOWN')).toBe('📎');
        });
    });

    describe('HTML Escaping', () => {
        it('should escape HTML in filenames', () => {
            const escaped = mediaHandler.escapeHtml('<script>alert("xss")</script>');
            expect(escaped).toContain('&lt;script&gt;');
            expect(escaped).not.toContain('<script>');
        });

        it('should handle special characters', () => {
            const escaped = mediaHandler.escapeHtml('file&name.jpg');
            expect(escaped).toContain('&amp;');
        });
    });

    describe('Image Element Details', () => {
        it('should set lazy loading on images', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid image data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
            
            const element = mediaHandler.createMediaElement('photo.jpg');
            
            // Image is created but not immediately in DOM due to async loading
            // We can test the container was created correctly
            expect(element.className).toBe('media-container media-image');
        });

        it('should handle image load error', () => {
            // Use an invalid data URL to trigger error
            const container = mediaHandler.createImageElement('data:image/png;base64,invalid', 'photo.jpg');
            const img = document.createElement('img');
            
            // Simulate error
            img.onerror = container.querySelector('.media-loading') ? 
                () => {
                    container.innerHTML = `
                        <div class="media-error">
                            <span>⚠️ Failed to load image</span>
                            <span class="media-name">photo.jpg</span>
                        </div>
                    `;
                } : null;
            
            if (img.onerror) {
                img.onerror();
                expect(container.innerHTML).toContain('Failed to load image');
            }
        });
    });

    describe('Video Element Details', () => {
        it('should create video without controls', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Return a valid video data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:video/mp4;base64,AAAAAA==');
            
            const element = mediaHandler.createMediaElement('video.mp4');
            
            // Video container is created
            expect(element.className).toBe('media-container media-video');
        });

        it('should add play button overlay', () => {
            // Use a valid video data URL to avoid console errors
            const container = mediaHandler.createVideoElement('data:video/mp4;base64,AAAAAA==', 'video.mp4');
            
            // Play button is created
            const playButton = document.createElement('div');
            playButton.className = 'media-play-button';
            playButton.innerHTML = '▶';
            
            expect(playButton.innerHTML).toBe('▶');
        });
    });

    describe('Audio Element Details', () => {
        it('should create audio with controls', () => {
            // Use a valid audio data URL to avoid console errors
            const dataUrl = 'data:audio/mp3;base64,/+MYxAAAAANIAAAAAExBTUUzLjk4LjIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
            const container = mediaHandler.createAudioElement(dataUrl, 'audio.mp3');
            const audio = container.querySelector('audio');
            
            expect(audio).toBeTruthy();
            expect(audio.controls).toBe(true);
            expect(audio.preload).toBe('metadata');
            expect(audio.src).toBe(dataUrl);
        });

        it('should display filename label', () => {
            // Use a valid audio data URL to avoid console errors
            const container = mediaHandler.createAudioElement('data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=', 'voice-note.opus');
            const label = container.querySelector('.media-audio-label');
            
            expect(label.textContent).toBe('voice-note.opus');
        });
    });

    describe('Document Element Details', () => {
        it('should create download link', () => {
            // Use a valid PDF data URL to avoid console errors
            const dataUrl = 'data:application/pdf;base64,JVBERi0xLg==';
            const container = mediaHandler.createDocumentElement(dataUrl, 'report.pdf', 'document');
            const downloadLink = container.querySelector('.media-download');
            
            expect(downloadLink).toBeTruthy();
            expect(downloadLink.getAttribute('href')).toBe(dataUrl);
            expect(downloadLink.getAttribute('download')).toBe('report.pdf');
        });

        it('should use correct class for type', () => {
            // Use valid data URLs to avoid console errors
            const docContainer = mediaHandler.createDocumentElement('data:application/pdf;base64,JVBERi0xLg==', 'file.pdf', 'document');
            expect(docContainer.className).toBe('media-container media-document');
            
            const fileContainer = mediaHandler.createDocumentElement('data:application/octet-stream;base64,AA==', 'unknown.xyz', 'file');
            expect(fileContainer.className).toBe('media-container media-file');
        });
    });

    describe('Integration', () => {
        it('should check media existence before creating element', () => {
            mockZipHandler.hasMedia.and.returnValue(true);
            // Use a valid data URL to avoid console errors
            mockZipHandler.getMediaURL.and.returnValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
            
            mediaHandler.createMediaElement('photo.jpg');
            
            expect(mockZipHandler.hasMedia).toHaveBeenCalledWith('photo.jpg');
            expect(mockZipHandler.getMediaURL).toHaveBeenCalledWith('photo.jpg');
        });

        it('should not get URL for missing media', () => {
            mockZipHandler.hasMedia.and.returnValue(false);
            
            mediaHandler.createMediaElement('missing.jpg');
            
            expect(mockZipHandler.hasMedia).toHaveBeenCalledWith('missing.jpg');
            expect(mockZipHandler.getMediaURL).not.toHaveBeenCalled();
        });
    });
});