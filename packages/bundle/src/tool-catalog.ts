/** Business tools are registered by createNovelTools; delegation follows the native subagent. */
export const REFERENCE_TOOL_NAMES = ['novel_reference_source', 'novel_reference_analyze', 'novel_reference_query', 'novel_reference_report'] as const

export const NOVEL_TOOL_NAMES: readonly string[] = [
  ...REFERENCE_TOOL_NAMES,
  'novel_select_book',
  'novel_create_book',
  'novel_update_contract',
  'novel_get_story_status',
  'novel_check_book',
  'novel_begin_chapter',
  'novel_preview_book_upgrade',
  'novel_apply_book_upgrade',
  'novel_resume_book_upgrade',
  'novel_search_finalized',
  'novel_index_manage',
  'novel_prepare_pack',
  'novel_settle_chapter',
  'novel_new_outline_draft',
  'novel_confirm_outline',
  'novel_update_skeleton',
  'novel_update_volume_layout',
  'novel_roll_window',
  'novel_confirm_worldbook_entry',
  'novel_confirm_volume_outline',
  'novel_assemble_materials',
  'novel_apply_revision',
  'novel_apply_revision_batch',
  'novel_import_draft',
  'novel_record_review_findings',
  'novel_record_proposal',
  'novel_resolve_proposal',
  'novel_apply_retcon',
  'novel_record_memory',
  'novel_note_pending',
  'novel_get_book_progress',
  'novel_editor_suggest',
  // 影视剧扩展（muse-dev 阶段 2 电影剧本 / 阶段 3 短剧）
  'novel_screenplay_check_contract',
  'novel_screenplay_validate_story',
  'novel_screenplay_build_outline',
  'novel_screenplay_build_draft',
  'novel_screenplay_review',
  'novel_screenplay_render',
  'novel_shortdrama_plan_episodes',
  'novel_shortdrama_render_episode',
  'novel_shortdrama_check_beats',
  'novel_shortdrama_review_episode',
]

export const WRITING_DELEGATE_TOOL = 'novel_delegate'
export const NOVEL_CONDITIONAL_TOOL_NAMES: readonly string[] = [WRITING_DELEGATE_TOOL]
/** Complete Scriptor tool surface when the native delegation capability is available. */
export const NOVEL_PRODUCTION_TOOL_NAMES: readonly string[] = [...NOVEL_TOOL_NAMES, ...NOVEL_CONDITIONAL_TOOL_NAMES]
