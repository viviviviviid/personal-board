import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { subDays, startOfDay } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'projectId는 필수입니다.' }, { status: 400 })
    }

    const userId = session.user.id

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        sections: {
          include: {
            todos: {
              select: { title: true, completed: true, priority: true, urgent: true, date: true, description: true },
            },
          },
          orderBy: { order: 'asc' },
        },
        todos: {
          where: { sectionId: null },
          select: { title: true, completed: true, priority: true, urgent: true, date: true, description: true },
        },
      },
    })

    if (!project) return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 })

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 503 })
    }

    const recentDate = startOfDay(subDays(new Date(), 7))
    const allTodos = [
      ...project.todos,
      ...project.sections.flatMap((s) => s.todos),
    ]
    const totalCount = allTodos.length
    const completedCount = allTodos.filter((t) => t.completed).length
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    const recentCompleted = allTodos.filter(
      (t) => t.completed && t.date && new Date(t.date) >= recentDate
    ).length

    const highPriorityPending = allTodos.filter((t) => !t.completed && t.priority === 'high')
    const urgentPending = allTodos.filter((t) => !t.completed && t.urgent)

    // 섹션별 요약
    const sectionSummary = project.sections.map((s) => {
      const total = s.todos.length
      const done = s.todos.filter((t) => t.completed).length
      return `- [${s.title}]: ${done}/${total} 완료`
    }).join('\n')

    // 미완료 할일 샘플 (최대 10개, 중요한 것 먼저)
    const pendingTodos = allTodos
      .filter((t) => !t.completed)
      .sort((a, b) => {
        const urgentDiff = (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)
        if (urgentDiff !== 0) return urgentDiff
        const pOrder = { high: 0, medium: 1, low: 2 }
        return (pOrder[a.priority as keyof typeof pOrder] ?? 1) - (pOrder[b.priority as keyof typeof pOrder] ?? 1)
      })
      .slice(0, 10)
      .map((t) => {
        const tags = [
          t.priority === 'high' ? '중요' : null,
          t.urgent ? '긴급' : null,
        ].filter(Boolean).join(', ')
        return `- ${t.title}${tags ? ` (${tags})` : ''}`
      })
      .join('\n')

    const prompt = `당신은 프로젝트 관리 전문가입니다. 아래 프로젝트 현황을 분석하고 한국어로 진단 리포트를 작성해 주세요.

## 프로젝트: ${project.name}
${project.description ? `설명: ${project.description}` : ''}
${project.goal ? `목표: ${project.goal}` : '(목표 미설정)'}

## 전체 진행률: ${completionRate}% (${completedCount}/${totalCount})
- 최근 7일 완료: ${recentCompleted}개
- 중요 미완료: ${highPriorityPending.length}개
- 긴급 미완료: ${urgentPending.length}개

## 섹션별 현황:
${sectionSummary || '(섹션 없음)'}

## 주요 미완료 항목 (우선순위 순):
${pendingTodos || '(모두 완료됨)'}

위 데이터를 바탕으로 다음 형식으로 진단 리포트를 작성해 주세요:

## 프로젝트 현황 진단
(현재 진행 상태를 2-3문장으로 — 진행률, 모멘텀, 리스크 관점에서)

## 잘 진행되고 있는 점
(2가지, bullet point)

## 주의가 필요한 점
(블로커, 지연 리스크, 우선순위 문제 등 2-3가지, bullet point)

## 다음 단계 추천
(지금 당장 집중해야 할 액션 3가지, 구체적으로, bullet point)

데이터에 근거한 솔직하고 실용적인 조언을 해주세요.`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' })
    const result = await model.generateContent(prompt)

    const diagnosis = result.response.text() || '진단 생성에 실패했습니다.'
    return NextResponse.json({ diagnosis })
  } catch (error) {
    console.error('Failed to generate project diagnosis:', error)
    return NextResponse.json({ error: '프로젝트 진단 생성에 실패했습니다.' }, { status: 500 })
  }
}
