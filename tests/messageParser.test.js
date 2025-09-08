import { MessageParser } from '../src/messageParser.js';

describe('MessageParser', () => {
    let parser;

    beforeEach(() => {
        parser = new MessageParser();
    });

    describe('Date Parsing', () => {
        it('should parse dates with dots', () => {
            const date = parser.parseDate('31.12.2023', '23:59:30');
            expect(date).toBeDefined();
            expect(date.getFullYear()).toBe(2023);
            expect(date.getMonth()).toBe(11); // December (0-indexed)
            expect(date.getDate()).toBe(31);
            expect(date.getHours()).toBe(23);
            expect(date.getMinutes()).toBe(59);
            expect(date.getSeconds()).toBe(30);
        });

        it('should parse dates with slashes', () => {
            const date = parser.parseDate('1/5/2024', '14:30');
            expect(date).toBeDefined();
            expect(date.getFullYear()).toBe(2024);
            expect(date.getMonth()).toBe(4); // May (0-indexed)
            expect(date.getDate()).toBe(1);
            expect(date.getHours()).toBe(14);
            expect(date.getMinutes()).toBe(30);
        });

        it('should handle 12-hour format with AM/PM', () => {
            const datePM = parser.parseDate('1/1/2024', '3:30 PM');
            expect(datePM.getHours()).toBe(15);
            
            const dateAM = parser.parseDate('1/1/2024', '3:30 AM');
            expect(dateAM.getHours()).toBe(3);
            
            const dateMidnight = parser.parseDate('1/1/2024', '12:00 AM');
            expect(dateMidnight.getHours()).toBe(0);
            
            const dateNoon = parser.parseDate('1/1/2024', '12:00 PM');
            expect(dateNoon.getHours()).toBe(12);
        });

        it('should handle 2-digit years', () => {
            const date2020s = parser.parseDate('1/1/23', '12:00');
            expect(date2020s.getFullYear()).toBe(2023);
            
            const date1990s = parser.parseDate('1/1/99', '12:00');
            expect(date1990s.getFullYear()).toBe(1999);
        });

        it('should return null for invalid dates', () => {
            expect(parser.parseDate('invalid', '12:00')).toBeNull();
            expect(parser.parseDate('1/1/2024', 'invalid')).toBeNull();
            expect(parser.parseDate(null, null)).toBeNull();
        });
    });

    describe('Media Detection', () => {
        it('should detect attached media with tag', () => {
            const result = parser.extractMediaInfo('<attached: photo.jpg> Check this out');
            expect(result.hasMedia).toBe(true);
            expect(result.filename).toBe('photo.jpg');
            expect(result.type).toBe('image');
            expect(result.text).toBe('Check this out');
        });

        it('should detect filename at start of message', () => {
            const result = parser.extractMediaInfo('IMG_1234.jpg This is my photo');
            expect(result.hasMedia).toBe(true);
            expect(result.filename).toBe('IMG_1234.jpg');
            expect(result.type).toBe('image');
            expect(result.text).toBe('This is my photo');
        });

        it('should detect various media types', () => {
            expect(parser.extractMediaInfo('video.mp4').type).toBe('video');
            expect(parser.extractMediaInfo('audio.mp3').type).toBe('audio');
            expect(parser.extractMediaInfo('document.pdf').type).toBe('document');
            expect(parser.extractMediaInfo('contact.vcf').type).toBe('contact');
        });

        it('should detect omitted media', () => {
            const result = parser.extractMediaInfo('<Media omitted>');
            expect(result.hasMedia).toBe(true);
            expect(result.type).toBe('omitted');
            expect(result.filename).toBeNull();
        });

        it('should handle regular text without media', () => {
            const result = parser.extractMediaInfo('Just a regular message');
            expect(result.hasMedia).toBe(false);
            expect(result.filename).toBeNull();
            expect(result.text).toBe('Just a regular message');
        });
    });

    describe('Message Parsing - Strict Mode Only', () => {
        it('should parse bracket format', () => {
            const line = '[1/1/2024, 10:30:45 AM] John Doe: Hello world';
            const result = parser.parseLine(line, 1);
            
            expect(result).toBeDefined();
            expect(result.failed).toBeUndefined();
            expect(result.sender).toBe('John Doe');
            expect(result.text).toBe('Hello world');
            expect(result.isSystem).toBe(false);
            expect(result.date).toBeDefined();
        });

        it('should parse dash format', () => {
            const line = '1/1/2024, 10:30:45 AM - Jane Smith: Hi there';
            const result = parser.parseLine(line, 1);
            
            expect(result).toBeDefined();
            expect(result.failed).toBeUndefined();
            expect(result.sender).toBe('Jane Smith');
            expect(result.text).toBe('Hi there');
            expect(result.isSystem).toBe(false);
        });

        it('should parse system messages', () => {
            const line = '1/1/2024, 10:30:45 AM - Jane added John';
            const result = parser.parseLine(line, 1);
            
            expect(result).toBeDefined();
            expect(result.failed).toBeUndefined();
            expect(result.sender).toBe('System');
            expect(result.text).toBe('Jane added John');
            expect(result.isSystem).toBe(true);
        });

        it('should parse messages with media', () => {
            const line = '[1/1/2024, 10:30 AM] Alice: <attached: photo.jpg> Look at this';
            const result = parser.parseLine(line, 1);
            
            expect(result.hasMedia).toBe(true);
            expect(result.mediaFilename).toBe('photo.jpg');
            expect(result.mediaType).toBe('image');
            expect(result.text).toBe('Look at this');
        });

        it('should mark lines with invalid dates as failed', () => {
            const line = '[invalid-date, 10:30 AM] Alice: Hello';
            const result = parser.parseLine(line, 5);
            
            expect(result.failed).toBe(true);
            expect(result.lineNumber).toBe(5);
            expect(result.reason).toBe('No matching pattern');
        });

        it('should mark lines with unparseable dates as failed', () => {
            const line = '[32/13/2024, 10:30 AM] Alice: Hello'; // Day 32, Month 13 - invalid
            const result = parser.parseLine(line, 5);
            
            expect(result.failed).toBe(true);
            expect(result.lineNumber).toBe(5);
            expect(result.reason).toBe('Invalid date format');
        });

        it('should mark non-matching lines as failed', () => {
            const line = 'This is just random text without proper format';
            const result = parser.parseLine(line, 10);
            
            expect(result.failed).toBe(true);
            expect(result.lineNumber).toBe(10);
            expect(result.reason).toBe('No matching pattern');
        });
    });

    describe('Full Chat Parsing with Failed Lines', () => {
        it('should parse valid messages and collect failed lines', () => {
            const chat = `[1/1/2024, 10:00 AM] Alice: Hello
This line should fail - no date format
[1/1/2024, 10:01 AM] Bob: Hi Alice!
[invalid-date, 10:02 AM] Charlie: This has bad date
[1/1/2024, 10:03 AM] Alice: How are you?`;
            
            const result = parser.parse(chat);
            
            expect(result.messages.length).toBe(3);
            expect(result.messages[0].sender).toBe('Alice');
            expect(result.messages[1].sender).toBe('Bob');
            expect(result.messages[2].text).toBe('How are you?');
            
            expect(result.failedLines.length).toBe(2);
            expect(result.failedLines[0].content).toContain('This line should fail');
            expect(result.failedLines[0].reason).toBe('No matching pattern');
            expect(result.failedLines[1].content).toContain('invalid-date');
            expect(result.failedLines[1].reason).toBe('No matching pattern');
        });

        it('should provide accurate statistics', () => {
            const chat = `[1/1/2024, 10:00 AM] Alice: Hello
Invalid line here
[1/1/2024, 10:01 AM] Bob: <attached: photo.jpg> Check this
1/1/2024, 10:02 AM - System message here
[1/1/2024, 10:03 AM] Charlie: Regular message`;
            
            const result = parser.parse(chat);
            
            expect(result.stats.totalLines).toBe(5);
            expect(result.stats.parsedMessages).toBe(4);
            expect(result.stats.failedLines).toBe(1);
            expect(result.stats.mediaMessages).toBe(1);
            expect(result.stats.systemMessages).toBe(1);
        });

        it('should handle empty input', () => {
            const result = parser.parse('');
            expect(result.messages.length).toBe(0);
            expect(result.failedLines.length).toBe(0);
            expect(result.stats.parsedMessages).toBe(0);
        });

        it('should handle mixed formats', () => {
            const chat = `[1/1/2024, 10:00 AM] Alice: Bracket format
1/1/2024, 10:01 AM - Bob: Dash format
1/1/2024, 10:02 AM - System action happened`;
            
            const result = parser.parse(chat);
            expect(result.messages.length).toBe(3);
            expect(result.messages[0].sender).toBe('Alice');
            expect(result.messages[1].sender).toBe('Bob');
            expect(result.messages[2].isSystem).toBe(true);
        });
    });

    describe('Failed Lines API', () => {
        it('should store and retrieve failed lines', () => {
            const chat = `[1/1/2024, 10:00 AM] Alice: Hello
Invalid line 1
Invalid line 2
[1/1/2024, 10:01 AM] Bob: Hi`;
            
            const result = parser.parse(chat);
            const failedLines = parser.getFailedLines();
            
            expect(failedLines).toEqual(result.failedLines);
            expect(failedLines.length).toBe(2);
            expect(failedLines[0].lineNumber).toBe(2);
            expect(failedLines[1].lineNumber).toBe(3);
        });

    });

    describe('Utility Methods', () => {
        it('should extract participants', () => {
            const messages = [
                { sender: 'Alice', isSystem: false },
                { sender: 'Bob', isSystem: false },
                { sender: 'System', isSystem: true },
                { sender: 'Alice', isSystem: false },
                { sender: 'Charlie', isSystem: false }
            ];
            
            const participants = parser.getParticipants(messages);
            expect(participants).toEqual(['Alice', 'Bob', 'Charlie']);
            expect(participants).not.toContain('System');
        });

        it('should get date range', () => {
            const messages = [
                { date: new Date('2024-01-01T10:00:00') },
                { date: new Date('2024-01-05T15:00:00') },
                { date: new Date('2024-01-03T12:00:00') }
            ];
            
            const range = parser.getDateRange(messages);
            expect(range.start).toEqual(new Date('2024-01-01T10:00:00'));
            expect(range.end).toEqual(new Date('2024-01-05T15:00:00'));
        });

        it('should handle empty messages for date range', () => {
            const range = parser.getDateRange([]);
            expect(range.start).toBeNull();
            expect(range.end).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle messages with colons in text', () => {
            const line = '[1/1/2024, 10:00 AM] Alice: The time is 5:30 PM';
            const result = parser.parseLine(line, 1);
            expect(result.text).toBe('The time is 5:30 PM');
        });

        it('should handle sender names with spaces', () => {
            const line = '[1/1/2024, 10:00 AM] John Smith Jr.: Hello';
            const result = parser.parseLine(line, 1);
            expect(result.sender).toBe('John Smith Jr.');
        });

        it('should handle various date formats', () => {
            const formats = [
                '[1/1/2024, 10:00] Alice: Test',
                '[01/01/2024, 10:00:00] Alice: Test',
                '[1.1.2024, 10:00] Alice: Test',
                '[31.12.2024, 23:59:59] Alice: Test'
            ];
            
            formats.forEach((line, index) => {
                const result = parser.parseLine(line, index + 1);
                expect(result).toBeDefined();
                expect(result.failed).toBeUndefined();
                expect(result.sender).toBe('Alice');
            });
        });

        it('should handle messages with only media', () => {
            const line = '[1/1/2024, 10:00 AM] Alice: photo.jpg';
            const result = parser.parseLine(line, 1);
            expect(result.hasMedia).toBe(true);
            expect(result.text).toBe('');
        });
    });
});