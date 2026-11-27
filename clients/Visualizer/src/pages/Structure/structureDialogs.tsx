import type { TLiteralDto, TStructTypeDto } from '@story/protocol';
import { modals } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import { CreateClassDialog } from './CreateClassDialog';
import { CreateLiteralDialog } from './CreateLiteralDialog';
import { CreateTypeDialog } from './CreateTypeDialog';

export const askNewClass = (
    structure: StructureStore
): Promise<TStructTypeDto | null> =>
    modals.ask<TStructTypeDto | null>(
        (answer) => (
            <CreateClassDialog
                structure={structure}
                onClose={() => answer(null)}
                onCreated={answer}
            />
        ),
        null
    );

export const askNewType = (
    structure: StructureStore,
    owner?: string
): Promise<TStructTypeDto | null> =>
    modals.ask<TStructTypeDto | null>(
        (answer) => (
            <CreateTypeDialog
                structure={structure}
                owner={owner}
                onClose={() => answer(null)}
                onCreated={answer}
            />
        ),
        null
    );

export const askNewLiteral = (
    structure: StructureStore,
    owner?: string
): Promise<TLiteralDto | null> =>
    modals.ask<TLiteralDto | null>(
        (answer) => (
            <CreateLiteralDialog
                structure={structure}
                owner={owner}
                onClose={() => answer(null)}
                onCreated={answer}
            />
        ),
        null
    );
