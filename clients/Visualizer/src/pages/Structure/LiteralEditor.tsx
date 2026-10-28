import { observer } from 'mobx-react-lite';
import { EditorHeader } from '../../components/layout/EditorHeader';
import {
    FormCenter,
    FormMeta,
    FormPage,
} from '../../components/layout/formLayout';
import { FormFields } from '../../components/form/FormFields';
import { FormStringListInput } from '../../components/form/FormStringListInput';
import { Notices } from '../../components/feedback/Notices';
import { modals, router } from '../../shell';
import type { StructureEditorStore } from './StructureEditorStore';
import {
    literalRowState,
    literalRowsWithValues,
    renamedHint,
} from './literalRows';
import { usagesOf } from './structureText';

type TProps = {
    editor: StructureEditorStore;
};

export const LiteralEditor = observer(({ editor }: TProps) => {
    const { literal } = editor;
    const { base, draft } = literal;
    const notices = <Notices store={literal} what={_('literal')} />;

    if (!base || !draft) {
        return (
            <FormCenter>
                <div>
                    {editor.notFound
                        ? _('There is no literal "%s".', editor.name ?? '')
                        : _('Select a literal or a type on the left.')}
                </div>
                {notices}
            </FormCenter>
        );
    }

    const usages = usagesOf(editor.structure.types, base.name);

    const onDelete = async () => {
        const ok = await modals.confirm({
            title: _('Delete literal %s?', base.name),
            message: _(
                'This removes it from %s. It is refused while a type still uses it.',
                base.file
            ),
            danger: true,
        });
        if (ok && (await editor.removeLiteral()))
            router.navigate(
                { page: 'structure', section: 'literals' },
                { replace: true }
            );
    };

    return (
        <FormPage>
            <EditorHeader
                title={base.name}
                store={literal}
                onDelete={() => void onDelete()}
            />
            <FormMeta>
                <span data-meta="scope">
                    {base.scope === 'global' ? _('Global, in') : _('Local to')}{' '}
                    <code>{base.file}</code>
                </span>
                <span data-meta="usages">
                    {usages.length === 0
                        ? _('Not used by any type')
                        : _('Used by %s', usages.join(', '))}
                </span>
            </FormMeta>
            {notices}
            <FormFields>
                <FormStringListInput
                    label={_('Values')}
                    helperText={_(
                        'Renaming a value renames it where it is used; a used value cannot be removed.'
                    )}
                    diagnostics={literal.diagnostics.filter(
                        (d) => d.field === 'values'
                    )}
                    value={draft.map((row) => row.value)}
                    onChange={(values) =>
                        editor.setLiteralRows(
                            literalRowsWithValues(draft, values ?? [])
                        )
                    }
                    hintOf={(index) => renamedHint(draft[index])}
                    stateOf={(index) => literalRowState(draft[index])}
                    disabled={literal.saving}
                    dataField="values"
                />
            </FormFields>
        </FormPage>
    );
});
