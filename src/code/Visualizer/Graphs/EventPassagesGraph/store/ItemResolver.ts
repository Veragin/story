import { itemInfo } from 'data/items/itemInfo';
import { TItemId, TItem, TItemPartial } from 'types/TItem';

export class ItemResolver {
    // Cache for processed items
    private static itemCache = new Map<TItemId, any>();

    /**
     * Gets a specific item by ID
     */
    static getItem<I extends TItemId>(itemId: I): TItem<I> {
        // Check cache first
        if (this.itemCache.has(itemId)) {
            return this.itemCache.get(itemId) as TItem<I>;
        }

        // Check if item exists in itemInfo
        if (itemInfo[itemId]) {
            const item = {
                id: itemId,
                amount: 1, // default amount
                ...itemInfo[itemId]
            } as TItem<I>;
            this.itemCache.set(itemId, item);
            return item;
        }

        throw new Error(`Item '${itemId}' not found`);
    }

    /**
     * Gets all available items
     */
    static getAllItems(): TItem<TItemId>[] {
        return Object.keys(itemInfo).map(itemId => 
            this.getItem(itemId as TItemId)
        );
    }

    /**
     * Gets all available item IDs
     */
    static getAvailableItemIds(): TItemId[] {
        return Object.keys(itemInfo) as TItemId[];
    }

    /**
     * Gets items by type
     */
    static getItemsByType(type: string): TItem<TItemId>[] {
        const allItems = this.getAllItems();
        return allItems.filter(item => item.type === type);
    }

    /**
     * Gets items formatted for dropdown/select components
     */
    static getItemsForSelect(): Array<{ value: TItemId; label: string; type: string }> {
        return this.getAllItems().map(item => ({
            value: item.id,
            label: item.name,
            type: item.type
        }));
    }

    /**
     * Gets items by type formatted for dropdown/select components
     */
    static getItemsByTypeForSelect(type: string): Array<{ value: TItemId; label: string }> {
        return this.getItemsByType(type).map(item => ({
            value: item.id,
            label: item.name
        }));
    }

    /**
     * Gets tools (items with type 'tool')
     */
    static getTools(): TItem<TItemId>[] {
        return this.getItemsByType('tool');
    }

    /**
     * Gets tools formatted for dropdown/select components
     */
    static getToolsForSelect(): Array<{ value: TItemId; label: string }> {
        return this.getTools().map(item => ({
            value: item.id,
            label: item.name
        }));
    }

    /**
     * Gets weapons (items with type 'weapon')
     */
    static getWeapons(): TItem<TItemId>[] {
        return this.getItemsByType('weapon');
    }

    /**
     * Gets resources (items with type 'resource')
     */
    static getResources(): TItem<TItemId>[] {
        return this.getItemsByType('resource');
    }

    /**
     * Gets food items (items with type 'food')
     */
    static getFood(): TItem<TItemId>[] {
        return this.getItemsByType('food');
    }

    /**
     * Gets value items (items with type 'value')
     */
    static getValueItems(): TItem<TItemId>[] {
        return this.getItemsByType('value');
    }

    /**
     * Checks if an item exists
     */
    static itemExists(itemId: TItemId): boolean {
        return itemInfo[itemId] !== undefined;
    }

    /**
     * Searches items by name (case-insensitive)
     */
    static searchItems(searchTerm: string): TItem<TItemId>[] {
        const allItems = this.getAllItems();
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return allItems.filter(item => 
            item.name.toLowerCase().includes(lowerSearchTerm) ||
            item.id.toLowerCase().includes(lowerSearchTerm) ||
            item.type.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Gets item details with additional metadata
     */
    static getItemDetails<I extends TItemId>(itemId: I): {
        item: TItem<I>;
        hasSpecialProperties: boolean;
        specialProperties: string[];
    } | null {
        if (!this.itemExists(itemId)) {
            return null;
        }

        const item = this.getItem(itemId);
        const baseProperties = ['id', 'name', 'type', 'amount'];
        const allProperties = Object.keys(item);
        const specialProperties = allProperties.filter(prop => !baseProperties.includes(prop));

        return {
            item,
            hasSpecialProperties: specialProperties.length > 0,
            specialProperties
        };
    }

    /**
     * Creates an item with specified amount
     */
    static createItemWithAmount<I extends TItemId>(itemId: I, amount: number): TItem<I> {
        const baseItem = this.getItem(itemId);
        return {
            ...baseItem,
            amount: Math.max(0, Math.floor(amount))
        };
    }

    /**
     * Gets item statistics
     */
    static getItemStats(): {
        totalItems: number;
        itemsByType: { [type: string]: number };
        itemsWithSpecialProperties: number;
    } {
        const allItems = this.getAllItems();
        
        // Count items by type
        const itemsByType: { [type: string]: number } = {};
        allItems.forEach(item => {
            itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
        });

        // Count items with special properties
        const itemsWithSpecialProperties = allItems.filter(item => {
            const baseProperties = ['id', 'name', 'type', 'amount'];
            const allProperties = Object.keys(item);
            return allProperties.some(prop => !baseProperties.includes(prop));
        }).length;
        
        return {
            totalItems: allItems.length,
            itemsByType,
            itemsWithSpecialProperties
        };
    }

    /**
     * Validates item structure
     */
    static validateItem<I extends TItemId>(itemId: I): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!this.itemExists(itemId)) {
            errors.push(`Item '${itemId}' does not exist`);
            return { isValid: false, errors, warnings };
        }

        const item = this.getItem(itemId);
        
        if (!item.name || (typeof item.name === 'string' && !item.name.trim())) {
            errors.push(`Item '${itemId}' has no name`);
        }

        if (!item.type) {
            errors.push(`Item '${itemId}' has no type specified`);
        }

        if (item.amount < 0) {
            warnings.push(`Item '${itemId}' has negative amount`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Preloads all items into cache
     */
    static preloadAllItems(): void {
        const allItemIds = this.getAvailableItemIds();
        allItemIds.forEach(itemId => {
            this.getItem(itemId); // This will cache the item
        });
    }

    /**
     * Clears the item cache
     */
    static clearCache(): void {
        this.itemCache.clear();
    }

    /**
     * Gets items grouped by type for UI organization
     */
    static getItemsGroupedByType(): { [type: string]: TItem<TItemId>[] } {
        const allItems = this.getAllItems();
        const grouped: { [type: string]: TItem<TItemId>[] } = {};
        
        allItems.forEach(item => {
            if (!grouped[item.type]) {
                grouped[item.type] = [];
            }
            grouped[item.type].push(item);
        });
        
        return grouped;
    }

    /**
     * Formats item type name for display
     */
    static formatItemType(type: string): string {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
}