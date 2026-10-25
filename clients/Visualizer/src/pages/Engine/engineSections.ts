import type { TEngineSection } from '@story/protocol';

type TEngineSectionInfo = {
    title: () => string;
    placeholder: () => string;
    whenMissing: () => string;
    arguments: () => string;
    imports: () => string;
    jsx: boolean;
    starter: string;
};

export const ENGINE_SECTION_INFO: Readonly<Record<TEngineSection, TEngineSectionInfo>> = {
    onLinkClick: {
        title: () => _('On link click'),
        placeholder: () =>
            _('e.g. Every hour a link takes drains 3 stamina and 8 hunger of the character who takes it.'),
        whenMissing: () => _('Without it, taking a link changes nothing but the time.'),
        arguments: () =>
            _(
                'Runs for every link taken, by the player or by the engine for its characters, before the next passage is built. It gets ({ link, characterId, time, items, tools }, s, e): the link, the character taking it, the time it costs, the items and tools it uses, the world state to change, and the engine.'
            ),
        imports: () => _("Imports: @story/types, @story/shared and the story's own files."),
        jsx: false,
        starter: `import type { TOnLinkClick } from '@story/types';

export const onLinkClick: TOnLinkClick = ({ link, characterId, time }, s, e) => {};
`,
    },
    topbar: {
        title: () => _('Topbar'),
        placeholder: () => _('e.g. Show health, stamina and hunger as icon + number.'),
        whenMissing: () => _('Without it, the status bar shows the default stats (health).'),
        arguments: () =>
            _(
                'A React component that replaces the stats area of the status bar; the time, the character, the inventory and save stay. It gets { s, e }: the world state and the engine, and re-renders when s changes.'
            ),
        imports: () =>
            _(
                'Imports: react, @mui/material, @mui/icons-material (also @mui/icons-material/Bolt), @story/ui (TopbarStat, DefaultTopbar), @story/types.'
            ),
        jsx: true,
        starter: `import { Favorite as FavoriteIcon } from '@mui/icons-material';
import { TopbarStat } from '@story/ui';
import type { TTopbarProps } from '@story/types';

export const Topbar = ({ s }: TTopbarProps) => {
    const character = s.characters[s.mainCharacterId];
    return <TopbarStat icon={FavoriteIcon} label={_('Health')} value={\`\${Math.floor(character.health)}%\`} />;
};
`,
    },
};
