import { TRegisterPassageId } from "data/register";
import { PassageNodeVisualObject } from "../../../PassageNodeVisualObject";
import { AbstractPassageNodeCreator } from "../AbstractPassageNodeCreator";
import { TCharacterId } from "types/TIds";


export class ScreenPassageNodeCreator extends AbstractPassageNodeCreator {
    async create(
        passageId: TRegisterPassageId,
        passage: any
    ): Promise<PassageNodeVisualObject> {
        const characterId = passageId.split('-')[1] as TCharacterId;
        const backgroundColor = this.colorManager.getCharacterColor(characterId);
        const title = passage.title || passageId;

        const position = { x: 0, y: 0 };
        const size = this.calculateDimensions(title, AbstractPassageNodeCreator.DEFAULT_FONT);

        const textContent = this.createTextContent(
            title,
            position,
            size,
            {
                font: AbstractPassageNodeCreator.DEFAULT_FONT,
                color: '#000000',
                alignment: 'middle_center'
            }
        );

        const node = new PassageNodeVisualObject(
            passageId,
            position,
            size,
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);

        return node;
    }
}
