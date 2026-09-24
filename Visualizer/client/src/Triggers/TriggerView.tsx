import styled from '@emotion/styled';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
    Alert,
    Button,
    CircularProgress,
    Divider,
    Typography,
} from '@mui/material';
import { Time } from '@story/shared';
import { Column, Row, spacingCss, WholeContainer } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import type {
    TChapterSummary,
    TStoryIndex,
} from '../../../server/src/story/types';
import { Nav, NavPicker } from '../components/Nav';
import { useVisualizerStore } from '../context';

/**
 * The time-trigger view — what double-clicking a trigger marker on the timeline opens
 * (README § Visualizer, "time-trigger view: form"; VISUALIZER_PLAN §6's table, phases 8 and 9).
 *
 * ## Why this is a read-only view with an "open in editor" button
 *
 * A trigger is an entry in a chapter's inline `triggers: []` array — it has no file of its own,
 * no id in the source, and its `condition`/`effect` are functions. §4.5 rule 2 is explicit that
 * the writer refuses a function rather than guessing, so there is nothing here a form could
 * safely write. What the author needs instead is to *find* it: which chapter it belongs to, when
 * it fires, and a button that opens the file at the right place.
 *
 * That is a real answer to README's "double-click → trigger view", not a stub: the thing the
 * view is for is navigation, and it navigates.
 */
export const TriggerView = observer(
    ({ chapterId, triggerId }: { chapterId: string; triggerId: string }) => {
        const store = useVisualizerStore();
        const [chapter, setChapter] = useState<TChapterSummary | null>(null);
        const [trigger, setTrigger] = useState<
            TStoryIndex['triggers'][number] | null
        >(null);
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
            let cancelled = false;
            setChapter(null);
            setTrigger(null);
            setError(null);

            void (async () => {
                try {
                    const story = await store.agent.getStory();
                    if (cancelled) return;
                    setChapter(
                        story.chapters.find(
                            (candidate) => candidate.id === chapterId
                        ) ?? null
                    );
                    setTrigger(
                        story.triggers.find(
                            (candidate) => candidate.id === triggerId
                        ) ?? null
                    );
                } catch (caught) {
                    if (cancelled) return;
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : _('Could not load the trigger')
                    );
                }
            })();

            return () => {
                cancelled = true;
            };
        }, [chapterId, triggerId, store]);

        return (
            <WholeContainer>
                <Nav>
                    <NavPicker />
                    <Button
                        size="small"
                        onClick={() => store.setActiveTab(null)}
                    >
                        {_('Back to the timeline')}
                    </Button>
                </Nav>

                <SBody>
                    {error !== null && <Alert severity="error">{error}</Alert>}
                    {chapter === null && error === null && <CircularProgress />}

                    {chapter && (
                        <Column sx={{ gap: spacingCss(2) }}>
                            <Typography variant="h6">
                                {trigger?.title ?? triggerId}
                            </Typography>

                            <Column sx={{ gap: spacingCss(0.5) }}>
                                <SFact>
                                    {_('Chapter')}: {chapter.title}
                                </SFact>
                                <SFact>
                                    {_('Fires at')}:{' '}
                                    {trigger?.time !== null &&
                                    trigger?.time !== undefined
                                        ? store.timeManager.renderTime(
                                              Time.fromS(trigger.time),
                                              'dateTime'
                                          )
                                        : _(
                                              'not a literal time — it is computed'
                                          )}
                                </SFact>
                                <SFact>
                                    {_('File')}: {chapter.file}
                                </SFact>
                            </Column>

                            <Row sx={{ gap: spacingCss(1) }}>
                                <Button
                                    variant="contained"
                                    startIcon={
                                        <OpenInNewIcon fontSize="small" />
                                    }
                                    onClick={() =>
                                        void store.agent.openChapter(chapterId)
                                    }
                                >
                                    {_('Open the chapter in the editor')}
                                </Button>
                            </Row>

                            <Divider />

                            <Alert severity="info">
                                {_(
                                    'A time trigger is an entry in the chapter’s triggers array, and its condition and effect are functions. The Visualizer will not rewrite a function — edit it in the file.'
                                )}
                            </Alert>
                        </Column>
                    )}

                    {chapter && trigger === null && (
                        <Alert severity="warning">
                            {_(
                                'That trigger is no longer in the chapter. It may have been renamed or removed.'
                            )}
                        </Alert>
                    )}
                </SBody>
            </WholeContainer>
        );
    }
);

const SBody = styled(Column)`
    gap: ${spacingCss(2)};
    padding: ${spacingCss(3)};
    width: 620px;
    margin: 0 auto;
    overflow-y: auto;
`;

const SFact = styled(Typography)`
    font-size: 0.85rem;
    opacity: 0.85;
`;
