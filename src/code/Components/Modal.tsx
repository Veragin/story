import {
    Modal as MuiModal,
    ModalProps,
    styled,
    IconButton,
} from '@mui/material';
import { LargeText } from './Text';
import { Column, Row } from './Basic';
import { Close } from '@mui/icons-material';
import { spacingCss } from './css';

type Props = Omit<ModalProps, 'onClose'> & {
    title: string;
    onClose: () => void;
};

export const Modal = ({ title, onClose, children, ...rest }: Props) => {
    return (
        <MuiModal {...rest} onClose={onClose}>
            <SCont>
                <SHeader>
                    <LargeText>{title}</LargeText>
                    <IconButton
                        onClick={onClose}
                        component="button"
                        size="small"
                        color="inherit"
                    >
                        <Close />
                    </IconButton>
                </SHeader>
                <SBody>{children}</SBody>
            </SCont>
        </MuiModal>
    );
};

const SCont = styled(Column)`
    position: absolute;
    overflow: hidden;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    height: 600px;
    background-color: black;
    border-radius: 12px;
    gap: ${spacingCss(2)};
    align-items: stretch;
`;

const SHeader = styled(Row)`
    background-color: #686868;
    padding: ${spacingCss(2)};
    justify-content: space-between;
    align-items: center;
    color: white;
`;

const SBody = styled(Column)`
    padding: ${spacingCss(2)};
    gap: ${spacingCss(1)};
    flex: 1;
    overflow: auto;
`;
