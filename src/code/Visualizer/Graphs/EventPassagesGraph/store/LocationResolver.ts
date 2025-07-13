import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';
import { register } from 'data/register';
import { TLocation, TLocationId } from 'types/TLocation';

export class LocationResolver {
    // Cache is used to avoid repeated expensive operations like dynamic imports or complex transformations
    private static locationCache = new Map<TLocationId, TLocation<any>>();

    /**
     * Resolves and returns a specific location by ID
     */
    static getLocation<L extends TLocationId>(
        locationId: L,
        worldState?: TWorldState,
        engine?: Engine
    ): TLocation<L> {
        // Check cache first
        if (this.locationCache.has(locationId)) {
            return this.locationCache.get(locationId) as TLocation<L>;
        }

        // Check if location exists in register
        if (register.locations[locationId]) {
            const location = register.locations[locationId] as TLocation<L>;
            this.locationCache.set(locationId, location);
            return location;
        }

        throw new Error(`Location '${locationId}' not found`);
    }

    /**
     * Gets all available locations
     */
    static getAllLocations(): TLocation<TLocationId>[] {
        return Object.keys(register.locations).map(locationId => 
            this.getLocation(locationId as TLocationId)
        );
    }

    /**
     * Gets all available location IDs
     */
    static getAvailableLocationIds(): TLocationId[] {
        return Object.keys(register.locations) as TLocationId[];
    }

    /**
     * Checks if a location exists
     */
    static locationExists(locationId: TLocationId): boolean {
        return locationId in register.locations;
    }

    /**
     * Searches locations by name or description (case-insensitive)
     */
    static searchLocations(searchTerm: string): TLocation<TLocationId>[] {
        const allLocations = this.getAllLocations();
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        return allLocations.filter(location => 
            location.name.toLowerCase().includes(lowerSearchTerm) ||
            location.description.toLowerCase().includes(lowerSearchTerm) ||
            location.id.toLowerCase().includes(lowerSearchTerm)
        );
    }

    /**
     * Gets locations formatted for dropdown/select components
     */
    static getLocationsForSelect(): Array<{ value: TLocationId; label: string }> {
        return this.getAllLocations().map(location => ({
            value: location.id,
            label: location.name
        }));
    }

    /**
     * Gets location by name (case-insensitive)
     */
    static getLocationByName(locationName: string): TLocation<TLocationId> | null {
        const allLocations = this.getAllLocations();
        return allLocations.find(location => 
            location.name.toLowerCase() === locationName.toLowerCase()
        ) || null;
    }

    /**
     * Gets multiple locations by IDs
     */
    static getMultipleLocations<L extends TLocationId>(locationIds: L[]): TLocation<L>[] {
        return locationIds.map(id => this.getLocation(id));
    }

    /**
     * Gets connected locations from a location
     */
    static getConnectedLocations<L extends TLocationId>(locationId: L): TLocation<TLocationId>[] {
        const location = this.getLocation(locationId);
        if (!location.sublocations) return [];
        
        return location.sublocations;
    }

    /**
     * Gets locations by map ID
     */
    static getLocationsByMapId(mapId: string): TLocation<TLocationId>[] {
        const allLocations = this.getAllLocations();
        return allLocations.filter(location => location.mapId === mapId);
    }

    /**
     * Gets locations that have a specific character
     */
    static getLocationsByCharacterName(characterName: string): TLocation<TLocationId>[] {
        const allLocations = this.getAllLocations();
        return allLocations.filter(location => 
            location.localCharacters.some(character => 
                character.name.toLowerCase() === characterName.toLowerCase()
            )
        );
    }

    /**
     * Gets all local characters across all locations
     */
    static getAllLocalCharacters(): Array<{ 
        character: { name: string; description: string }; 
        locationId: TLocationId;
        locationName: string;
    }> {
        const allLocations = this.getAllLocations();
        const characters: Array<{ 
            character: { name: string; description: string }; 
            locationId: TLocationId;
            locationName: string;
        }> = [];

        allLocations.forEach(location => {
            location.localCharacters.forEach(character => {
                characters.push({
                    character,
                    locationId: location.id,
                    locationName: location.name
                });
            });
        });

        return characters;
    }

    /**
     * Gets locations that have sublocations
     */
    static getParentLocations(): TLocation<TLocationId>[] {
        const allLocations = this.getAllLocations();
        return allLocations.filter(location => 
            location.sublocations && location.sublocations.length > 0
        );
    }

    /**
     * Preloads all locations into cache (useful for performance)
     */
    static preloadAllLocations(): void {
        const allLocationIds = this.getAvailableLocationIds();
        allLocationIds.forEach(locationId => {
            this.getLocation(locationId); // This will cache the location
        });
    }

    /**
     * Clears the location cache (useful for hot reloading in development)
     */
    static clearCache(): void {
        this.locationCache.clear();
    }

    /**
     * Gets location statistics
     */
    static getLocationStats(): {
        totalLocations: number;
        locationsByMapId: { [mapId: string]: number };
        locationsWithSublocations: number;
        averageCharactersPerLocation: number;
        totalCharacters: number;
    } {
        const allLocations = this.getAllLocations();
        
        // Count locations by map ID
        const locationsByMapId: { [mapId: string]: number } = {};
        let locationsWithSublocations = 0;
        let totalCharacters = 0;
        
        allLocations.forEach(location => {
            // Count by map ID
            const mapId = location.mapId || 'no-map';
            locationsByMapId[mapId] = (locationsByMapId[mapId] || 0) + 1;
            
            // Count sublocations
            if (location.sublocations && location.sublocations.length > 0) {
                locationsWithSublocations++;
            }
            
            // Count characters
            totalCharacters += location.localCharacters.length;
        });
        
        return {
            totalLocations: allLocations.length,
            locationsByMapId,
            locationsWithSublocations,
            averageCharactersPerLocation: allLocations.length > 0 ? totalCharacters / allLocations.length : 0,
            totalCharacters
        };
    }

    /**
     * Validates location structure
     */
    static validateLocation<L extends TLocationId>(locationId: L): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!this.locationExists(locationId)) {
            errors.push(`Location '${locationId}' does not exist`);
            return { isValid: false, errors, warnings };
        }

        const location = this.getLocation(locationId);
        
        if (!location.name?.trim()) {
            errors.push(`Location '${locationId}' has no name`);
        }

        if (!location.description?.trim()) {
            warnings.push(`Location '${locationId}' has no description`);
        }

        if (!location.localCharacters || location.localCharacters.length === 0) {
            warnings.push(`Location '${locationId}' has no local characters`);
        }

        // Validate local characters structure
        if (location.localCharacters) {
            location.localCharacters.forEach((character, index) => {
                if (!character.name?.trim()) {
                    errors.push(`Location '${locationId}' has character at index ${index} with no name`);
                }
                if (!character.description?.trim()) {
                    warnings.push(`Location '${locationId}' has character '${character.name}' with no description`);
                }
            });
        }

        // Validate sublocations exist if referenced
        if (location.sublocations) {
            location.sublocations.forEach((sublocation, index) => {
                if (!this.locationExists(sublocation.id)) {
                    errors.push(`Location '${locationId}' references non-existent sublocation '${sublocation.id}' at index ${index}`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Gets locations that are connected to the specified location
     */
    static getRelatedLocations<L extends TLocationId>(locationId: L): TLocation<TLocationId>[] {
        return this.getConnectedLocations(locationId);
    }

    /**
     * Finds the shortest path between two locations (basic BFS implementation using sublocations)
     */
    static findPath<L1 extends TLocationId, L2 extends TLocationId>(
        fromLocationId: L1, 
        toLocationId: L2
    ): TLocationId[] | null {
        if ((fromLocationId as TLocationId) === (toLocationId as TLocationId)) return [fromLocationId];
        if (!this.locationExists(fromLocationId) || !this.locationExists(toLocationId)) return null;

        const visited = new Set<TLocationId>();
        const queue: { locationId: TLocationId; path: TLocationId[] }[] = [
            { locationId: fromLocationId, path: [fromLocationId] }
        ];

        while (queue.length > 0) {
            const { locationId, path } = queue.shift()!;
            
            if (visited.has(locationId)) continue;
            visited.add(locationId);

            const sublocations = this.getConnectedLocations(locationId);
            
            for (const sublocation of sublocations) {
                if (sublocation.id === toLocationId) {
                    return [...path, sublocation.id];
                }
                
                if (!visited.has(sublocation.id)) {
                    queue.push({
                        locationId: sublocation.id,
                        path: [...path, sublocation.id]
                    });
                }
            }
        }

        return null; // No path found
    }

    /**
     * Gets all locations within a specified distance from a starting location
     */
    static getLocationsWithinDistance<L extends TLocationId>(
        locationId: L, 
        maxDistance: number
    ): Array<{ location: TLocation<TLocationId>; distance: number }> {
        if (!this.locationExists(locationId)) return [];

        const result: Array<{ location: TLocation<TLocationId>; distance: number }> = [];
        const visited = new Set<TLocationId>();
        const queue: { locationId: TLocationId; distance: number }[] = [
            { locationId, distance: 0 }
        ];

        while (queue.length > 0) {
            const { locationId: currentId, distance } = queue.shift()!;
            
            if (visited.has(currentId) || distance > maxDistance) continue;
            visited.add(currentId);

            if (distance > 0) { // Don't include the starting location
                result.push({
                    location: this.getLocation(currentId),
                    distance
                });
            }

            if (distance < maxDistance) {
                const sublocations = this.getConnectedLocations(currentId);
                sublocations.forEach(sublocation => {
                    if (!visited.has(sublocation.id)) {
                        queue.push({
                            locationId: sublocation.id,
                            distance: distance + 1
                        });
                    }
                });
            }
        }

        return result.sort((a, b) => a.distance - b.distance);
    }
}