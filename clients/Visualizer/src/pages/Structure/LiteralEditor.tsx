import { observer } from 'mobx-react-lite';
import { FormHeader } from '../../components/FormHeader';
import {
    FormCenter,
    FormFields,
    FormMeta,
    FormPage,
} from '../../components/formLayout';
import { FormLabel } from '../../components/inputs/form/FormLabel';
import { Notices } from '../../components/Notices';
import { modals, router } from '../../shell';
import { LiteralValuesInput } from './LiteralValuesInput';
import type { StructureEditorStore } from './StructureEditorStore';
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
            <FormHeader
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
                <FormLabel
                    label={_('values')}
                    helperText={_(
                        'Renaming a value renames it where it is used; a used value cannot be removed.'
                    )}
                    diagnostics={literal.diagnostics.filter(
                        (d) => d.field === 'values'
                    )}
                >
                    <LiteralValuesInput
                        value={draft}
                        onChange={editor.setLiteralRows}
                        disabled={literal.saving}
                        ariaLabel={_('Values of %s', base.name)}
                    />
                </FormLabel>
            </FormFields>
        </FormPage>
    );
});
