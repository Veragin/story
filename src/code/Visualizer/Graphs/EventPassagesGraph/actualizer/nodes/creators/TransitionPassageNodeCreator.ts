import { register, TRegisterPassageId } from "data/register";
import { PassageNodeVisualObject } from "../../../PassageNodeVisualObject";
import { AbstractPassageNodeCreator } from "../AbstractPassageNodeCreator";
import { TWorldState } from "data/TWorldState";


export class TransitionPassageNodeCreator extends AbstractPassageNodeCreator {
    async create(
        passageId: TRegisterPassageId,
        passage: any
    ): Promise<PassageNodeVisualObject> {
        const title = await this.getTransitionTitle(passageId, passage);
        const parts = passage.nextPassageId.split('-');
        const characterId = parts[1];
        const borderColor = title ? '#666666' : '#ff0000';
        const displayTitle = title || passage.id;
        
        const backgroundColor = this.colorManager.getCharacterColor(characterId);
        const position = { x: 0, y: 0 };
        const size = this.calculateDimensions(displayTitle, AbstractPassageNodeCreator.DEFAULT_FONT);

        const textContent = this.createTextContent(
            displayTitle,
            position,
            size,
            {
                font: AbstractPassageNodeCreator.DEFAULT_FONT,
                color: '#666666',
                alignment: 'middle_center'
            }
        );

        const node = new PassageNodeVisualObject(
            passageId,
            position,
            size,
            {
                color: borderColor,
                width: 1,
                style: 'dashed',
                radius: 8
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);

        return node;
    }

    private async getTransitionTitle(passageId: string, passage: any): Promise<string> {
        const parts = passage.nextPassageId.split('-');
        if (parts.length < 2) return passageId;

        const eventId = parts[0];
        const linkPassageModule = await register.passages[eventId as keyof typeof register.passages]();
        const linkPassages = linkPassageModule.default;
        const linkPassageData = linkPassages[passageId as keyof typeof linkPassages];

        if (typeof linkPassageData === 'function') {
            const [linkPassageId, linkPassageDataFunction] = Object.entries(linkPassages)[0];
            const linkPassage = linkPassageDataFunction({} as TWorldState);
            const linkEventId = linkPassageId.split('-')[0];
            const linkEvent = register.events[linkEventId as keyof typeof register.events];
            
            if (linkEvent) {
                return `${linkEvent.title} - ${linkPassage.title || linkPassageId}`;
            }
            return linkPassage.title || linkPassageId;
        }

        return '';
    }
}
