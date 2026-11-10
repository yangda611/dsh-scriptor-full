/* @webnovel/review —— 行为规格见 docs/book-format.md(单一真源);本包只放实现 */
export const pkg = '@webnovel/review'

export { makeFinding, type Finding } from './finding'
export {
  getCheck,
  listChecks,
  registerCheck,
  resetChecks,
  type CheckInput,
  type CheckModule,
  type EpisodeCheckInput,
  type ReviewCheckInput,
  type ReviewScope,
  type ScreenplayCheckInput,
} from './registry'
export {
  M0_REQUIRED_CHECKS,
  registerDefaultChecks,
  runCanonCheck,
  runTextNorm,
  findingId,
  设定与时序核对,
  设定与时序核对名,
  文本规范检查,
  文本规范检查名,
} from './checks'
export { computeReview, ingestFindings, planReview, recordAuthorFinding, runReview, type ReviewKey, type RunReviewResult, type ReviewProseStats } from './run'
export {
  FILM_DRAMA_MODULES,
  FILM_DRAMA_MODULE_NAMES,
  computeEpisodeFindings,
  computeScreenplayFindings,
  episodeFingerprint,
  episodeOutlineText,
  episodeReviewId,
  registerAllReviewChecks,
  registerFilmDramaChecks,
  screenplayFingerprint,
  screenplayReviewId,
  短剧审读名,
  短剧审读语义名,
  剧本场次完整性审读名,
  剧本对白审读名,
  剧本节奏审读名,
  剧本语义审读名,
  type EpisodeFindingsResult,
  type ScreenplayFindingsResult,
} from './film-drama'
export {
  computeEpisodeReview,
  computeScreenplayReview,
  ingestFilmDramaFindings,
  runEpisodeReviewRecord,
  runScreenplayReviewRecord,
  type EpisodeReviewKey,
  type EpisodeReviewRunInput,
  type FilmDramaIngestArgs,
  type FilmDramaIngestResult,
  type FilmDramaReviewResult,
  type ScreenplayReviewRunInput,
} from './run'
