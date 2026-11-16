export type TitleSearchCapabilities = {
  canSearchLocalTitles: boolean
  canSearchExternalSources: boolean
  canIngestExternalTitles: boolean
}

export type TitleEngagementCapabilities = {
  canViewReviews: boolean
  canLikeReviews: boolean
  canTrackReading: boolean
  canBookmarkTitle: boolean
  canSuggestTitleMetadata: boolean
  canWriteReview: boolean
  canViewDiscussion: boolean
  canWriteDiscussionPost: boolean
}

export function getTitleSearchCapabilities({
  isSignedIn,
}: {
  isSignedIn: boolean
}): TitleSearchCapabilities {
  return {
    canSearchLocalTitles: true,
    canSearchExternalSources: isSignedIn,
    canIngestExternalTitles: isSignedIn,
  }
}

export function getTitleEngagementCapabilities({
  isSignedIn,
  hasReadTitle,
}: {
  isSignedIn: boolean
  hasReadTitle: boolean
}): TitleEngagementCapabilities {
  return {
    canViewReviews: true,
    canLikeReviews: isSignedIn,
    canTrackReading: isSignedIn,
    canBookmarkTitle: isSignedIn,
    canSuggestTitleMetadata: isSignedIn,
    canWriteReview: isSignedIn && hasReadTitle,
    canViewDiscussion: true,
    canWriteDiscussionPost: isSignedIn && hasReadTitle,
  }
}
