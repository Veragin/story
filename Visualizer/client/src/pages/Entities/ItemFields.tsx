import { Alert, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import {
    isCode,
    type TItemDto,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { FormObjectInput } from '../../components/inputs/form/FormObjectInput';
import type { TEntityFieldsProps } from './entityFormProps';
import {
    ENTITY_TYPE_NAMES,
    ITEM_FIELDS,
    itemSourceForType,
} from './entityFields';

const isItemField = (key: string) => ITEM_FIELDS.includes(key);

const splitItem = (value: TValueRecord) => {
    const { name, type, ...props } = value;
    return { name, type, props };
};

export const ItemFields = observer(
    ({ store, structure, draft }: TEntityFieldsProps<TItemDto>) => {
        const base = store.base?.kind === 'items' ? store.base : null;
        const target = itemSourceForType(draft.type);
        const onChange = (next: TValueRecord) => {
            const { name, type, props } = splitItem(next);
            // changing the type to / from food or tool moves the item to another file (server side)
            store.setFields({
                name: name ?? draft.name,
                type: typeof type === 'string' ? type : draft.type,
                props,
            });
        };
        return (
            <>
                <SMeta>
                    {_('in')} <code>{draft.source}</code>
                </SMeta>
                {structure.writeError && (
                    <Alert
                        severity="error"
                        onClose={structure.dismissWriteError}
                    >
                        {structure.writeError}
                    </Alert>
                )}
                <FormObjectInput
                    label={_('item')}
                    hideViewToggle
                    value={{
                        name: draft.name,
                        type: draft.type,
                        ...draft.props,
                    }}
                    onChange={(next) => {
                        if (next && !isCode(next)) onChange(next);
                    }}
                    fields={
                        structure.loaded
                            ? structure.fieldsOf(ENTITY_TYPE_NAMES.items.entity)
                            : undefined
                    }
                    allowCustomFields
                    diagnostics={store.exactDiagnostics('props')}
                    diagnosticsOf={(path) =>
                        isItemField(path.split('.')[0])
                            ? store.exactDiagnostics(path)
                            : store.exactDiagnostics(`props.${path}`)
                    }
                    helperText={
                        base && target !== base.source
                            ? _(
                                  'Saving moves the item from %s to %s.',
                                  base.source,
                                  target
                              )
                            : _(
                                  'food goes to foodInfo, tool to toolInfo, the rest to itemInfo.'
                              )
                    }
                    dataField="item"
                />
            </>
        );
    }
);

const SMeta = styled('div')`
    display: flex;
    gap: ${spacingCss(2)};
    font-size: 12px;
    color: ${({ theme }) => theme.palette.text.secondary};
    & code {
        color: ${({ theme }) => theme.palette.text.primary};
    }
`;
