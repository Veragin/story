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
