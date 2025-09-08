/**
 * StateManager - Simple state management with observer pattern
 * Handles messages, filtering, and UI state
 */
export class StateManager {
    constructor() {
        this.state = {
            messages: [],
            filteredMessages: [],
            filter: {
                text: '',
                type: 'all', // all, media, documents
                dateRange: null
            },
            stats: {
                totalMessages: 0,
                mediaCount: 0,
                documentCount: 0,
                participants: [],
                dateRange: { start: null, end: null }
            }
        };
        
        // Event subscribers: Map<eventName, Set<callback>>
        this.subscribers = new Map();
    }

    /**
     * Subscribe to state changes
     * Returns unsubscribe function
     */
    subscribe(event, callback) {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        
        this.subscribers.get(event).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(event);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(event);
                }
            }
        };
    }

    /**
     * Emit event to all subscribers
     */
    emit(event, data) {
        const callbacks = this.subscribers.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} subscriber:`, error);
                }
            });
        }
    }

    /**
     * Set messages and calculate stats
     */
    setMessages(messages) {
        this.state.messages = messages;
        
        // Calculate stats once
        this.state.stats = this.calculateStats(messages);
        
        // Apply current filter
        this.state.filteredMessages = this.filterMessages(messages, this.state.filter);
        
        // Emit single event with all needed data
        this.emit('messages:changed', {
            messages: this.state.filteredMessages,
            stats: this.state.stats,
            totalCount: this.state.messages.length,
            filteredCount: this.state.filteredMessages.length
        });
    }

    /**
     * Apply filter to messages
     */
    applyFilter(filter) {
        // Update filter state
        this.state.filter = { ...this.state.filter, ...filter };
        
        // Filter messages
        this.state.filteredMessages = this.filterMessages(this.state.messages, this.state.filter);
        
        // Emit filter applied event
        this.emit('filter:applied', {
            messages: this.state.filteredMessages,
            filter: this.state.filter,
            totalCount: this.state.messages.length,
            filteredCount: this.state.filteredMessages.length
        });
    }

    /**
     * Filter messages based on criteria
     */
    filterMessages(messages, filter) {
        let filtered = messages;
        
        // Text filter
        if (filter.text) {
            const searchText = filter.text.toLowerCase();
            filtered = filtered.filter(msg => 
                msg.text.toLowerCase().includes(searchText) ||
                msg.sender.toLowerCase().includes(searchText)
            );
        }
        
        // Type filter
        if (filter.type !== 'all') {
            if (filter.type === 'media') {
                filtered = filtered.filter(msg => 
                    msg.hasMedia && ['image', 'video', 'audio'].includes(msg.mediaType)
                );
            } else if (filter.type === 'documents') {
                filtered = filtered.filter(msg => 
                    msg.hasMedia && ['document', 'file'].includes(msg.mediaType)
                );
            }
        }
        
        // Date range filter
        if (filter.dateRange) {
            const { start, end } = filter.dateRange;
            filtered = filtered.filter(msg => {
                if (!msg.date) return false;
                return msg.date >= start && msg.date <= end;
            });
        }
        
        return filtered;
    }

    /**
     * Calculate statistics from messages
     */
    calculateStats(messages) {
        const stats = {
            totalMessages: messages.length,
            mediaCount: 0,
            documentCount: 0,
            participants: new Set(),
            dateRange: { start: null, end: null }
        };
        
        for (const msg of messages) {
            // Count media types
            if (msg.hasMedia) {
                if (['image', 'video', 'audio'].includes(msg.mediaType)) {
                    stats.mediaCount++;
                } else if (['document', 'file'].includes(msg.mediaType)) {
                    stats.documentCount++;
                }
            }
            
            // Collect participants
            if (!msg.isSystem && msg.sender !== 'System') {
                stats.participants.add(msg.sender);
            }
            
            // Track date range
            if (msg.date) {
                if (!stats.dateRange.start || msg.date < stats.dateRange.start) {
                    stats.dateRange.start = msg.date;
                }
                if (!stats.dateRange.end || msg.date > stats.dateRange.end) {
                    stats.dateRange.end = msg.date;
                }
            }
        }
        
        // Convert Set to sorted array
        stats.participants = Array.from(stats.participants).sort();
        
        return stats;
    }

    /**
     * Get current filtered messages
     */
    getFilteredMessages() {
        return this.state.filteredMessages;
    }

    /**
     * Get all messages (unfiltered)
     */
    getAllMessages() {
        return this.state.messages;
    }

    /**
     * Get current filter
     */
    getFilter() {
        return { ...this.state.filter };
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.state.stats };
    }



    /**
     * Clear specific filter
     */
    clearFilter(filterType) {
        if (filterType === 'text') {
            this.applyFilter({ text: '' });
        } else if (filterType === 'type') {
            this.applyFilter({ type: 'all' });
        } else if (filterType === 'dateRange') {
            this.applyFilter({ dateRange: null });
        } else {
            // Clear all filters
            this.applyFilter({ text: '', type: 'all', dateRange: null });
        }
    }

    /**
     * Save state to localStorage
     */
    saveToStorage() {
        try {
            const stateToSave = {
                filter: this.state.filter
            };
            localStorage.setItem('wa-viewer-state', JSON.stringify(stateToSave));
            return true;
        } catch (error) {
            console.error('Failed to save state:', error);
            return false;
        }
    }

    /**
     * Load state from localStorage
     */
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('wa-viewer-state');
            if (saved) {
                const stateToLoad = JSON.parse(saved);
                if (stateToLoad.filter) {
                    this.state.filter = { ...this.state.filter, ...stateToLoad.filter };
                }
                return true;
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
        return false;
    }

    /**
     * Clear all state
     */
    clear() {
        this.state = {
            messages: [],
            filteredMessages: [],
            filter: {
                text: '',
                type: 'all',
                dateRange: null
            },
            stats: {
                totalMessages: 0,
                mediaCount: 0,
                documentCount: 0,
                participants: [],
                dateRange: { start: null, end: null }
            }
        };
        
        this.emit('state:cleared', null);
    }

    /**
     * Get state summary for debugging
     */
    getStateSummary() {
        return {
            totalMessages: this.state.messages.length,
            filteredMessages: this.state.filteredMessages.length,
            activeFilters: {
                hasText: !!this.state.filter.text,
                type: this.state.filter.type,
                hasDateRange: !!this.state.filter.dateRange
            },
            subscriberCount: this.subscribers.size,
            subscribers: Array.from(this.subscribers.keys())
        };
    }
}