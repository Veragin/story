import { useEffect, useRef, useState } from 'react';
import { Button, CircularProgress, styled, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import type { TImageDto, TImageOwner } from '@story/visualizer-protocol';
import { MAX_IMAGE_BYTES } from '@story/visualizer-protocol';
import { api as defaultApi, ApiError, type TVisualizerApi } from '../api';
import { spacingCss } from '@story/ui';

type TProps = {
    owner: TImageOwner;
    /** A full passage id, or a character / npc id. */
    id: string;
    /** The owner's `image` description, used as the picture's alt text. */
    description?: string;
    api?: TVisualizerApi;
};

/** A file's content, base64 without the `data:…;base64,` prefix. */
const readBase64 = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
        reader.onerror = () =>
            reject(reader.error ?? new Error('Could not read the file'));
        reader.readAsDataURL(file);
    });

/**
 * The picture of a passage, character or npc (protocol `dto/image.ts`): the `.png` next to the
 * owner's `.ts` file. Shows it when there is one, and uploads a new one through
 * `PUT /images/:owner/:id`. PNG only — the file picker offers nothing else and the server
 * refuses anything without a PNG signature, since there is no conversion.
 *
 * The upload is written right away; it is not part of the form's draft or its Save.
 */
export const ImageField = ({
    owner,
    id,
    description,
    api = defaultApi,
}: TProps) => {
    const [image, setImage] = useState<TImageDto | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    /** The owner shown now: a late upload response for another one is dropped. */
    const current = useRef({ owner, id });
    current.current = { owner, id };

    useEffect(() => {
        let alive = true;
        setImage(null);
        setError(null);
        setBusy(false);
        api.getImage(owner, id).then(
            (dto) => alive && setImage(dto),
            (e) => alive && setError((e as Error).message)
        );
        return () => {
            alive = false;
        };
    }, [api, owner, id]);

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
        const alive = () =>
            current.current.owner === owner && current.current.id === id;
        setBusy(true);
        try {
            const data = await readBase64(file);
            const saved = await api.uploadImage(owner, id, {
                version: image?.version ?? '',
                data,
            });
            if (alive()) setImage(saved);
        } catch (e) {
            if (!alive()) return;
            if (e instanceof ApiError && e.isStale && e.current) {
                // someone replaced it meanwhile: show theirs, let the author decide again
                setImage(e.current as TImageDto);
                setError(
                    _('The image changed on disk. Upload again to replace it.')
                );
            } else {
                setError((e as Error).message);
            }
        } finally {
            if (alive()) setBusy(false);
        }
    };

    return (
        <SField>
            <Typography variant="caption" color="text.secondary">
                {_('Image')}
            </Typography>
            {image?.url ? (
                <SImg
                    src={image.url}
                    alt={description || _('Image of %s', id)}
                    title={image.file}
                />
            ) : (
                <Typography variant="body2" color="text.secondary">
                    {image
                        ? _('No image (%s).', image.file)
                        : error
                          ? null
                          : _('Loading…')}
                </Typography>
            )}
            <SRow>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={
                        busy ? <CircularProgress size={14} /> : <UploadIcon />
                    }
                    disabled={busy || !image}
                    onClick={() => input.current?.click()}
                >
                    {image?.url ? _('Replace image') : _('Upload image')}
                </Button>
                <Typography variant="caption" color="text.secondary">
                    {_('PNG only')}
                </Typography>
            </SRow>
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
`;

const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SImg = styled('img')`
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
    align-self: flex-start;
    border-radius: 4px;
`;
