import type { ComponentProps } from 'react';
import { styled, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { TMaybeCode } from '@story/protocol';
import { FormField } from '../form/FormField';
import { splitFormProps, type TFormInputProps } from '../form/formProps';
import { ImageEditor } from './ImageEditor';

type TProps = TFormInputProps<TMaybeCode<string>, string> &
    Pick<
        ComponentProps<typeof ImageEditor>,
        'owner' | 'id' | 'api' | 'onImageChange'
    >;

export const FormImageEditor = ({ actions, ...props }: TProps) => {
    const { labelProps, inputProps } = splitFormProps({
        emptyValue: '',
        ...props,
    });
    return (
        <FormField
            {...labelProps}
            actions={
                <>
                    {actions}
                    <Tooltip
                        title={_(
                            'An upload is written right away. The description is written on Save.'
                        )}
                    >
                        <SInfo
                            tabIndex={0}
                            aria-hidden={false}
                            aria-label={_('About saving the image')}
                        />
                    </Tooltip>
                </>
            }
        >
            {inputProps && <ImageEditor {...inputProps} />}
        </FormField>
    );
};

const SInfo = styled(InfoOutlinedIcon)`
    color: ${({ theme }) => theme.palette.text.secondary};
    font-size: 14px;
    cursor: help;
`;
