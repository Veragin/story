import { Link } from '@mui/material';
import { LoadingState } from '../../components/feedback/LoadingState';
import { observer } from 'mobx-react-lite';
import { isCode, type TStructTypeDto } from '@story/protocol';
import { EditorHeader } from '../../components/layout/EditorHeader';
import {
    FormCenter,
    FormMeta,
    FormPage,
} from '../../components/layout/formLayout';
import { FormFields } from '../../components/form/FormFields';
import { ObjectEditor } from '../../components/editors/ObjectEditor/ObjectEditor';
import { Notices } from '../../components/feedback/Notices';
import { router } from '../../shell';
import type { CatalogFormStore } from './CatalogFormStore';
import { confirmDelete } from './entityDialogs';
import { displayName } from './entityFields';

type TProps = {
    store: CatalogFormStore;
    type: TStructTypeDto | undefined;
};

export const CatalogEntryForm = observer(({ store, type }: TProps) => {
    const { resource } = store;
    const { base, draft } = resource;
    const notices = <Notices store={resource} what={_('entry')} />;

    if (store.loading && !draft)
        return (
            <FormCenter>
                <LoadingState />
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
                <div>{_('Select an entry on the left, or add one.')}</div>
                {notices}
            </FormCenter>
        );
    }

    const onDelete = async () => {
        const ok = await confirmDelete({
            title: _('Delete %s "%s"?', base.type, base.id),
            message: _(
                'This removes it from %s. Values that point at it are cleared.',
                base.file
            ),
            preview: () =>
                store.entities.catalogDeleteReferences(base.catalog, base.id),
        });
        if (!ok) return;
        if (await store.remove())
            router.navigate(
                { page: 'catalog', catalog: base.catalog },
                { replace: true }
            );
    };

    const diagnosticsOf = (path: string) =>
        resource.diagnostics.filter((d) => d.field === `values.${path}`);

    return (
        <FormPage>
            <EditorHeader
                title={displayName(draft.name, base.id)}
                store={resource}
                onDelete={() => void onDelete()}
            />
            <FormMeta>
                <span>
                    {_('id')}: <code>{base.id}</code>
                </span>
                <span>
                    <code>{base.file}</code>
                </span>
                <Link
                    href={router.href({
                        page: 'structure',
                        section: 'types',
                        name: base.type,
                    })}
                >
                    {base.type}
                </Link>
            </FormMeta>
            {notices}
            <FormFields>
                <ObjectEditor
                    ariaLabel={base.type}
                    value={draft}
                    onChange={(next) => {
                        if (!isCode(next)) store.setValues(next);
                    }}
                    fields={type?.fields}
                    diagnosticsOf={diagnosticsOf}
                    hideViewToggle
                    dataField="values"
                />
            </FormFields>
        </FormPage>
    );
});
