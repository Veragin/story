import { Button, styled } from '@mui/material';
import { spacingCss } from 'code/Components/css';
import { SmallText, Text } from 'code/Components/Text';
import { useEngine, useWorldState } from 'code/Context';
import { observer } from 'mobx-react-lite';
import React from 'react';

export const Inventory = observer(() => {
    const e = useEngine();
    const s = useWorldState();

    const inventory = e.inventory.getInventory(s.mainCharacterId);

    return (
        <SContainer>
            <SmallText>Name</SmallText>
            <SmallText>Count</SmallText>
            <SmallText></SmallText>
            {inventory.map((item, i) => (
                <React.Fragment key={item.id + i}>
                    <Text>{item.name}</Text>
                    <Text>{item.count}</Text>
                    <Button
                        variant="contained"
                        color="info"
                        size="small"
                        onClick={() => e.inventory.addItem({ id: 'berries' })}
                    >
                        Use
                    </Button>
                </React.Fragment>
            ))}
        </SContainer>
    );
});

const SContainer = styled('div')`
    display: grid;
    width: 100%;
    grid-template-columns: 1fr 60px auto;
    gap: ${spacingCss(1)};
    align-items: center;
`;
