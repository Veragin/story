import { TCharacterId } from "types/TIds";

export class ColorManager {
    private static readonly colorPalette = [
        '#f3e5f5', // Light purple
        '#e3f2fd', // Light blue
        '#e8f5e9', // Light green
        '#fff3e0', // Light orange
        '#fce4ec', // Light pink
        '#f1f8e9', // Light lime
        '#e0f7fa', // Light cyan
        '#fff8e1', // Light amber
    ];

    private characterColors: Map<TCharacterId, string> = new Map();

    initializeCharacterColors(passages: Record<TCharacterId, any>): void {
        const characterIds = new Set<TCharacterId>();
        
        for (const passageId of Object.keys(passages)) {
            const parts = passageId.split('-');
            if (parts.length >= 2) {
                characterIds.add(parts[1] as TCharacterId);
            }
        }

        Array.from(characterIds).forEach((characterId, index) => {
            const colorIndex = index % ColorManager.colorPalette.length;
            this.characterColors.set(characterId, ColorManager.colorPalette[colorIndex]);
        });
    }

    getCharacterColor(characterId: TCharacterId): string {
        return this.characterColors.get(characterId) || '#ffffff';
    }
}