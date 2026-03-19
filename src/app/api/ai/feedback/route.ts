import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { startOfDay, endOfDay, addDays, format } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStart } = body

    if (!weekStart) {
      return NextResponse.json({ error: '주 시작 날짜는 필수입니다.' }, { status: 400 })
    }

    const weekStartDate = new Date(weekStart)
    const weekEndDate = addDays(weekStartDate, 6)

    let todos: Array<{ title: string; completed: boolean; date: Date | null; priority: string }> = []
    let habits: Array<{ name: string; logs: Array<{ completed: boolean }> }> = []
    let dbError = false

    try {
      todos = await prisma.todo.findMany({
        where: {
          date: {
            gte: startOfDay(weekStartDate),
            lte: endOfDay(weekEndDate),
          },
        },
        select: {
          title: true,
          completed: true,
          date: true,
          priority: true,
        },
      })

      habits = await prisma.habit.findMany({
        include: {
          logs: {
            where: {
              date: {
                gte: startOfDay(weekStartDate),
                lte: endOfDay(weekEndDate),
              },
            },
          },
        },
      })
    } catch (e) {
      dbError = true
      console.error('DB fetch failed for AI feedback:', e)
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        feedback: `AI 피드백을 사용하려면 ANTHROPIC_API_KEY를 설정해 주세요.\n\n${
          dbError
            ? 'DB 연결도 확인이 필요합니다.'
            : `이번 주 (${format(weekStartDate, 'MM/dd')} - ${format(weekEndDate, 'MM/dd')}) 통계:\n- 총 할일: ${todos.length}개\n- 완료: ${todos.filter((t) => t.completed).length}개`
        }`,
      })
    }

    const totalTodos = todos.length
    const completedTodos = todos.filter((t) => t.completed).length
    const completionRate = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0

    const habitSummary = habits
      .map((h) => {
        const completedDays = h.logs.filter((l) => l.completed).length
        return `- ${h.name}: 7일 중 ${completedDays}일 완료`
      })
      .join('\n')

    const todoSummary = todos
      .map((t) => `- [${t.completed ? '완료' : '미완료'}] ${t.title} (우선순위: ${t.priority})`)
      .join('\n')

    const prompt = `당신은 개인 생산성 코치입니다. 사용자의 이번 주 활동 데이터를 분석하고 한국어로 피드백을 제공해 주세요.

## 이번 주 데이터 (${format(weekStartDate, 'yyyy년 MM월 dd일')} ~ ${format(weekEndDate, 'MM월 dd일')})

### 할일 완료율: ${completionRate}% (${completedTodos}/${totalTodos})

### 할일 목록:
${todoSummary || '(할일 없음)'}

### 습관 트래커:
${habitSummary || '(습관 없음)'}

위 데이터를 바탕으로 다음 형식으로 피드백을 작성해 주세요:

## 이번 주 요약
(2-3문장으로 이번 주 전반적인 성과 요약)

## 잘한 점
(구체적인 칭찬 2-3가지, bullet point)

## 개선할 점
(구체적인 개선 제안 2-3가지, bullet point)

## 다음 주 추천 액션
(실행 가능한 구체적인 액션 아이템 3가지, bullet point)

피드백은 따뜻하고 격려하는 톤으로 작성해 주세요.`

    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const feedback = message.content[0].type === 'text' ? message.content[0].text : '피드백 생성에 실패했습니다.'

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Failed to generate AI feedback:', error)
    return NextResponse.json({ error: 'AI 피드백 생성에 실패했습니다.' }, { status: 500 })
  }
}
