import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import { GLOBAL_MAP_ID } from '@story/protocol';
import { spacingCss } from '@story/ui';
import { router } from '../../shell';
import type { MapPageStore } from './MapPageStore';
import { mapRoute } from './mapRoute';

export const MapBreadcrumbs = observer(({ store }: { store: MapPageStore }) => {
    const chain = store.ancestorMapIds;
    if (chain.length < 2) return null;
    const title = (mapId: string) =>
        mapId === GLOBAL_MAP_ID ? _('World') : store.locationName(mapId);
    const current = chain[chain.length - 1];

    return (
        <SBreadcrumbs aria-label={_('Maps')}>
            {chain.slice(0, -1).map((mapId) => (
                <Link
                    key={mapId}
                    color="inherit"
                    underline="hover"
                    href={router.href(mapRoute(mapId))}
                >
                    {title(mapId)}
                </Link>
            ))}
            <Typography color="inherit" fontWeight={600}>
                {title(current)}
            </Typography>
        </SBreadcrumbs>
    );
});

const SBreadcrumbs = styled(Breadcrumbs)`
    position: absolute;
    top: ${spacingCss(1.5)};
    left: ${spacingCss(1.5)};
    z-index: 3;
    max-width: calc(100% - ${spacingCss(3)});
    padding: ${spacingCss(0.5)} ${spacingCss(1.5)};
    border-radius: 8px;
    background-color: rgba(0, 0, 0, 0.7);
    color: #fff;
    white-space: nowrap;
`;
