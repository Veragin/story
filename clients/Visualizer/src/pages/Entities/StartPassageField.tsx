import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import type { TCharacterDto } from '@story/protocol';
import { FormMaybeCodeAutocompleteInput } from '../../components/code/FormMaybeCodeAutocompleteInput';
import type { TOption } from '../../structure/option';
import type { EntityFormStore } from './EntityFormStore';

type TProps = {
    store: EntityFormStore;
    character: TCharacterDto;
};

export const StartPassageField = observer(({ store, character }: TProps) => {
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
        <FormMaybeCodeAutocompleteInput
            label={_('Start passage')}
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
