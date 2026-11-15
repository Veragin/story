import { Alert, Button } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { refIdTypeName, type TStructTypeDto } from '@story/protocol';
import { EditorHeader } from '../../components/layout/EditorHeader';
import {
    FormCenter,
    FormMeta,
    FormPage,
} from '../../components/layout/formLayout';
import { FormFields } from '../../components/form/FormFields';
import { StructureEditor } from '../../components/editors/StructureEditor/StructureEditor';
import { Notices } from '../../components/feedback/Notices';
import { modals, router } from '../../shell';
import { CatalogLink } from './CatalogLink';
import { PrivateMembers } from './PrivateMembers';
import type { StructureEditorStore } from './StructureEditorStore';
import { usagesOf } from './structureText';
import { privateOwnerOf } from '../../structure/structureContext';

type TProps = {
    editor: StructureEditorStore;
};

const originText = (type: TStructTypeDto): string => {
    const isClass = type.kind === 'class';
    if (type.owner)
        return _(
            'Private type: usable only in class %s, its fields hold an object of its fields',
            type.owner
        );
    if (type.origin !== 'story')
        return _(
            'Engine %s: its engine fields are locked, add your own below',
            isClass ? _('class') : _('type')
        );
    return isClass
        ? _(
              'Story class: fields of other structures store its id, %s',
              refIdTypeName(type.name)
          )
        : _('Story type: a field of this type holds an object of its fields');
};

export const TypeEditor = observer(({ editor }: TProps) => {
    const { type: resource } = editor;
    const { base, draft } = resource;
    const isClassSection = editor.section === 'classes';
    const notices = (
        <Notices
            store={resource}
            what={isClassSection ? _('class') : _('type')}
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
                        ? isClassSection
                            ? _('There is no class "%s".', editor.name ?? '')
                            : _('There is no type "%s".', editor.name ?? '')
                        : isClassSection
                          ? _('Select a class on the left.')
                          : _('Select a type on the left.')}
                </div>
                {notices}
            </FormCenter>
        );
    }

    const isClass = base.kind === 'class';
    const owner = privateOwnerOf(base);
    const kindLabel = isClass
        ? _('Class')
        : base.owner
          ? _('Private type of %s', base.owner)
          : _('Type');
    const usages = usagesOf(editor.structure.types, base.name);
    const deleteBlocker =
        usages.length > 0 ? _('Used by %s', usages.join(', ')) : undefined;

    const onDelete = async () => {
        const ok = await modals.confirm({
            title: isClass
                ? _('Delete class %s?', base.name)
                : _('Delete type %s?', base.name),
            message: base.catalog
                ? _(
                      'This removes %s and its entries in %s.',
                      base.file,
                      base.catalog.file
                  )
                : base.owner
                  ? _('This removes it from %s.', base.file)
                  : _('This removes %s.', base.file),
            danger: true,
        });
        if (ok && (await editor.removeType()))
            router.navigate(
                base.owner
                    ? {
                          page: 'structure',
                          section: 'classes',
                          name: base.owner,
                      }
                    : {
                          page: 'structure',
                          section: isClass ? 'classes' : 'types',
                      },
                { replace: true }
            );
    };

    return (
        <FormPage>
            <EditorHeader
                title={base.name}
                chip={kindLabel}
                store={resource}
                onDelete={
                    base.origin === 'story' ? () => void onDelete() : undefined
                }
                deleteBlocker={deleteBlocker}
            />
            <FormMeta>
                <span>
                    <code>{base.file}</code>
                </span>
                <span data-meta="origin">{originText(base)}</span>
                {isClass && <CatalogLink type={base} editor={editor} />}
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
                <StructureEditor
                    ariaLabel={_('Fields')}
                    value={draft.rows}
                    onChange={(rows) => editor.setRows(rows)}
                    literals={{
                        file: base.file,
                        owner,
                        newLiterals: draft.newLiterals,
                        onNewLiteral: editor.addNewLiteral,
                    }}
                    disabled={resource.saving}
                    dataField="fields"
                />
                {isClass && owner && (
                    <PrivateMembers editor={editor} owner={owner} />
                )}
            </FormFields>
        </FormPage>
    );
});
