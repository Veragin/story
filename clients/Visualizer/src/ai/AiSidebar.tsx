import { useRef, useState } from 'react';
import { styled } from '@mui/material';
import { Column, Row, spacingCss } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { ErrorAlert } from '../components/feedback/ErrorAlert';
import { SplitterHandle } from '../components/layout/SplitterHandle';
import { useDragResize } from '../components/layout/useDragResize';
import { aiStore } from '../context';
import { getUiState, setUiState } from '../ui-state';
import { AiActivity } from './AiActivity';
import { AiInput } from './AiInput';
import { AiMessageList } from './AiMessageList';
import { AiNoCredits } from './AiNoCredits';
import { AiSidebarHeader } from './AiSidebarHeader';
import type { AiStore } from './AiStore';

const WIDTH_KEY = 'aiSidebarWidth';
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const MAX_WIDTH_SHARE = 0.6;

const clampWidth = (width: number) =>
    Math.round(
        Math.min(
            Math.max(width, MIN_WIDTH),
            Math.max(MIN_WIDTH, window.innerWidth * MAX_WIDTH_SHARE)
        )
    );

const savedWidth = () => {
    const saved = getUiState<unknown>(WIDTH_KEY, DEFAULT_WIDTH);
    return clampWidth(typeof saved === 'number' ? saved : DEFAULT_WIDTH);
};

type TProps = {
    store?: AiStore;
};

export const AiSidebar = observer(({ store = aiStore }: TProps) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(savedWidth);

    const { dragging, startDrag } = useDragResize((clientX) => {
        const left = rootRef.current?.getBoundingClientRect().left ?? 0;
        const next = clampWidth(clientX - left);
        setWidth(next);
        setUiState(WIDTH_KEY, next);
    });

    return (
        <SRoot ref={rootRef} style={{ width }}>
            <SPanel role="complementary" aria-label={_('Ai agent')}>
                <AiSidebarHeader
                    status={store.status}
                    credits={store.credits}
                    onClose={() => store.setOpen(false)}
                />
                {store.noCredits && <AiNoCredits />}
                <AiMessageList messages={store.messages} />
                {!store.noCredits && (
                    <SErrorAlert
                        error={store.lastError}
                        onClose={store.clearError}
                    />
                )}
                <AiActivity
                    status={store.status}
                    message={store.statusMessage}
                    touchedFiles={store.touchedFiles}
                />
                <AiInput store={store} />
            </SPanel>
            <SplitterHandle dragging={dragging} onMouseDown={startDrag} />
        </SRoot>
    );
});

const SRoot = styled(Row)`
    flex-shrink: 0;
    min-height: 0;
    background-color: ${({ theme }) => theme.palette.background.default};
`;

const SPanel = styled(Column)`
    flex: 1;
    min-width: 0;
    min-height: 0;
`;

const SErrorAlert = styled(ErrorAlert)`
    margin: 0 ${spacingCss(1)} ${spacingCss(1)};
`;
