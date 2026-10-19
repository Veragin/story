import { Alert, Button } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { FormHeader } from '../../components/FormHeader';
import {
    FormCenter,
    FormFields,
    FormMeta,
    FormPage,
} from '../../components/formLayout';
import { StructureInput } from '../../components/inputs/StructureInput/StructureInput';
import { Notices } from '../../components/Notices';
import { modals, router } from '../../shell';
import { CatalogLink } from './CatalogLink';
import type { StructureEditorStore } from './StructureEditorStore';
import { usagesOf } from './structureText';

type TProps = {
    editor: StructureEditorStore;
};

export const TypeEditor = observer(({ editor }: TProps) => {
    const { type: resource } = editor;
    const { base, draft } = resource;
    const notices = (
        <Notices
            store={resource}
            what={_('type')}
            diagnosticsTitle={
                editor.canResetIncompatible
                    ? _('Not saved: existing values no longer fit')
                    : undefined
            }
        />
    );

    if (!base || !draft) {
        return (
            <FormCenter>
                <div>
                    {editor.notFound
                        ? _('There is no type "%s".', editor.name ?? '')
                        : _('Select a type or a literal on the left.')}
                </div>
                {notices}
            </FormCenter>
        );
    }

    const usages = usagesOf(editor.structure.types, base.name);
    const deleteBlocker =
        usages.length > 0 ? _('Used by %s', usages.join(', ')) : undefined;

    const onDelete = async () => {
        const ok = await modals.confirm({
            title: _('Delete type %s?', base.name),
            message: base.catalog
                ? _(
                      'This removes %s and its catalog %s.',
                      base.file,
                      base.catalog.file
                  )
                : _('This removes %s.', base.file),
            danger: true,
        });
        if (ok && (await editor.removeType()))
            router.navigate(
                { page: 'structure', section: 'types' },
                { replace: true }
            );
    };

    return (
        <FormPage>
            <FormHeader
                title={base.name}
                store={resource}
                onDelete={
                    base.origin === 'story' ? () => void onDelete() : undefined
                }
                deleteTooltip={deleteBlocker}
            />
            <FormMeta>
                <span>
                    <code>{base.file}</code>
                </span>
                <span data-meta="origin">
                    {base.origin === 'story'
                        ? _('Story type')
                        : _(
                              'Engine type: its engine fields are locked, add your own below'
                          )}
                </span>
                <CatalogLink type={base} editor={editor} />
            </FormMeta>
            {notices}
            {editor.canResetIncompatible && (
                <Alert
                    severity="warning"
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            variant="outlined"
                            disabled={resource.saving}
                            onClick={() => void editor.saveTypeResetting()}
                            data-action="reset-incompatible"
                        >
                            {_('Reset incompatible values')}
                        </Button>
                    }
                >
                    {_(
                        'Saving again with a reset replaces the values that no longer fit with defaults.'
                    )}
                </Alert>
            )}
            <FormFields>
                <StructureInput
                    ariaLabel={_('fields')}
                    value={draft.rows}
                    onChange={(rows) => editor.setRows(rows)}
                    literals={{
                        file: base.file,
                        newLiterals: draft.newLiterals,
                        onNewLiteral: editor.addNewLiteral,
                    }}
                    disabled={resource.saving}
                    dataField="fields"
                />
            </FormFields>
        </FormPage>
    );
});
