import { StateManager } from '../src/stateManager.js';

console.log('========================================');
console.log('StateManager Tests - Expected Console Errors:');
console.log('- "Error in test:event subscriber" - Testing error handling');
console.log('- "Failed to save state" - Testing storage errors');

describe('StateManager', () => {
    let stateManager;
    let mockMessages;

    beforeEach(() => {
        stateManager = new StateManager();
        
        // Create mock messages
        mockMessages = [
            {
                date: new Date('2024-01-01T10:00:00'),
                sender: 'Alice',
                text: 'Hello world',
                hasMedia: false,
                mediaType: null,
                isSystem: false
            },
            {
                date: new Date('2024-01-01T10:30:00'),
                sender: 'Bob',
                text: 'Check this photo',
                hasMedia: true,
                mediaType: 'image',
                isSystem: false
            },
            {
                date: new Date('2024-01-02T09:00:00'),
                sender: 'System',
                text: 'Alice added Charlie',
                hasMedia: false,
                mediaType: null,
                isSystem: true
            },
            {
                date: new Date('2024-01-02T09:15:00'),
                sender: 'Charlie',
                text: 'Thanks for adding me',
                hasMedia: false,
                mediaType: null,
                isSystem: false
            },
            {
                date: new Date('2024-01-02T10:00:00'),
                sender: 'Alice',
                text: 'Here is a document',
                hasMedia: true,
                mediaType: 'document',
                isSystem: false
            }
        ];
    });

    describe('Observer Pattern', () => {
        it('should subscribe and emit events', (done) => {
            const callback = jasmine.createSpy('callback');
            
            stateManager.subscribe('test:event', callback);
            stateManager.emit('test:event', { data: 'test' });
            
            expect(callback).toHaveBeenCalledWith({ data: 'test' });
            done();
        });

        it('should return unsubscribe function', () => {
            const callback = jasmine.createSpy('callback');
            
            const unsubscribe = stateManager.subscribe('test:event', callback);
            unsubscribe();
            
            stateManager.emit('test:event', { data: 'test' });
            expect(callback).not.toHaveBeenCalled();
        });

        it('should handle multiple subscribers', () => {
            const callback1 = jasmine.createSpy('callback1');
            const callback2 = jasmine.createSpy('callback2');
            
            stateManager.subscribe('test:event', callback1);
            stateManager.subscribe('test:event', callback2);
            
            stateManager.emit('test:event', { data: 'test' });
            
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
        });

        it('should handle subscriber errors gracefully', () => {
            const goodCallback = jasmine.createSpy('goodCallback');
            const badCallback = jasmine.createSpy('badCallback').and.throwError('Test error');
            
            stateManager.subscribe('test:event', badCallback);
            stateManager.subscribe('test:event', goodCallback);
            
            expect(() => {
                stateManager.emit('test:event', { data: 'test' });
            }).not.toThrow();
            
            expect(goodCallback).toHaveBeenCalled();
        });
    });

    describe('Message Management', () => {
        it('should set messages and emit event', (done) => {
            stateManager.subscribe('messages:changed', (data) => {
                expect(data.messages).toEqual(mockMessages);
                expect(data.totalCount).toBe(5);
                expect(data.filteredCount).toBe(5);
                done();
            });
            
            stateManager.setMessages(mockMessages);
        });

        it('should calculate statistics correctly', () => {
            stateManager.setMessages(mockMessages);
            const stats = stateManager.getStats();
            
            expect(stats.totalMessages).toBe(5);
            expect(stats.mediaCount).toBe(1); // 1 image
            expect(stats.documentCount).toBe(1); // 1 document
            expect(stats.participants).toEqual(['Alice', 'Bob', 'Charlie']);
            expect(stats.dateRange.start).toEqual(new Date('2024-01-01T10:00:00'));
            expect(stats.dateRange.end).toEqual(new Date('2024-01-02T10:00:00'));
        });

        it('should exclude system messages from participants', () => {
            stateManager.setMessages(mockMessages);
            const stats = stateManager.getStats();
            
            expect(stats.participants).not.toContain('System');
        });
    });

    describe('Filtering', () => {
        beforeEach(() => {
            stateManager.setMessages(mockMessages);
        });

        it('should filter by text', (done) => {
            stateManager.subscribe('filter:applied', (data) => {
                // "alice" appears in: 
                // 1. sender: Alice (2 messages)
                // 2. text: "Alice added Charlie" (1 message)
                expect(data.filteredCount).toBe(3);
                expect(data.messages.every(m => 
                    m.text.toLowerCase().includes('alice') || 
                    m.sender.toLowerCase().includes('alice')
                )).toBe(true);
                done();
            });
            
            stateManager.applyFilter({ text: 'alice' });
        });

        it('should filter by media type', (done) => {
            stateManager.subscribe('filter:applied', (data) => {
                expect(data.filteredCount).toBe(1);
                expect(data.messages[0].mediaType).toBe('image');
                done();
            });
            
            stateManager.applyFilter({ type: 'media' });
        });

        it('should filter by document type', (done) => {
            stateManager.subscribe('filter:applied', (data) => {
                expect(data.filteredCount).toBe(1);
                expect(data.messages[0].mediaType).toBe('document');
                done();
            });
            
            stateManager.applyFilter({ type: 'documents' });
        });

        it('should filter by date range', (done) => {
            stateManager.subscribe('filter:applied', (data) => {
                expect(data.filteredCount).toBe(3);
                expect(data.messages.every(m => {
                    const msgDate = new Date(m.date);
                    return msgDate >= new Date('2024-01-02T00:00:00') && 
                           msgDate <= new Date('2024-01-02T23:59:59');
                })).toBe(true);
                done();
            });
            
            stateManager.applyFilter({
                dateRange: {
                    start: new Date('2024-01-02T00:00:00'),
                    end: new Date('2024-01-02T23:59:59')
                }
            });
        });

        it('should combine multiple filters', (done) => {
            stateManager.subscribe('filter:applied', (data) => {
                expect(data.filteredCount).toBe(1);
                expect(data.messages[0].sender).toBe('Alice');
                expect(data.messages[0].hasMedia).toBe(true);
                done();
            });
            
            stateManager.applyFilter({
                text: 'document',
                type: 'documents'
            });
        });

        it('should clear specific filter', () => {
            stateManager.applyFilter({ text: 'test', type: 'media' });
            stateManager.clearFilter('text');
            
            const filter = stateManager.getFilter();
            expect(filter.text).toBe('');
            expect(filter.type).toBe('media'); // Should remain
        });

        it('should clear all filters', () => {
            stateManager.applyFilter({ text: 'test', type: 'media' });
            stateManager.clearFilter();
            
            const filter = stateManager.getFilter();
            expect(filter.text).toBe('');
            expect(filter.type).toBe('all');
            expect(filter.dateRange).toBeNull();
        });
    });


    describe('Storage', () => {
        beforeEach(() => {
            spyOn(localStorage, 'setItem');
            spyOn(localStorage, 'getItem');
            spyOn(localStorage, 'removeItem');
        });

        it('should save state to localStorage', () => {
            stateManager.applyFilter({ text: 'test' });
            
            const result = stateManager.saveToStorage();
            expect(result).toBe(true);
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'wa-viewer-state',
                jasmine.any(String)
            );
        });

        it('should load state from localStorage', () => {
            const savedState = {
                filter: { text: 'saved', type: 'media' }
            };
            
            localStorage.getItem.and.returnValue(JSON.stringify(savedState));
            
            const result = stateManager.loadFromStorage();
            expect(result).toBe(true);
            
            const filter = stateManager.getFilter();
            expect(filter.text).toBe('saved');
            expect(filter.type).toBe('media');
        });

        it('should handle storage errors gracefully', () => {
            localStorage.setItem.and.throwError('Storage full');
            
            const result = stateManager.saveToStorage();
            expect(result).toBe(false);
        });
    });

    describe('State Management', () => {
        it('should clear all state', (done) => {
            stateManager.setMessages(mockMessages);
            stateManager.applyFilter({ text: 'test' });
            
            stateManager.subscribe('state:cleared', () => {
                const messages = stateManager.getAllMessages();
                const filter = stateManager.getFilter();
                const stats = stateManager.getStats();
                
                expect(messages.length).toBe(0);
                expect(filter.text).toBe('');
                expect(stats.totalMessages).toBe(0);
                done();
            });
            
            stateManager.clear();
        });

        it('should get filtered messages', () => {
            stateManager.setMessages(mockMessages);
            stateManager.applyFilter({ text: 'alice' });
            
            const filtered = stateManager.getFilteredMessages();
            expect(filtered.length).toBe(3); // Alice (sender) x2 + "Alice added Charlie" text
        });

        it('should get all messages unfiltered', () => {
            stateManager.setMessages(mockMessages);
            stateManager.applyFilter({ text: 'alice' });
            
            const all = stateManager.getAllMessages();
            expect(all.length).toBe(5);
        });

        it('should provide state summary', () => {
            stateManager.setMessages(mockMessages);
            stateManager.applyFilter({ text: 'test' });
            stateManager.subscribe('test', () => {});
            
            const summary = stateManager.getStateSummary();
            
            expect(summary.totalMessages).toBe(5);
            expect(summary.activeFilters.hasText).toBe(true);
            expect(summary.subscriberCount).toBe(1);
            expect(summary.subscribers).toContain('test');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty messages', () => {
            stateManager.setMessages([]);
            
            const stats = stateManager.getStats();
            expect(stats.totalMessages).toBe(0);
            expect(stats.participants.length).toBe(0);
            expect(stats.dateRange.start).toBeNull();
        });


        it('should handle filter with no matches', (done) => {
            stateManager.setMessages(mockMessages);
            
            stateManager.subscribe('filter:applied', (data) => {
                expect(data.filteredCount).toBe(0);
                expect(data.messages.length).toBe(0);
                done();
            });
            
            stateManager.applyFilter({ text: 'nonexistent' });
        });
    });
});