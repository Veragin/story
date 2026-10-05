import { CircularProgress } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { FormHeader } from '../../components/FormHeader';
import {
    FormCenter,
    FormFields,
    FormMeta,
    FormPage,
} from '../../components/formLayout';
import { Notices } from '../../components/Notices';
import { router } from '../../shell';
import type { StructureStore } from '../../stores/StructureStore';
import { confirmDelete } from './confirmDelete';
import { EntityFields } from './EntityFields';
import type { EntityFormStore } from './EntityFormStore';
import { displayName } from './entityFields';

type TProps = {
    store: EntityFormStore;
    structure: StructureStore;
};

const KIND_LABEL = {
    characters: () => _('character'),
    npcs: () => _('NPC'),
    locations: () => _('location'),
    items: () => _('item'),
};

export const EntityForm = observer(({ store, structure }: TProps) => {
    const { draft, base } = store;
    const notices = <Notices store={store.resource} what={_('entity')} />;

    if (store.loading && !draft)
        return (
            <FormCenter>
                <CircularProgress size={24} />
            </FormCenter>
        );
    if (store.notFound) {
        return (
            <FormCenter>
                <div>
                    {_(
                        '"%s" does not exist (any more).',
                        store.selectedId ?? ''
                    )}
                </div>
                {notices}
            </FormCenter>
        );
    }
    if (!draft || !base) {
        return (
            <FormCenter>
                <div>{_('Select an entity on the left, or add one.')}</div>
                {notices}
            </FormCenter>
        );
    }

    const onDelete = async () => {
        const ok = await confirmDelete({
            title: _('Delete %s "%s"?', KIND_LABEL[base.kind](), base.id),
            message: _(
                'This removes it from %s and from the registry. Values that point at it are cleared.',
                base.file
            ),
            preview: () => store.entities.deleteReferences(base.kind, base.id),
        });
        if (!ok) return;
        if (await store.remove())
            router.navigate(
                { page: 'entities', kind: base.kind },
                { replace: true }
            );
    };

    return (
        <FormPage>
            <FormHeader
                title={displayName(draft.name, draft.id)}
                store={store.resource}
                onDelete={() => void onDelete()}
            />
            <FormMeta>
                <span>
                    {_('id')}: <code>{draft.id}</code>
                </span>
                <span>
                    <code>
                        {base.file}
                        {base.line ? `:${base.line}` : ''}
                    </code>
                </span>
            </FormMeta>
            {notices}
            <FormFields>
                <EntityFields
                    store={store}
                    structure={structure}
                    draft={draft}
                />
            </FormFields>
        </FormPage>
    );
});
