export type TStoryGrant = { expiresAt: number };

const grants = new WeakMap<object, TStoryGrant>();

export const attachStoryGrant = (req: object, grant: TStoryGrant): void => {
    grants.set(req, grant);
};

export const storyGrantOf = (req: object): TStoryGrant | undefined => grants.get(req);
