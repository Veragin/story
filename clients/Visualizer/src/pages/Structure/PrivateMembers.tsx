import { observer } from 'mobx-react-lite';
import { router, type TStructureSection } from '../../shell';
import type { StructureEditorStore } from './StructureEditorStore';
import { PrivateMemberList } from './PrivateMemberList';
import { askNewLiteral, askNewType } from './structureDialogs';

type TProps = {
    editor: StructureEditorStore;
    owner: string;
};

export const PrivateMembers = observer(({ editor, owner }: TProps) => {
    const { structure, type: resource } = editor;
    const members = structure.privateOf(owner);

    const select = (section: TStructureSection, name: string) =>
        router.navigate({ page: 'structure', section, name });

    // the new member leaves this page, so the class's edits are saved first
    const savedFirst = async () => !resource.dirty || (await resource.save());

    const newType = async () => {
        if (!(await savedFirst())) return;
        const type = await askNewType(structure, owner);
        if (type) select('types', type.name);
    };

    const newLiteral = async () => {
        if (!(await savedFirst())) return;
        const literal = await askNewLiteral(structure, owner);
        if (literal) select('literals', literal.name);
    };

    return (
        <>
            <PrivateMemberList
                title={_('Private types')}
                section="types"
                names={members.types.map((type) => type.name)}
                addLabel={_('Add type')}
                addAction="new-private-type"
                onAdd={() => void newType()}
                disabled={resource.saving}
            />
            <PrivateMemberList
                title={_('Private literals')}
                section="literals"
                names={members.literals.map((literal) => literal.name)}
                addLabel={_('Add literal')}
                addAction="new-private-literal"
                onAdd={() => void newLiteral()}
                disabled={resource.saving}
            />
        </>
    );
});
