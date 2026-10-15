import { isImageOwner, type TImageOwner } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { pathParam } from '../http/params';
import { RAW_RESPONSE } from '../http/router';
import { readImage, readImageFile, uploadImage } from '../project/images';
import { SourceProject } from '../project/SourceProject';

const ownerOf = (owner: string): TImageOwner => pathParam(owner, isImageOwner, 'image owner');

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
