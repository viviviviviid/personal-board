import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { startOfDay, endOfDay, addDays, format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { weekStart } = body

    if (!weekStart) {
      return NextResponse.json({ error: '주 시작 날짜는 필수입니다.' }, { status: 400 })
    }

    const weekStartDate = new Date(weekStart)
    const weekEndDate = addDays(weekStartDate, 6)
    const userId = session.user.id

    const [todos, timeline, habits, highlights] = await Promise.all([
      prisma.todo.findMany({
        where: {
          userId,
          date: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
        },
        select: { title: true, completed: true, date: true, priority: true, urgent: true },
      }),
      prisma.timelineEntry.findMany({
        where: {
          userId,
          date: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
        },
        select: { title: true, category: true, startTime: true, endTime: true, date: true },
      }),
      prisma.habit.findMany({
        where: { userId },
        include: {
          logs: {
            where: {
              date: { gte: startOfDay(weekStartDate), lte: endOfDay(weekEndDate) },
            },
          },
        },
      }),
      prisma.dailyHighlight.findMany({
        where: {
          userId,
          date: {
            gte: format(weekStartDate, 'yyyy-MM-dd'),
            lte: format(weekEndDate, 'yyyy-MM-dd'),
          },
        },
        select: { date: true, content: true, completed: true },
      }),
    ])

    if (!process.env.GEMINI_API_KEY) {
      const totalTodos = todos.length
      const completedTodos = todos.filter((t) => t.completed).length
      return NextResponse.json({
        feedback: `AI 피드백을 사용하려면 GEMINI_API_KEY를 설정해 주세요.\n\n이번 주 (${format(weekStartDate, 'MM/dd')} - ${format(weekEndDate, 'MM/dd')}) 통계:\n- 총 할일: ${totalTodos}개\n- 완료: ${completedTodos}개`,
      })
    }

    // 우선순위별 완료율
    const byPriority = ['high', 'medium', 'low'].map((p) => {
      const group = todos.filter((t) => t.priority === p)
      return `${p === 'high' ? '높음' : p === 'medium' ? '보통' : '낮음'}: ${group.filter((t) => t.completed).length}/${group.length}`
    })

    // 아이젠하워 분포
    const matrix = {
      q1: todos.filter((t) => t.urgent && t.priority === 'high').length,   // 긴급+중요
      q2: todos.filter((t) => !t.urgent && t.priority === 'high').length,  // 중요+여유
      q3: todos.filter((t) => t.urgent && t.priority !== 'high').length,   // 긴급+덜중요
      q4: todos.filter((t) => !t.urgent && t.priority !== 'high').length,  // 여유+덜중요
    }

    // 타임라인 카테고리별 총 시간
    const categoryHours: Record<string, number> = {}
    for (const entry of timeline) {
      if (!entry.startTime || !entry.endTime || !entry.category) continue
      const [sh, sm] = entry.startTime.split(':').map(Number)
      const [eh, em] = entry.endTime.split(':').map(Number)
      const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
      if (hours > 0) {
        const cat = entry.category
        categoryHours[cat] = (categoryHours[cat] || 0) + hours
      }
    }
    const categoryLabel: Record<string, string> = {
      work: '업무', personal: '개인', exercise: '운동', study: '학습', health: '건강', other: '기타',
    }
    const timeSummary = Object.entries(categoryHours)
      .map(([cat, h]) => `- ${categoryLabel[cat] || cat}: ${h.toFixed(1)}시간`)
      .join('\n')

    // 습관
    const habitSummary = habits.map((h) => {
      const completedDays = h.logs.filter((l) => l.completed).length
      return `- ${h.name}: 7일 중 ${completedDays}일 완료`
    }).join('\n')

    // 데일리 하이라이트
    const highlightSummary = highlights.length > 0
      ? highlights.map((hl) => `- ${hl.date}: "${hl.content}" [${hl.completed ? '달성' : '미달성'}]`).join('\n')
      : '(설정 없음)'

    const totalTodos = todos.length
    const completedTodos = todos.filter((t) => t.completed).length
    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0

    const prompt = `당신은 개인 생산성 코치입니다. 사용자의 이번 주 활동 데이터를 분석하고 한국어로 깊이 있는 피드백을 제공해 주세요.

## 이번 주 데이터 (${format(weekStartDate, 'yyyy년 MM월 dd일')} ~ ${format(weekEndDate, 'MM월 dd일')})

### 할일 전체 완료율: ${completionRate}% (${completedTodos}/${totalTodos})

### 우선순위별 완료율:
${byPriority.join(' | ')}

### 아이젠하워 매트릭스 분포:
- 긴급+중요 (즉시 처리): ${matrix.q1}개
- 중요+여유 (계획적 처리): ${matrix.q2}개
- 긴급+덜중요 (위임 고려): ${matrix.q3}개
- 여유+덜중요 (제거 고려): ${matrix.q4}개

### 시간 투자 분포 (타임라인 기준):
${timeSummary || '(타임라인 기록 없음)'}

### 습관 트래커:
${habitSummary || '(습관 없음)'}

### 데일리 하이라이트 (핵심 목표):
${highlightSummary}

위 데이터를 바탕으로 다음 형식으로 피드백을 작성해 주세요:

## 이번 주 요약
(전반적인 성과를 2-3문장으로 — 수치를 활용해 구체적으로)

## 잘한 점
(구체적인 칭찬 2-3가지, bullet point)

## 주목할 패턴
(우선순위 분배, 시간 투자, 습관 등에서 발견된 패턴 1-2가지, bullet point)

## 개선할 점
(구체적인 개선 제안 2-3가지, bullet point)

## 다음 주 추천 액션
(실행 가능한 액션 아이템 3가지, bullet point)

피드백은 따뜻하고 격려하는 톤으로, 데이터에 근거한 구체적인 인사이트를 담아 작성해 주세요.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)

    const feedback = result.response.text() || '피드백 생성에 실패했습니다.'
    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Failed to generate AI feedback:', error)
    return NextResponse.json({ error: 'AI 피드백 생성에 실패했습니다.' }, { status: 500 })
  }
}
