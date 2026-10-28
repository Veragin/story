import { useEffect, useRef, useState } from 'react';
import { Button, CircularProgress, styled, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import {
    MAX_IMAGE_BYTES,
    type TImageDto,
    type TImageOwner,
    type TMaybeCode,
} from '@story/protocol';
import { spacingCss } from '@story/ui';
import {
    api as defaultApi,
    errorMessage,
    isImageDto,
    isStaleError,
    type TVisualizerApi,
} from '../../api';
import { modals } from '../../shell/modals';
import type { TInputProps } from '../inputs/inputTypes';
import { MaybeCodeTextInput } from '../code/MaybeCodeTextInput';
import { TooltipIconButton } from '../buttons/TooltipIconButton';
import { DeleteButton } from '../buttons/DeleteButton';
import { DescriptionToggleButton } from '../buttons/DescriptionToggleButton';
import { LoadingState } from '../feedback/LoadingState';
import { HintText } from '../feedback/HintText';

type TProps = Omit<TInputProps<TMaybeCode<string>, string>, 'value' | 'onChange'> & {
    owner: TImageOwner;
    id: string;
    // without onChange there is no description, only the image
    value?: TMaybeCode<string>;
    onChange?: (description: string) => void;
    onImageChange?: (image: TImageDto) => void;
    api?: TVisualizerApi;
};

const readBase64 = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
        reader.onerror = () =>
            reject(reader.error ?? new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });

export const ImageEditor = ({
    owner,
    id,
    value,
    onChange,
    onImageChange,
    hasError,
    disabled,
    ariaLabel,
    dataField,
    api = defaultApi,
}: TProps) => {
    const [image, setImage] = useState<TImageDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDescription, setShowDescription] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    // a late response for a previous owner is dropped
    const current = useRef({ owner, id });
    current.current = { owner, id };

    useEffect(() => {
        let alive = true;
        setImage(null);
        setError(null);
        setBusy(false);
        setShowDescription(false);
        const load = async () => {
            try {
                const dto = await api.getImage(owner, id);
                if (alive) setImage(dto);
            } catch (e) {
                if (alive) setError(errorMessage(e));
            }
        };
        void load();
        return () => {
            alive = false;
        };
    }, [api, owner, id]);

    const save = async (
        send: () => Promise<TImageDto>,
        staleMessage: string
    ) => {
        const alive = () =>
            current.current.owner === owner && current.current.id === id;
        setBusy(true);
        try {
            const saved = await send();
            if (alive()) {
                setImage(saved);
                setShowDescription(false);
                onImageChange?.(saved);
            }
        } catch (e) {
            if (!alive()) return;
            if (isStaleError(e, isImageDto) && e.current) {
                setImage(e.current);
                setError(staleMessage);
            } else {
                setError(errorMessage(e));
            }
        } finally {
            if (alive()) setBusy(false);
        }
    };

    const upload = async (file: File) => {
        setError(null);
        if (file.type !== 'image/png') {
            setError(_('Only PNG images can be uploaded.'));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setError(
                _(
                    'The image is larger than %s MB.',
                    String(MAX_IMAGE_BYTES / 1024 / 1024)
                )
            );
            return;
        }
        await save(
            async () =>
                api.uploadImage(owner, id, {
                    version: image?.version ?? '',
                    data: await readBase64(file),
                }),
            _('The image changed on disk. Upload again to replace it.')
        );
    };

    const remove = async () => {
        if (!image?.url) return;
        const confirmed = await modals.confirm({
            title: _('Remove image?'),
            message: _('This deletes %s.', image.file),
            danger: true,
            confirmLabel: _('Remove'),
        });
        if (!confirmed) return;
        setError(null);
        await save(
            () => api.deleteImage(owner, id, { version: image.version }),
            _(
                'The image changed on disk. Remove it again if you still want to.'
            )
        );
    };

    const pick = () => input.current?.click();
    const text = typeof value === 'string' ? value : '';
    const loading = !image && !error;

    const descriptionEditor = onChange && (
        <MaybeCodeTextInput
            value={value ?? ''}
            onChange={onChange}
            multiline
            hasError={hasError}
            disabled={disabled}
            placeholder={_('What the picture shows')}
            ariaLabel={_('%s description', ariaLabel)}
            dataField="image-description"
        />
    );

    const uploadIcon = busy ? <CircularProgress size={14} /> : <UploadIcon />;

    return (
        <SField data-field={dataField}>
            {loading ? (
                <LoadingState />
            ) : image?.url ? (
                <SFrame data-view={showDescription ? 'description' : 'image'}>
                    {showDescription && descriptionEditor ? (
                        descriptionEditor
                    ) : (
                        <SImg
                            src={image.url}
                            alt={text || _('Image of %s', id)}
                            title={image.file}
                        />
                    )}
                    <SOverlay data-overlay>
                        <TooltipIconButton
                            title={_('Replace image (PNG only)')}
                            icon={UploadIcon}
                            busy={busy}
                            disabled={disabled}
                            data-action="replace-image"
                            onClick={pick}
                        />
                        <DeleteButton
                            iconOnly
                            label={_('Remove image')}
                            disabled={disabled || busy}
                            data-action="remove-image"
                            onClick={() => void remove()}
                        />
                        {descriptionEditor && (
                            <DescriptionToggleButton
                                shown={showDescription}
                                onToggle={() => setShowDescription((v) => !v)}
                            />
                        )}
                    </SOverlay>
                </SFrame>
            ) : (
                <>
                    {descriptionEditor}
                    <SRow>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={uploadIcon}
                            disabled={disabled || busy || !image}
                            data-action="upload-image"
                            onClick={pick}
                        >
                            {_('Upload image')}
                        </Button>
                        <HintText>
                            {image
                                ? _('PNG only (%s)', image.file)
                                : _('PNG only')}
                        </HintText>
                    </SRow>
                </>
            )}

            <input
                ref={input}
                type="file"
                accept="image/png"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(file);
                }}
            />
            {error && (
                <Typography variant="caption" color="error">
                    {error}
                </Typography>
            )}
        </SField>
    );
};

const SField = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    width: 100%;
`;

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SOverlay = styled('div')`
    position: absolute;
    top: ${spacingCss(0.5)};
    right: ${spacingCss(0.5)};
    display: flex;
    gap: ${spacingCss(0.5)};
    opacity: 0;
    transition: opacity 120ms;
    & .MuiIconButton-root {
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        &:hover {
            background: rgba(0, 0, 0, 0.8);
        }
    }
`;

const SFrame = styled('div')`
    position: relative;
    align-self: flex-start;
    max-width: 100%;
    &[data-view='description'] {
        align-self: stretch;
        padding-top: 36px;
    }
    &:hover > [data-overlay],
    &:focus-within > [data-overlay],
    &[data-view='description'] > [data-overlay] {
        opacity: 1;
    }
    @media (hover: none) {
        & > [data-overlay] {
            opacity: 1;
        }
    }
`;

const SImg = styled('img')`
    display: block;
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
    border-radius: 4px;
`;
