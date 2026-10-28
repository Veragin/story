import type { TLiteralDto, TStructTypeDto } from '@story/protocol';
import { modals } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import { CreateLiteralDialog } from './CreateLiteralDialog';
import { CreateTypeDialog } from './CreateTypeDialog';

export const askNewType = (
    structure: StructureStore
): Promise<TStructTypeDto | null> =>
    modals.ask<TStructTypeDto | null>(
        (answer) => (
            <CreateTypeDialog
                structure={structure}
                onClose={() => answer(null)}
                onCreated={answer}
            />
        ),
        null
    );

export const askNewLiteral = (
    structure: StructureStore
): Promise<TLiteralDto | null> =>
    modals.ask<TLiteralDto | null>(
        (answer) => (
            <CreateLiteralDialog
                structure={structure}
                onClose={() => answer(null)}
                onCreated={answer}
            />
        ),
        null
    );
