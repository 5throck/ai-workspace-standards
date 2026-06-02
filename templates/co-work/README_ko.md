---
sync_version: 1
translated_from_hash: TBD
---

# {{PROJECT_NAME}}

> **Status**: Stable — v1.0.0

AI 기반 지식 업무 워크스페이스 템플릿. 구조화된 멀티 에이전트 아키텍처를 통해 문서 중심 프로젝트, 리서치, 크로스펑셔널 팀 협업에 최적화되어 있습니다.

## 개요

co-work 템플릿은 작성, 리서치, 협업을 위해 AI 어시스턴트를 활용하는 지식 업무 프로젝트를 위한 즉시 사용 가능한 워크스페이스를 제공합니다. Claude Code(`CLAUDE.md`)와 Gemini(`GEMINI.md`)를 구조화된 멀티 에이전트 시스템과 결합하여, 모든 프로젝트에 첫날부터 일관된 명령, 에이전트 역할, 품질 관리를 제공합니다.

## 빠른 시작

> 워크스페이스 루트에서 새 프로젝트를 스캐폴딩하려면 다음을 실행하세요:
> `scripts/new-project.sh "project-name" --variant co-work`

## 에이전트

| 에이전트 | 역할 |
|----------|------|
| **PM** | 작업 단계 오케스트레이션, 브리프 작성, 작업 순서 관리 및 이해관계자 조율 |
| **Analyst** | 리서치 종합, 데이터 분석, 인사이트 문서화 |
| **Content Writer** | 장문 작성, 보고서 초안, 편집 검토 |
| **Technical Writer** | 프로세스 문서화, 참조 가이드, 구조화된 지식 베이스 문서 |
| **Project Coordinator** | 크로스펑셔널 작업 추적, 회의 진행, 상태 보고 |
