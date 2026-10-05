import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { TCharacterDto } from '@story/visualizer-protocol';
import { FormTypeInput } from '../../components/inputs/form/FormTypeInput';
import type { TOption } from '../../components/inputs/inputTypes';
import type { EntityFormStore } from './EntityFormStore';

type TProps = {
    store: EntityFormStore;
    character: TCharacterDto;
};

export const StartPassageInput = observer(({ store, character }: TProps) => {
    const [options, setOptions] = useState<TOption[]>([]);
    const { entities } = store;
    const projectVersion = entities.project?.version;
    useEffect(() => {
        let alive = true;
        const loadOptions = async () => {
            const ids = await entities.passageIdsOf(character.id);
            if (alive) setOptions(ids.map((id) => ({ id })));
        };
        void loadOptions();
        return () => {
            alive = false;
        };
    }, [entities, character.id, projectVersion]);
    return (
        <FormTypeInput
            label="startPassageId"
            optional
            value={character.startPassageId}
            onChange={(next) => store.setField('startPassageId', next)}
            options={options}
            placeholder={`<chapter>-${character.id}-intro`}
            diagnostics={store.exactDiagnostics('startPassageId')}
            dataField="startPassageId"
        />
    );
});
