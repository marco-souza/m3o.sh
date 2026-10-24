import { z } from "zod";
import { FeedSchema } from "./entity";

export const CreateFeedReq = FeedSchema.omit({ id: true });
export const CreateFeedRes = FeedSchema;

export const ListFeedsRes = z.array(FeedSchema);

export const UpdateFeedParam = FeedSchema.pick({ id: true });
export const UpdateFeedReq = FeedSchema.omit({ id: true });
export const UpdateFeedRes = FeedSchema;

export const RemoveFeedsParam = FeedSchema.pick({ id: true });
export const RemoveFeedsRes = FeedSchema;
