import { useEffect, useRef, useState } from 'react';
import { styled, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import {
    MAX_IMAGE_BYTES,
    type TImageDto,
    type TImageOwner,
    type TMaybeCode,
} from '@story/protocol';
import { dirName, imageLinkPath, resolvePath } from '@story/shared';
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
import { CodeFallback } from '../code/CodeFallback';
import { MaybeCodeTextInput } from '../code/MaybeCodeTextInput';
import { codeToText } from '../../values/codeLiterals';
import { TooltipIconButton } from '../buttons/TooltipIconButton';
import { DeleteButton } from '../buttons/DeleteButton';
import { LoadingState } from '../feedback/LoadingState';
import { ImageDescriptionInput } from './ImageDescriptionInput';
import {
    ACCEPTED_IMAGE_TYPES,
    isUploadableImage,
    toStoredImage,
} from './imageUpload';
import { SImagePreview } from './imagePreview';
import { useImageFiles } from './useImageFiles';
import { downloadFile } from '../../download';

type TProps = Omit<
    TInputProps<TMaybeCode<string>, string>,
    'value' | 'onChange'
> & {
    owner: TImageOwner;
    id: string;
    // without onChange there is no description, only the image
    value?: TMaybeCode<string>;
    onChange?: (description: string) => void;
    onImageChange?: (image: TImageDto) => void;
    // the owner's source file; with it the description may link another image with `@<path relative to it>`
    linkFrom?: string;
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
    linkFrom,
    api = defaultApi,
}: TProps) => {
    const [image, setImage] = useState<TImageDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const linkDir =
        onChange && linkFrom !== undefined ? dirName(linkFrom) : undefined;
    const imageFiles = useImageFiles(api, linkDir !== undefined);
    // a late response for a previous owner is dropped
    const current = useRef({ owner, id });
    current.current = { owner, id };

    useEffect(() => {
        let alive = true;
        setImage(null);
        setError(null);
        setBusy(false);
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
        if (!isUploadableImage(file)) {
            setError(_('Only PNG, WebP and JPEG images can be uploaded.'));
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
                    data: await readBase64(await toStoredImage(file)),
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

    const descriptionProps = onChange && {
        value: value ?? '',
        onChange,
        hasError,
        disabled,
        placeholder:
            linkDir === undefined
                ? _('What the picture shows')
                : _('What the picture shows, or @ to link another image'),
        ariaLabel: _('%s description', ariaLabel),
        dataField: 'image-description',
    };

    const descriptionEditor =
        descriptionProps &&
        (linkDir === undefined ? (
            <MaybeCodeTextInput {...descriptionProps} multiline />
        ) : (
            <CodeFallback
                {...descriptionProps}
                parse={codeToText}
                convertLabel={_('Convert to text')}
            >
                {(description) => (
                    <ImageDescriptionInput
                        {...descriptionProps}
                        value={description}
                        files={imageFiles.files ?? []}
                        fromDir={linkDir}
                    />
                )}
            </CodeFallback>
        ));

    const link = linkDir === undefined ? undefined : imageLinkPath(text);
    const linkTarget =
        linkDir === undefined || !link ? undefined : resolvePath(linkDir, link);
    const linked = link
        ? imageFiles.files?.find(({ file }) => file === linkTarget)
        : undefined;
    const ownImage = image?.url
        ? { file: image.file, url: image.url }
        : undefined;
    const shown = link === undefined ? ownImage : linked;
    const loadingOwn = link === undefined && !image && !error;
    const loading = loadingOwn || (!!link && imageFiles.files === null);
    const linkMissing = !!link && imageFiles.files !== null && !linked;

    const uploadButton = (
        <TooltipIconButton
            title={_('Upload image')}
            icon={UploadIcon}
            busy={busy}
            disabled={disabled || !image}
            data-action="upload-image"
            onClick={pick}
        />
    );

    // the description keeps its place in every layout, so typing `@` does not remount it and drop the focus
    return (
        <SField data-field={dataField}>
            <SBody>
                {loading ? (
                    <LoadingState />
                ) : (
                    shown && (
                        <SPreview
                            src={shown.url}
                            alt={
                                link === undefined
                                    ? text || _('Image of %s', id)
                                    : ''
                            }
                            title={shown.file}
                            data-linked-image={
                                link === undefined ? undefined : shown.file
                            }
                        />
                    )
                )}
                <SMain data-layout={shown ? 'beside-image' : 'inline'}>
                    {!loadingOwn && descriptionEditor}
                    {!loading &&
                        (shown ? (
                            <SActions>
                                <TooltipIconButton
                                    title={_('Download image')}
                                    icon={DownloadIcon}
                                    data-action="download-image"
                                    onClick={() =>
                                        downloadFile(shown.url, shown.file)
                                    }
                                />
                                {uploadButton}
                                {link === undefined && (
                                    <DeleteButton
                                        iconOnly
                                        label={_('Delete image')}
                                        disabled={disabled || busy}
                                        data-action="remove-image"
                                        onClick={() => void remove()}
                                    />
                                )}
                            </SActions>
                        ) : (
                            uploadButton
                        ))}
                </SMain>
            </SBody>
            {linkMissing && (
                <Typography
                    variant="caption"
                    color="error"
                    data-linked-image="missing"
                >
                    {_('No story image at %s', link)}
                </Typography>
            )}
            <input
                ref={input}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
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
            {imageFiles.error && (
                <Typography variant="caption" color="error">
                    {imageFiles.error}
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

const SBody = styled('div')`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: ${spacingCss(1)};
`;

const SPreview = styled(SImagePreview)`
    flex: 0 1 auto;
    min-width: 0;
    max-width: 50%;
`;

const SMain = styled('div')`
    flex: 1 1 200px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    &[data-layout='inline'] {
        flex-direction: row;
        align-items: center;
    }
`;

const SActions = styled('div')`
    display: flex;
    gap: ${spacingCss(0.5)};
`;
