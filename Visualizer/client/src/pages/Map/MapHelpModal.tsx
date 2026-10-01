import styled from '@emotion/styled';
import { Modal, spacingCss } from '@story/ui';
import { modals } from '../../shell';

export const openMapHelpModal = () =>
    modals.open((close) => (
        <Modal open title={_('Map help')} onClose={close}>
            <SHelp>
                <h4>{_('Moving around')}</h4>
                <ul>
                    <li>{_('Scroll to zoom in and out (at the cursor).')}</li>
                    <li>{_('W A S D or the arrow keys move the view.')}</li>
                    <li>
                        {_(
                            'Drag empty space to move the view (in Tiles mode: drag with the right mouse button).'
                        )}
                    </li>
                    <li>{_('Double-click a location to open it.')}</li>
                </ul>
                <h4>{_('Modes')}</h4>
                <ul>
                    <li>{_('View: look only, nothing can be changed.')}</li>
                    <li>
                        {_(
                            'Locations: click a location to select it, drag it to move it, drag its handles to reshape it, double-click an edge to add a point, right-click a point to remove it. Delete removes the selected location.'
                        )}
                    </li>
                    <li>
                        {_(
                            'Tiles: paint tiles with the palette (Shift + scroll changes the brush size), or switch to the select tool to give a tile a label and a description. Zoom in to read the descriptions.'
                        )}
                    </li>
                </ul>
                <p>
                    {_(
                        'Changes are saved automatically about a second after the last edit.'
                    )}
                </p>
            </SHelp>
        </Modal>
    ));

const SHelp = styled.div`
    color: #eee;
    line-height: 1.5;
    & h4 {
        margin: ${spacingCss(1)} 0 0;
    }
    & ul {
        margin: ${spacingCss(0.5)} 0;
    }
`;
