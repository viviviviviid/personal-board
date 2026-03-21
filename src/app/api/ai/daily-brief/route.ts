import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { startOfDay, endOfDay, format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { date } = body

    if (!date) {
      return NextResponse.json({ error: '날짜는 필수입니다.' }, { status: 400 })
    }

    const targetDate = new Date(date)
    const userId = session.user.id

    const [todos, timeline, highlight, habits] = await Promise.all([
      prisma.todo.findMany({
        where: {
          userId,
          date: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
        },
        select: { title: true, completed: true, priority: true, urgent: true, description: true },
      }),
      prisma.timelineEntry.findMany({
        where: {
          userId,
          date: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
        },
        select: { title: true, category: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' },
      }),
      prisma.dailyHighlight.findFirst({
        where: { userId, date: format(targetDate, 'yyyy-MM-dd') },
        select: { content: true, completed: true },
      }),
      prisma.habit.findMany({
        where: { userId },
        include: {
          logs: {
            where: {
              date: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
            },
          },
        },
      }),
    ])

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 503 })
    }

    const pendingTodos = todos.filter((t) => !t.completed)
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const sortedTodos = [...pendingTodos].sort((a, b) => {
      const urgentDiff = (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)
      if (urgentDiff !== 0) return urgentDiff
      return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) -
             (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1)
    })

    const todoList = sortedTodos.map((t) => {
      const tags = [
        t.priority === 'high' ? '중요' : t.priority === 'low' ? '낮음' : null,
        t.urgent ? '긴급' : null,
      ].filter(Boolean).join(', ')
      return `- ${t.title}${tags ? ` (${tags})` : ''}`
    }).join('\n')

    const categoryLabel: Record<string, string> = {
      work: '업무', personal: '개인', exercise: '운동', study: '학습', health: '건강', other: '기타',
    }
    const scheduleList = timeline.map((e) =>
      `- ${e.startTime}~${e.endTime} [${e.category ? (categoryLabel[e.category] ?? e.category) : '기타'}] ${e.title}`
    ).join('\n')

    const undonHabits = habits.filter((h) => !h.logs.some((l) => l.completed)).map((h) => h.name)

    const prompt = `당신은 개인 생산성 코치입니다. 오늘 하루를 잘 시작할 수 있도록 브리핑해 주세요. 한국어로 답변하세요.

## 오늘 날짜: ${format(targetDate, 'yyyy년 MM월 dd일 (EEEE)')}

### 오늘의 핵심 목표:
${highlight ? `"${highlight.content}" [${highlight.completed ? '달성' : '진행 중'}]` : '(설정 없음)'}

### 미완료 할일 (${pendingTodos.length}개):
${todoList || '(없음)'}

### 오늘 일정:
${scheduleList || '(등록된 일정 없음)'}

### 아직 완료하지 않은 습관:
${undonHabits.length > 0 ? undonHabits.map((h) => `- ${h}`).join('\n') : '(모두 완료했거나 습관 없음)'}

위 데이터를 바탕으로 다음 형식으로 오늘의 브리핑을 작성해 주세요:

## 오늘의 한 줄 요약
(오늘 하루의 성격을 한 문장으로 — 예: "집중이 필요한 업무 중심의 하루")

## 지금 당장 할 일 TOP 3
(가장 먼저 처리해야 할 3가지, 이유와 함께, bullet point)

## 시간 활용 제안
(일정과 할일을 고려한 시간대별 간단한 제안 2-3가지, bullet point)

## 오늘의 한 마디
(짧은 동기부여 메시지 1문장)

간결하고 실용적으로, 실제로 도움이 되는 내용으로 작성해 주세요.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)

    const brief = result.response.text() || '브리핑 생성에 실패했습니다.'
    return NextResponse.json({ brief })
  } catch (error) {
    console.error('Failed to generate daily brief:', error)
    return NextResponse.json({ error: '일일 브리핑 생성에 실패했습니다.' }, { status: 500 })
  }
}
