import { observer } from 'mobx-react-lite';
import { isCode, type TItemDto, type TValueRecord } from '@story/protocol';
import { ErrorAlert } from '../../components/feedback/ErrorAlert';
import { HintText } from '../../components/feedback/HintText';
import { FieldDiagnostics } from '../../components/form/FieldDiagnostics';
import { ObjectEditor } from '../../components/editors/ObjectEditor/ObjectEditor';
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
                <HintText>
                    {_('in')} <code>{draft.source}</code>
                </HintText>
                <ErrorAlert
                    error={structure.writeError}
                    onClose={structure.dismissWriteError}
                />
                <ObjectEditor
                    ariaLabel={_('Item')}
                    hideViewToggle
                    value={{
                        name: draft.name,
                        type: draft.type,
                        ...draft.props,
                    }}
                    onChange={(next) => {
                        if (!isCode(next)) onChange(next);
                    }}
                    fields={
                        structure.loaded
                            ? structure.fieldsOf(ENTITY_TYPE_NAMES.items.entity)
                            : undefined
                    }
                    allowCustomFields
                    hasError={store.exactDiagnostics('props').length > 0}
                    diagnosticsOf={(path) =>
                        isItemField(path.split('.')[0])
                            ? store.exactDiagnostics(path)
                            : store.exactDiagnostics(`props.${path}`)
                    }
                    dataField="item"
                />
                <HintText>
                    {base && target !== base.source
                        ? _(
                              'Saving moves the item from %s to %s.',
                              base.source,
                              target
                          )
                        : _(
                              'food goes to foodInfo, tool to toolInfo, the rest to itemInfo.'
                          )}
                </HintText>
                <FieldDiagnostics
                    diagnostics={store.exactDiagnostics('props')}
                />
            </>
        );
    }
);
