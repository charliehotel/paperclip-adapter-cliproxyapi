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
3. **Local Path**를 선택하고 본 어댑터 저장소를 클론한 폴더의 절대 경로를 입력합니다:
   ```text
   /path/to/paperclip-adapter-cliproxyapi
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

## 라이선스

MIT
