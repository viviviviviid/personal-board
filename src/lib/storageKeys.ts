/**
 * 로컬스토리지 키 상수
 * 타이핑 실수 방지 및 일관성 유지
 *
 * 네이밍 규칙: feature:specific-key
 */

export const STORAGE_KEYS = {
  // Board (주간 보드)
  BOARD_DEFAULT_VIEW: 'board:default-view', // 'weekly' | 'monthly'
  BOARD_WEEK_START: 'board:week-start', // 'mon' | 'sun'
  BOARD_THEME: 'board:theme', // 'dark' | 'light'
  BOARD_MOBILE_COLS: 'board:mobile-cols', // 1 | 2 | 3
  BOARD_MONTH_COUNT: 'board:month-count', // 1 | 2 | 3

  // Calendar
  ENABLED_CALENDARS_WEEKLY: 'board:calendars-weekly', // string[]
  ENABLED_CALENDARS_MONTHLY: 'board:calendars-monthly', // string[]

  // Sidebar
  SIDEBAR_COLLAPSED: 'sidebar:collapsed', // 'true' | 'false'

  // AI Feedback
  AI_AUTO_FEEDBACK: 'ai:auto-feedback', // 'true' | 'false'
  AI_FEEDBACK_DATA_TYPES: 'ai:feedback-data-types', // string[] (todos, timeline, habits, highlights)

  // Pomodoro
  POMODORO_SESSIONS_PREFIX: 'pomodoro:', // pomodoro:yyyy-MM-dd → number

  // Onboarding
  ONBOARDING_DONE: 'app:onboarding-done', // '1'
  CAL_PROMPTED: 'app:cal-prompted', // '1'

  // Notes
  NOTE_EDITING_PREFIX: 'notes:editing:', // notes:editing:{id} → content

  // Habits
  HABIT_FILTER: 'habits:filter', // filter string

  // Form states (임시 - 폼 제출 실패 시 데이터 복구)
  TEMP_FORM_DATA: 'temp:form-data', // {[formId]: formData}
} as const

// 타입 안전성을 위한 키 타입
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]
