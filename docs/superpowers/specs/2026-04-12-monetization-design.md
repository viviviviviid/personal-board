# Monetization Design — Personal Board

**Date:** 2026-04-12  
**Status:** Approved  
**Scope:** Web (Next.js) + Mobile (Flutter)

---

## Overview

Personal Board을 글로벌 개인 사용자 대상 Freemium SaaS로 유료화한다.  
핵심 차별점인 타임라인 + 아이젠하워 매트릭스는 Free에서도 완전히 사용 가능하게 두어 제품 가치를 경험하게 하고, 데이터 한도와 고급 기능(AI, Google Calendar, Vault)으로 Pro 전환을 유도한다.

---

## 플랜 정의

### Free
| 항목 | 한도 |
|---|---|
| 프로젝트 | 3개 |
| 메모 | 50개 |
| 습관 | 3개 |
| 타임라인 히스토리 조회 | 최근 4주 |
| 반복 일정 | ✅ 가능 |
| Google Calendar 연동 | ❌ |
| AI 기능 (일일 브리핑 / 주간 회고 / 프로젝트 진단) | ❌ |
| 금고 (Vault) | ❌ |
| 모바일 앱 | ✅ (동일 한도 적용) |

### Pro
- 모든 데이터 한도 무제한
- Google Calendar 연동
- AI 어시스턴트 전체 (일일 브리핑, 주간 회고, 프로젝트 진단)
- 금고 (Vault)
- 우선 고객지원

---

## 가격

| 플랜 | 가격 |
|---|---|
| Free | $0 |
| Pro 월결제 | $1/월 |
| Pro 연결제 | $8/년 ($0.67/월, 33% 할인) |

**런칭 Early Bird:** $4/년 한정 — 초기 유저 확보 및 입소문 유도.

**운영 주의사항:** Stripe 카드 수수료(2.9% + $0.30)가 $1 월결제에서 약 33%를 차지함.  
연결제($8/년)를 결제 UI에서 기본 선택으로 강조해 LTV를 높일 것.

---

## 기술 구현

### 결제 플랫폼

| 플랫폼 | 용도 |
|---|---|
| Stripe | 웹 구독 결제, webhook으로 플랜 상태 동기화 |
| RevenueCat | iOS/Android 인앱결제, Stripe 통합으로 크로스 플랫폼 구독 상태 통합 관리 |

RevenueCat을 통해 웹에서 결제한 유저가 앱에서도 Pro로 인식되도록 처리한다.

### DB 스키마

```prisma
model Subscription {
  id        String    @id @default(cuid())
  userId    String    @unique
  plan      String    @default("free") // "free" | "pro"
  provider  String?   // "stripe" | "revenuecat"
  expiresAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id])
}
```

### 플랜 체크 유틸 (`src/lib/plan.ts`)

모든 API 라우트에서 공통으로 사용하는 플랜 체크 모듈:

```ts
export async function getUserPlan(userId: string): Promise<'free' | 'pro'>
export async function assertPro(userId: string): Promise<void> // Pro 아니면 403
export const FREE_LIMITS = {
  projects: 3,
  notes: 50,
  habits: 3,
}
```

한도 초과 또는 Pro 전용 기능 접근 시 `402 Payment Required` 반환.

### 게이팅 적용 범위

| API 엔드포인트 | 게이팅 조건 |
|---|---|
| `POST /api/projects` | Free 유저 프로젝트 수 3개 초과 시 402 |
| `POST /api/notes` | Free 유저 메모 수 50개 초과 시 402 |
| `POST /api/habits` | Free 유저 습관 수 3개 초과 시 402 |
| `GET /api/timeline` | Free 유저 4주 이전 데이터 요청 시 402 |
| `GET /api/ai/*` | Free 유저 접근 시 402 |
| `GET /api/calendar/*` | Free 유저 접근 시 402 |
| `GET /api/vault/*` | Free 유저 접근 시 402 |

### 업그레이드 UX

- **데이터 한도 도달 시:** "Pro로 업그레이드하면 무제한으로 사용할 수 있어요" 모달
- **AI 기능 클릭 시:** 인라인 잠금 배너 + 업그레이드 CTA
- **금고 / Google Calendar 진입 시:** 기능 미리보기 화면 + 업그레이드 CTA
- 프론트에서 402 수신 시 공통 업그레이드 모달 트리거

---

## 포지셔닝

글로벌 개인 생산성 앱 경쟁군에서 "가벼운 TODO 앱(Todoist $4/월)"보다 아래, "전문 time-blocking 툴(Sunsama $20/월)"보다 훨씬 저렴하게 포지셔닝.  
$1/월은 충동 구매가 일어나는 가격대로, 대량 전환 유저 확보 후 가격 인상 여지를 남긴다.
