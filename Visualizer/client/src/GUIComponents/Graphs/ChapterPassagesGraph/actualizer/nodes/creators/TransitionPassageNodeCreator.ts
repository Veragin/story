import { PassageNodeVisualObject } from '../../../PassageNodeVisualObject';
import { AbstractPassageNodeCreator } from '../AbstractPassageNodeCreator';
import type { TCharacterId } from '@story/types';
import type { TGraphPassage } from '../../graphPassage';

export class TransitionPassageNodeCreator extends AbstractPassageNodeCreator {
    create(passage: TGraphPassage): PassageNodeVisualObject {
        // `PassageLoader` titles a transition by where it leads, and leaves it empty when the
        // target does not exist — that is what the red border flags.
        const title = passage.nextResolved ? passage.title : '';
        const borderColor = title ? '#666666' : '#ff0000';
        const displayTitle = title || passage.localId;
        const characterId = (passage.next?.split('-')[1] ?? passage.characterId) as TCharacterId;

        const backgroundColor = this.colorManager.getCharacterColor(characterId);
        const position = { x: 0, y: 0 };
        const size = this.calculateDimensions(displayTitle, AbstractPassageNodeCreator.DEFAULT_FONT);

        const textContent = this.createTextContent(displayTitle, position, size, {
            font: AbstractPassageNodeCreator.DEFAULT_FONT,
            color: '#666666',
            alignment: 'middle_center',
        });

        const node = new PassageNodeVisualObject(
            passage.passageId,
            position,
            size,
            {
                color: borderColor,
                width: 1,
                style: 'dashed',
                radius: 8,
            },
            textContent,
            backgroundColor
        );

        this.setupNodeInteractions(node);

        return node;
    }
}
