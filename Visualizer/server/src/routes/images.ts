import { isImageOwner, type TImageOwner } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { HttpError } from '../http/HttpError';
import { RAW_RESPONSE } from '../http/router';
import { readImage, readImageFile, uploadImage } from '../project/images';
import { SourceProject } from '../project/SourceProject';

const ownerOf = (owner: string): TImageOwner => {
    if (!isImageOwner(owner)) throw HttpError.notFound(`No image owner "${owner}"`);
    return owner;
};

/**
 * Story art: `/images/:owner/:id[/png]` (`project/images.ts`). The JSON route says whether
 * there is an image and gives a cache-busted `url` for the `/png` route, which serves the bytes
 * with an `ETag`, so an `<img>` revalidates cheaply and a new upload gets a new URL.
 */
export const registerImageRoutes = ({ router, project, bus }: TServerContext) => {
    const sp = SourceProject.for(project);
    router
        .handle('getImage', ({ params }) => readImage(sp, ownerOf(params.owner), params.id))
        .handle('getImageFile', async ({ params, req, res }): Promise<typeof RAW_RESPONSE> => {
            const { bytes, version } = await readImageFile(sp, ownerOf(params.owner), params.id);
            const etag = `"${version}"`;
            const headers = { etag, 'cache-control': 'no-cache' };
            if (req.headers['if-none-match'] === etag) {
                res.writeHead(304, headers);
                res.end();
            } else {
                res.writeHead(200, { ...headers, 'content-type': 'image/png', 'content-length': bytes.length });
                res.end(bytes);
            }
            return RAW_RESPONSE;
        })
        .handle('uploadImage', ({ params, body }) => uploadImage({ sp, bus }, ownerOf(params.owner), params.id, body));
};
