import { HelpDialog } from '../../components/dialog/HelpDialog';

export const TimelineHelpDialog = ({ onClose }: { onClose: () => void }) => (
    <HelpDialog title={_('Timeline help')} onClose={onClose}>
        <h4>{_('Moving around')}</h4>
        <ul>
            <li>
                {_('Scroll to zoom the time scale in and out (at the cursor).')}
            </li>
            <li>
                {_(
                    'Drag empty space or the time strip at the bottom to move the view.'
                )}
            </li>
            <li>
                {_(
                    'Double-click a chapter to open it, or a time trigger to edit it.'
                )}
            </li>
        </ul>
        <h4>{_('Moving chapters')}</h4>
        <p>
            {_(
                'Click a chapter to select it. A plain drag does not move it, so its times cannot change by accident. Hold a key while dragging:'
            )}
        </p>
        <ul>
            <li>
                {_(
                    'X: move along the time axis only (changes the start and end time).'
                )}
            </li>
            <li>
                {_('Y: move up or down only (keeps the start and end time).')}
            </li>
            <li>{_('Shift: move freely.')}</li>
        </ul>
        <p>
            {_(
                'Drag the left or right edge of a selected chapter to change its start or end time.'
            )}
        </p>
        <h4>{_('Time triggers')}</h4>
        <ul>
            <li>
                {_(
                    'Select a trigger on the time strip and drag it to change its time.'
                )}
            </li>
        </ul>
        <p>
            {_('Delete or Backspace removes the selected chapter or trigger.')}
        </p>
    </HelpDialog>
);
