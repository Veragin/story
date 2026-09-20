/**
 * The whole app, for now: one page saying MultiEngine is not implemented.
 *
 * When it is actually built, this is where SingleEngine's passage rendering arrives, driven by
 * state pushed from `MultiEngine/server` (:8124) instead of a local `Engine`. Two notes so the
 * next person does not have to re-derive them:
 *
 *  - **The passage templates come from `SingleEngine/src/templates/`.** REFACTOR_PLAN §3 is
 *    explicit that extracting them into `@story/ui` is deferred until MultiEngine is actually
 *    built — "don't generalize on spec". So nothing here imports them, and
 *    `SingleEngine/src/templates/` was left untouched by this phase. That extraction is the
 *    first step of the real work, and it should be driven by what the second consumer turns
 *    out to need rather than by guesswork now.
 *  - **Everything visual comes through `@story/ui`.** That is the part of the SingleEngine
 *    stack already shared, and rendering even this page with it means the theme / global `_` /
 *    toast wiring is exercised from boot rather than bolted on later.
 */

import { Column, Header, Text, WholeContainer } from '@story/ui';

export const MultiEngine = () => (
    <WholeContainer>
        <Column
            style={{
                gap: 16,
                margin: 'auto',
                maxWidth: 640,
                padding: 24,
                textAlign: 'center',
            }}
        >
            <Header>MultiEngine — not implemented</Header>
            <Text>
                This client is a scaffold. Multiplayer is not built: no
                character picking, no world-state sync, and no waiting for the
                other players before a passage advances.
            </Text>
            <Text>
                Play the story in SingleEngine on port 8100. The MultiEngine
                server scaffold answers 501 on port 8124.
            </Text>
        </Column>
    </WholeContainer>
);
