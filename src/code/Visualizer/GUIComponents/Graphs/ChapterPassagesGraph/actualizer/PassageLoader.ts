import { register } from "data/register";

export class PassageLoader {
    async loadPassages(chapterId: string): Promise<Record<string, any> | null> {
        try {
            const passagesModule = await register.passages[chapterId as keyof typeof register.passages]();
            if (!passagesModule) {
                console.error(`No passages found for chapter ${chapterId}`);
                return null;
            }
            return passagesModule.default;
        } catch (error) {
            console.error(`Error loading passages for chapter ${chapterId}:`, error);
            return null;
        }
    }
}