# paperclip-adapter-cliproxyapi

[🇺🇸 English Version](./README.md)

[Paperclip](https://github.com/paperclipai/paperclip) 에이전트를 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 백엔드와 연동하기 위한 외부 어댑터 플러그인입니다. 로컬에서 구동되는 OpenAI 호환 프록시인 CLIProxyAPI를 통해 Google Gemini, Anthropic Claude, Antigravity 계열 모델을 Paperclip 에이전트의 구동 엔진으로 활용할 수 있습니다.

## 주요 기능

- **표준 사양 준수**: Paperclip의 `ServerAdapterModule` 인터페이스 규격을 완전히 구현합니다.
- **선언적 설정 화면 지원**: 설정 스키마(`getConfigSchema`)를 제공하여 접속 설정(Base URL, API Key, Temperature)을 Paperclip UI에서 간편하게 구성할 수 있습니다.
- **안정적인 연결 테스트**: 프론트엔드 React 컴포넌트 규격(`AdapterEnvironmentTestResult`)과 일치하는 `testEnvironment` 진단 모듈을 구현하여, 테스트 버튼 클릭 시 화면 크래시(검은 화면 현상) 없이 결과를 출력합니다.
- **동적 모델 탐색**: CLIProxyAPI 서버가 제공하는 전체 모델 목록을 드롭다운(`Primary model`)으로 즉시 동기화합니다.

## 사전 준비 사항

- **Paperclip**이 설치 및 실행 중이어야 합니다.
- **CLIProxyAPI** 서버가 로컬에서 구동 중이어야 합니다. (기본 포트: `http://127.0.0.1:8317/v1`)

## 설치 방법

Paperclip UI 화면을 통해 플러그인 어댑터를 직접 등록할 수 있습니다:

1. Paperclip 브라우저 화면의 **Instance Settings** -> **Adapters** 메뉴로 이동합니다.
2. **Install Adapter** 버튼을 클릭합니다.
3. **Local Path**를 선택하고 본 저장소를 클론한 폴더의 전체 절대 경로를 입력합니다.

   *예시 (macOS/Linux):*
   ```text
   /Users/yourname/paperclip-adapter-cliproxyapi
   ```

   *예시 (Windows):*
   ```text
   C:\Users\yourname\paperclip-adapter-cliproxyapi
   ```
4. **Install**을 클릭하면 컴파일 및 빌드가 자동으로 수행되며 `cliproxyapi` 타입의 어댑터가 등록됩니다.

*또는 `.paperclip/adapter-plugins.json` 설정 파일에 직접 플러그인 정보를 작성하여 수동 등록할 수도 있습니다.*

## 설정 방법

어댑터 설치가 완료되면 에이전트 구동 엔진으로 적용할 수 있습니다:

1. 에이전트 관리 페이지에서 **Configuration** 탭으로 이동합니다.
2. **Adapter Type**을 **CLIProxyAPI**로 변경합니다.
3. 화면에 **Primary model** 드롭다운이 나타나며, CLIProxyAPI 서버에서 탐색된 모델 목록(예: `claude-sonnet-4-6`, `gemini-3.1-pro`, `agy-3.5-flash-high` 등)이 연동됩니다.
4. **Permissions & Configuration** 항목에 어댑터 관련 설정을 입력합니다:
   - **Base URL**: CLIProxyAPI 접속 경로 (기본값: `http://127.0.0.1:8317/v1`)
   - **API Key**: API 인증키 (기본값: `paperclip-local`)
   - **Temperature**: 샘플링 온도 (기본값: `0.2`)
5. **Test** 버튼을 눌러 연결 상태가 `Passed`로 표시되는지 확인합니다.
6. **Save**를 클릭하여 설정을 저장합니다.

## 개발 가이드

수정이 필요할 경우 본 저장소를 복사한 뒤 다음 명령어로 빌드 및 테스트를 수행할 수 있습니다:

```bash
# 의존성 패키지 설치
pnpm install

# TypeScript 컴파일 및 ESM 번들 빌드
pnpm build

# 개발 모드(실시간 감지 빌드) 실행
pnpm dev
```

## 스크린샷

### 1. 로컬 경로를 통한 외부 어댑터 설치
![로컬 경로를 통한 외부 어댑터 설치](01_install_external_adapter_local_path.png)

### 2. 설치 완료된 외부 어댑터 목록
![설치 완료된 외부 어댑터 목록](02_external_adapters_installed.png)

### 3. 에이전트 어댑터 설정 정보 입력
![에이전트 어댑터 설정 정보 입력](03_agent_adapter_setting_cliproxyapi.png)

### 4. 주 모델(Primary Model) 선택 및 연결 테스트 완료
![주 모델 선택 및 연결 테스트 완료](04_cliproxyapi_model_selection.png)

## 릴리즈 노트

<details>
<summary><b>v0.1.3</b></summary>

- **에이전트 인증 수정:** `supportsLocalAgentJwt`를 활성화하여 Paperclip API 호출이 `local-board`가 아닌 실행 에이전트로 귀속되도록 수정했습니다. 이로 인해 완료된 이슈가 다시 `todo`로 돌아가는 문제가 해결되었습니다.
- **작업공간 문맥 수정:** 도구 호출 시 파일 경로와 명령어 실행이 Paperclip 서버 디렉터리가 아닌 실제 에이전트 실행 작업공간(`context.paperclipWorkspace.cwd`)을 기준으로 처리되도록 수정했습니다.
- **진단 로깅:** 시작 로그에 `workspace.cwd`와 `authToken` 존재 여부를 추가했습니다.

</details>

<details>
<summary><b>v0.1.2</b></summary>

- **도구 실행 (Phase 2):** `read_file`, `list_directory`, `run_command`, `write_file`, `update_issue`, `add_comment` 총 6개 도구를 추가하여 LLM이 파일 시스템 및 Paperclip API와 직접 상호작용할 수 있도록 했습니다.
- **Paperclip API 경로 수정:** `update_issue`와 `add_comment`가 잘못된 경로(`/issues/...`)를 사용하던 문제를 수정했습니다(`/api/issues/...`). 이 오류로 인해 404 응답이 발생하고 종결 흐름이 깨졌습니다.
- **인증 헤더 포함:** 모든 Paperclip API 호출에 `Authorization: Bearer`, `X-Paperclip-Run-Id`, `Content-Type` 헤더가 포함됩니다.
- **안전 장치:** 셸 명령어 실행 시 30초 타임아웃과 50K 자 출력 제한이 적용됩니다.

</details>

<details>
<summary><b>v0.1.1</b></summary>

- **컨텍스트 유실 버그 수정 (Phase 1):** `execute.ts`의 `buildPrompt` 로직을 전면 재작성하여 Paperclip이 제공하는 전체 컨텍스트가 모델에 전달되도록 수정했습니다.
- **시스템 메시지 지원:** 에이전트 실행 계약(execution contract)과 `AGENTS.md` 지침이 `system` 메시지로 올바르게 전달됩니다.
- **Wake 페이로드 지원:** 이슈 본문, 댓글, 작업 마크다운, 이전 실행 요약(continuation summary) 및 실행 단계 정보가 모두 누락 없이 포함됩니다.
- **도구 호출(Tool-Call) 루프 기반 마련:** 모델이 도구를 호출할 경우 대화가 끊기지 않도록 최대 25턴까지 지속되는 멀티 턴 루프를 구현했습니다.
- **진단 로깅 강화:** 컨텍스트 키 목록, 프롬프트 길이, 턴 수 등을 기록하는 디버그 로그를 추가했습니다.

</details>

## 라이선스

MIT
