/**
 * MessageParser - Parses WhatsApp chat export formats
 * Strict parsing only - lines that don't match patterns are collected as failed lines
 */
export class MessageParser {
    constructor() {
        this.failedLines = [];
        this.patterns = {
            // [1/1/2024, 10:30:45 AM] John Doe: message
            bracket: /^\[(\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+([^:]+?):\s*(.*)/,
            // 1/1/2024, 10:30:45 AM - John Doe: message
            dash: /^(\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+?):\s*(.*)/,
            // System messages: 1/1/2024, 10:30:45 AM - System action
            systemDash: /^(\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*(.*)/,
            // Media attachment patterns
            attachment: /<attached:\s*([^>]+)>/,
            mediaOmitted: /(<Media omitted>|image omitted|video omitted|audio omitted|document omitted|Contact card omitted|Location: https:\/\/maps\.google\.com)/i
        };
    }

    /**
     * Parse a date and time string into a Date object
     */
    parseDate(dateStr, timeStr) {
        try {
            // Split date by . or /
            const dateParts = dateStr.split(/[/.]/);
            const timeParts = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]M))?/);
            
            if (!dateParts || dateParts.length < 3 || !timeParts) {
                return null;
            }

            let [day, month, year] = dateParts.map(p => parseInt(p, 10));
            
            // Handle 2-digit years
            if (year < 100) {
                year += year < 50 ? 2000 : 1900;
            }
            
            let hours = parseInt(timeParts[1], 10);
            const minutes = parseInt(timeParts[2], 10);
            const seconds = timeParts[3] ? parseInt(timeParts[3], 10) : 0;
            const period = timeParts[4];
            
            // Handle 12-hour format
            if (period) {
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
            }
            
            const date = new Date(year, month - 1, day, hours, minutes, seconds);
            
            // Check if date is valid and components match (no rollover)
            if (isNaN(date.getTime()) || 
                date.getFullYear() !== year ||
                date.getMonth() !== month - 1 ||
                date.getDate() !== day) {
                return null;
            }
            
            return date;
        } catch (e) {
            return null;
        }
    }

    /**
     * Extract media information from message text
     */
    extractMediaInfo(text) {
        // Check for explicit attachment tag
        const attachmentMatch = text.match(this.patterns.attachment);
        if (attachmentMatch) {
            const filename = attachmentMatch[1].trim();
            return {
                hasMedia: true,
                filename,
                type: this.getMediaType(filename),
                text: text.replace(this.patterns.attachment, '').trim()
            };
        }

        // Check for filename at start of message
        const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|3gp|mov|avi|mkv|webm|opus|mp3|aac|m4a|wav|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|vcf)$/i;
        const filenamePattern = /^([\w\-]+(?:\s+[\w\-]+)*\.\w{2,4})(?:\s|$)/;
        const match = text.match(filenamePattern);
        
        if (match && mediaExtensions.test(match[1])) {
            return {
                hasMedia: true,
                filename: match[1],
                type: this.getMediaType(match[1]),
                text: text.substring(match[1].length).trim()
            };
        }

        // Check for omitted media
        if (this.patterns.mediaOmitted.test(text)) {
            return {
                hasMedia: true,
                filename: null,
                type: 'omitted',
                text
            };
        }

        return {
            hasMedia: false,
            filename: null,
            type: null,
            text
        };
    }

    /**
     * Determine media type from filename
     */
    getMediaType(filename) {
        if (!filename) return 'omitted';
        const ext = filename.split('.').pop().toLowerCase();
        
        const types = {
            // Images
            jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
            // Videos
            mp4: 'video', '3gp': 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
            // Audio
            opus: 'audio', mp3: 'audio', aac: 'audio', m4a: 'audio', wav: 'audio',
            // Documents
            pdf: 'document', doc: 'document', docx: 'document',
            xls: 'document', xlsx: 'document', ppt: 'document', pptx: 'document',
            txt: 'document',
            // Contacts
            vcf: 'contact'
        };
        
        return types[ext] || 'file';
    }

    /**
     * Parse a single line of chat
     */
    parseLine(line, lineNumber) {
        line = line.trim();
        if (!line) return null;

        // Try bracket format first
        let match = line.match(this.patterns.bracket);
        if (match) {
            const date = this.parseDate(match[1], match[2]);
            if (!date) {
                // Invalid date - this is a failed line
                return { failed: true, lineNumber, line, reason: 'Invalid date format' };
            }
            
            const mediaInfo = this.extractMediaInfo(match[4]);
            return {
                date,
                sender: match[3].trim(),
                text: mediaInfo.text,
                isSystem: false,
                hasMedia: mediaInfo.hasMedia,
                mediaType: mediaInfo.type,
                mediaFilename: mediaInfo.filename,
                raw: line
            };
        }

        // Try dash format
        match = line.match(this.patterns.dash);
        if (match) {
            const date = this.parseDate(match[1], match[2]);
            if (!date) {
                return { failed: true, lineNumber, line, reason: 'Invalid date format' };
            }
            
            const mediaInfo = this.extractMediaInfo(match[4]);
            return {
                date,
                sender: match[3].trim(),
                text: mediaInfo.text,
                isSystem: false,
                hasMedia: mediaInfo.hasMedia,
                mediaType: mediaInfo.type,
                mediaFilename: mediaInfo.filename,
                raw: line
            };
        }

        // Try system message format
        match = line.match(this.patterns.systemDash);
        if (match) {
            // Check if this is actually a system message (no sender with colon)
            if (!match[3].includes(':')) {
                const date = this.parseDate(match[1], match[2]);
                if (!date) {
                    return { failed: true, lineNumber, line, reason: 'Invalid date format' };
                }
                
                return {
                    date,
                    sender: 'System',
                    text: match[3].trim(),
                    isSystem: true,
                    hasMedia: false,
                    mediaType: null,
                    mediaFilename: null,
                    raw: line
                };
            }
        }

        // Line doesn't match any pattern - it's a failed line
        return { failed: true, lineNumber, line, reason: 'No matching pattern' };
    }

    /**
     * Parse complete chat content
     */
    parse(content) {
        const lines = content.split('\n');
        const messages = [];
        this.failedLines = [];
        
        const stats = {
            totalLines: lines.length,
            parsedMessages: 0,
            failedLines: 0,
            emptyLines: 0,
            mediaMessages: 0,
            systemMessages: 0
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (!line) {
                stats.emptyLines++;
                continue;
            }
            
            const parsed = this.parseLine(line, i + 1);
            
            if (!parsed) {
                stats.emptyLines++;
                continue;
            }
            
            if (parsed.failed) {
                this.failedLines.push({
                    lineNumber: parsed.lineNumber,
                    content: parsed.line,
                    reason: parsed.reason
                });
                stats.failedLines++;
            } else {
                messages.push(parsed);
                stats.parsedMessages++;
                
                if (parsed.hasMedia) stats.mediaMessages++;
                if (parsed.isSystem) stats.systemMessages++;
            }
        }

        return { 
            messages, 
            failedLines: this.failedLines,
            stats 
        };
    }

    /**
     * Get failed lines for debugging
     */
    getFailedLines() {
        return this.failedLines;
    }

    /**
     * Get unique participants from messages
     */
    getParticipants(messages) {
        const participants = new Set();
        messages.forEach(msg => {
            if (!msg.isSystem && msg.sender !== 'System') {
                participants.add(msg.sender);
            }
        });
        return Array.from(participants).sort();
    }

    /**
     * Get date range from messages
     */
    getDateRange(messages) {
        if (!messages.length) return { start: null, end: null };
        
        let start = messages[0].date;
        let end = messages[0].date;
        
        messages.forEach(msg => {
            if (msg.date) {
                if (msg.date < start) start = msg.date;
                if (msg.date > end) end = msg.date;
            }
        });
        
        return { start, end };
    }
}