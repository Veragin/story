import { register } from "data/register";

export class PassageLoader {
    async loadPassages(eventId: string): Promise<Record<string, any> | null> {
        try {
            const passagesModule = await register.passages[eventId as keyof typeof register.passages]();
            if (!passagesModule) {
                console.error(`No passages found for event ${eventId}`);
                return null;
            }
            return passagesModule.default;
        } catch (error) {
            console.error(`Error loading passages for event ${eventId}:`, error);
            return null;
        }
    }
}