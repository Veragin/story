import { Alert, Button, styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import type { TStructTypeDto } from '@story/visualizer-protocol';
import { FormHeader } from '../../components/FormHeader';
import {
    FormCenter,
    FormFields,
    FormMeta,
    FormPage,
} from '../../components/formLayout';
import { FormStructureInput } from '../../components/inputs/form/FormStructureInput';
import { Notices } from '../../components/Notices';
import { modals, router } from '../../shell';
import { CatalogLink } from './CatalogLink';
import type { StructureEditorStore } from './StructureEditorStore';
import { usagesOf } from './structureText';

type TProps = {
    editor: StructureEditorStore;
};

const ORIGIN_TEXT: Record<TStructTypeDto['origin'], () => string> = {
    story: () => _('Story type'),
    extendable: () =>
        _('Engine type: its engine fields are locked, add your own below'),
    engine: () => _('Engine type, read-only'),
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

    const meta = (
        <FormMeta>
            <span>
                <code>{base.file}</code>
            </span>
            <span data-meta="origin">{ORIGIN_TEXT[base.origin]()}</span>
            <CatalogLink type={base} editor={editor} />
        </FormMeta>
    );

    if (base.origin === 'engine') {
        return (
            <FormPage>
                <STitle>{base.name}</STitle>
                {meta}
                <SCode>{base.code ?? ''}</SCode>
            </FormPage>
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
            {meta}
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
                <FormStructureInput
                    label={_('fields')}
                    value={draft.rows}
                    onChange={(rows = []) => editor.setRows(rows)}
                    literals={{
                        file: base.file,
                        newLiterals: draft.newLiterals,
                        onNewLiteral: editor.addNewLiteral,
                    }}
                    diagnostics={resource.diagnostics.filter((d) =>
                        d.field?.startsWith('fields')
                    )}
                    disabled={resource.saving}
                    dataField="fields"
                />
            </FormFields>
        </FormPage>
    );
});

const STitle = styled('h2')`
    margin: 0;
    font-size: 20px;
    font-weight: 600;
`;

const SCode = styled('pre')`
    margin: 0;
    padding: 12px;
    overflow: auto;
    font-size: 12px;
    border-radius: 4px;
    background: ${({ theme }) => theme.palette.action.hover};
`;
