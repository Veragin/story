import { styled, Tab, Tabs } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type { TStructTypeDto } from '@story/protocol';
import {
    SideMenu,
    type TSideMenuAction,
    type TSideMenuEntry,
    type TSideMenuGroup,
} from '../../components/layout/SideMenu';
import { router, type TStructureSection } from '../../shell';
import { askNewClass, askNewLiteral, askNewType } from './structureDialogs';
import type { StructureEditorStore } from './StructureEditorStore';

type TProps = {
    editor: StructureEditorStore;
};

type TListEntry = {
    name: string;
    secondary?: string;
    section?: TStructureSection;
    nested?: TListEntry[];
    actions?: TSideMenuAction[];
};

type TGroup = {
    title: string;
    section: TStructureSection;
    entries: TListEntry[];
    onNew?: () => void;
};

export const StructureList = observer(({ editor }: TProps) => {
    const { structure } = editor;
    // a private type or literal is listed under its class
    const selectedOwner =
        editor.selectedType?.owner ?? editor.selectedLiteral?.owner;
    const selectedTab: TStructureSection = selectedOwner
        ? 'classes'
        : editor.section;
    const [tab, setTab] = useState<TStructureSection>(selectedTab);

    useEffect(() => setTab(selectedTab), [selectedTab]);

    const select = (section: TStructureSection, name: string) =>
        router.navigate({ page: 'structure', section, name });

    const newClass = async () => {
        const type = await askNewClass(structure);
        if (type) select('classes', type.name);
    };

    const newType = async () => {
        const type = await askNewType(structure);
        if (type) select('types', type.name);
    };

    const newLiteral = async (owner?: string) => {
        const literal = await askNewLiteral(structure, owner);
        if (literal) select('literals', literal.name);
    };

    const newPrivateType = async (owner: string) => {
        const type = await askNewType(structure, owner);
        if (type) select('types', type.name);
    };

    const classEntry = (
        type: TStructTypeDto,
        secondary?: string
    ): TListEntry => {
        const members = structure.privateOf(type.name);
        return {
            name: type.name,
            secondary,
            nested: [
                ...members.types.map(
                    (member): TListEntry => ({
                        name: member.name,
                        secondary: _('private type'),
                        section: 'types',
                    })
                ),
                ...members.literals.map(
                    (member): TListEntry => ({
                        name: member.name,
                        secondary: _('private literal'),
                        section: 'literals',
                    })
                ),
            ],
            actions: [
                {
                    label: _('Private type'),
                    action: 'new-private-type',
                    onClick: () => void newPrivateType(type.name),
                },
                {
                    label: _('Private literal'),
                    action: 'new-private-literal',
                    onClick: () => void newLiteral(type.name),
                },
            ],
        };
    };

    const groups: TGroup[] = [
        {
            title: _('Story classes'),
            section: 'classes',
            entries: structure.storyClasses.map((type) =>
                classEntry(type, type.catalog?.name)
            ),
            onNew: () => void newClass(),
        },
        {
            title: _('Built-in classes (extendable)'),
            section: 'classes',
            entries: structure.builtInClasses.map((type) => classEntry(type)),
        },
        {
            title: _('Story types'),
            section: 'types',
            entries: structure.publicStoryTypes.map((type) => ({
                name: type.name,
            })),
            onNew: () => void newType(),
        },
        {
            title: _('Engine types (extendable)'),
            section: 'types',
            entries: structure.extendableTypes.map((type) => ({
                name: type.name,
            })),
        },
        {
            title: _('Literals'),
            section: 'literals',
            entries: structure.publicLiterals.map((literal) => ({
                name: literal.name,
                secondary: literal.scope === 'local' ? literal.file : undefined,
            })),
            onNew: () => void newLiteral(),
        },
    ];

    const isDirty = (section: TStructureSection) =>
        (section === 'literals' ? editor.literal : editor.type).dirty;

    const menuEntry = (
        entry: TListEntry,
        groupSection: TStructureSection
    ): TSideMenuEntry => {
        const section = entry.section ?? groupSection;
        const selected =
            editor.section === section && editor.name === entry.name;
        return {
            name: entry.name,
            secondary: entry.secondary,
            href: router.href({ page: 'structure', section, name: entry.name }),
            selected,
            unsaved: selected && isDirty(section),
            nested: entry.nested?.map((child) => menuEntry(child, section)),
            actions: entry.actions,
        };
    };

    const menuGroups: TSideMenuGroup[] = groups
        .filter((group) => group.section === tab)
        .map((group) => ({
            title: group.title,
            onNew: group.onNew,
            newAction: `new-${group.section}`,
            entries: group.entries.map((entry) =>
                menuEntry(entry, group.section)
            ),
        }));

    return (
        <SideMenu
            groups={menuGroups}
            header={
                <STabs
                    value={tab}
                    onChange={(_event, value: TStructureSection) =>
                        setTab(value)
                    }
                    variant="fullWidth"
                >
                    <Tab
                        value="classes"
                        label={_('Classes')}
                        data-tab="classes"
                    />
                    <Tab value="types" label={_('Types')} data-tab="types" />
                    <Tab
                        value="literals"
                        label={_('Literals')}
                        data-tab="literals"
                    />
                </STabs>
            }
        />
    );
});

const STabs = styled(Tabs)`
    flex: 0 0 auto;
    border-bottom: 1px solid ${({ theme }) => theme.palette.divider};
`;
