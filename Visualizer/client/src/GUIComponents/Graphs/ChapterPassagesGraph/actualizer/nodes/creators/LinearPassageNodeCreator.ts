import { PassageNodeVisualObject } from '../../../PassageNodeVisualObject';
import { AbstractPassageNodeCreator } from '../AbstractPassageNodeCreator';
import type { TCharacterId } from '@story/types';
import type { TGraphPassage } from '../../graphPassage';

export class LinearPassageNodeCreator extends AbstractPassageNodeCreator {
    create(passage: TGraphPassage): PassageNodeVisualObject {
        const backgroundColor = this.colorManager.getCharacterColor(passage.characterId as TCharacterId);
        const title = passage.title || passage.passageId;

        const position = { x: 0, y: 0 };
        const size = this.calculateDimensions(title, AbstractPassageNodeCreator.DEFAULT_FONT);

        const textContent = this.createTextContent(title, position, size, {
            font: AbstractPassageNodeCreator.DEFAULT_FONT,
            color: '#000000',
            alignment: 'middle_center',
        });

        const node = new PassageNodeVisualObject(
            passage.passageId,
            position,
            size,
            {
                color: '#999999',
                width: 1,
                style: 'solid',
                radius: 8,
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);

        return node;
    }
}
