import type { TReferenceDto } from '@story/protocol';
import { ReferencesDialog } from '../../components/dialog/ReferencesDialog';
import { modals } from '../../shell';
import { AddTimelineItemDialog } from './AddTimelineItemDialog';
import type { TimelineStore } from './store/TimelineStore';
import { TimelineHelpDialog } from './TimelineHelpDialog';
import { TriggerDialog } from './TriggerDialog';

export const showUndeletedReferences = (
    title: string,
    references: TReferenceDto[]
) =>
    modals.open((close) => (
        <ReferencesDialog
            title={title}
            message={_('Nothing was deleted. Remove these references first:')}
            references={references}
            onClose={close}
        />
    ));

export const openTrigger = (store: TimelineStore, triggerId: string) =>
    modals.open((close) => (
        <TriggerDialog store={store} triggerId={triggerId} onClose={close} />
    ));

export const openAddTimelineItem = (store: TimelineStore, time: number) =>
    modals.open((close) => (
        <AddTimelineItemDialog store={store} time={time} onClose={close} />
    ));

export const openTimelineHelp = () =>
    modals.open((close) => <TimelineHelpDialog onClose={close} />);
