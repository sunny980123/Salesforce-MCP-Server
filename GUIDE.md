# Salesforce MCP 서버 설치 가이드

Claude에서 Salesforce 데이터를 직접 조회하고 생성/수정할 수 있게 해주는 MCP 서버 설치 가이드입니다. 비개발자도 5분 안에 따라할 수 있도록 구성되어 있습니다.

---

## 완성 후 할 수 있는 것

- "이번 달에 생성된 리드 목록 보여줘"
- "홍길동 리드의 상태를 Contacted로 바꿔줘"
- "신규 리드 만들어줘 — 이름: 김철수, 회사: 테크스타트업"
- "Opportunity 중 금액 1억 이상인 것만 조회해줘"

---

## 사전 준비

- Mac 환경
- [Homebrew](https://brew.sh) 설치 완료
- Salesforce 계정 (로그인 가능한 상태)

> **터미널 여는 방법**: `Cmd + Space` → "터미널" 검색 → 실행. 이후 모든 명령어는 터미널에 붙여넣기(`Cmd + V`) 후 Enter를 눌러 실행합니다.

---

## Step 1. Node.js, SF CLI, Claude Code 설치

```bash
brew install node sf
npm install -g @anthropic-ai/claude-code
```

설치 확인:

```bash
node --version
sf --version
claude --version
```

세 가지 모두 버전이 출력되면 정상입니다. (Node는 v18 이상)

---

## Step 2. Salesforce 로그인

```bash
sf org login web --instance-url https://channel-b.my.salesforce.com
```

브라우저가 열리면 본인 `@channel.io` 계정으로 로그인합니다. 터미널에 **Successfully authorized** 메시지가 표시되면 완료입니다.

> 이 로그인은 처음 한 번만 하면 됩니다. 이후 토큰은 자동으로 갱신됩니다.

---

## Step 3. MCP 서버 등록

아래 명령어에서 `본인이메일@channel.io` 부분을 본인 Salesforce 계정 이메일로 바꿔서 **한 줄로** 실행합니다.

```bash
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y @sunny980123/salesforce-mcp-server
```

> ⚠️ **대괄호(`[`, `]`)는 쓰지 마세요.** `SALESFORCE_SF_CLI_USERNAME=neil@channel.io` 처럼 값만 넣어야 합니다.

---

## Step 4. 확인

```bash
claude mcp list
```

아래와 같이 표시되면 완료입니다.

```
salesforce: ... - ✓ Connected
```

---

## Step 5. 테스트

Claude Code를 열고 아래 메시지를 입력해봅니다.

```
Salesforce에서 최근 생성된 리드 5개 보여줘
```

리드 데이터가 표시되면 설치 완료입니다 🎉

---

## 사용 가능한 기능

| 기능 | 예시 명령어 |
|------|------------|
| 데이터 조회 | "이번 달 생성된 리드 전체 조회해줘" |
| 레코드 생성 | "새 리드 만들어줘: 이름 김철수, 회사 ABC Corp" |
| 레코드 수정 | "리드 ID 00Q1234의 Status를 Contacted로 변경해줘" |
| 메타데이터 조회 | "Lead 오브젝트의 필드 목록 보여줘" |
| API 한도 확인 | "Salesforce API 잔여 호출 수 확인해줘" |

> **기본 권한**: `SALESFORCE_NO_DELETE=true` 설정으로 **삭제는 불가**합니다. (조회/생성/수정은 모두 가능)

---

## 기존 방식(Access Token)에서 업그레이드하는 경우

이전에 `SALESFORCE_ACCESS_TOKEN` 하드코딩 방식으로 설정했다면 아래 단계로 정리해주세요.

**1. 기존 설정 제거**

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/.claude.json')
with open(path, 'r') as f:
    data = json.load(f)
for key in list(data.get('projects', {}).keys()):
    if 'salesforce' in data['projects'][key].get('mcpServers', {}):
        del data['projects'][key]['mcpServers']['salesforce']
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
print('Cleaned up project-scoped salesforce entries.')
"
claude mcp remove salesforce -s user 2>/dev/null; true
```

**2. Step 2 (Salesforce 로그인)부터 새로 진행**

이후 자동으로 토큰 갱신되므로 토큰 업데이트 작업이 불필요해집니다.

---

## 문제 해결

### `zsh: command not found: claude`

Claude Code가 설치되지 않았습니다.

```bash
npm install -g @anthropic-ai/claude-code
```

### `zsh: command not found: -e`

명령어를 여러 줄로 복사하다가 줄바꿈이 잘못 들어간 경우입니다. **한 줄로** 복사해서 다시 실행하세요.

### `NamedOrgNotFoundError: No authorization information found`

Step 2의 로그인이 되어 있지 않거나, `SALESFORCE_SF_CLI_USERNAME` 값이 잘못 들어갔습니다.

```bash
# 현재 로그인된 org 목록 확인
sf org list

# 필요하면 재로그인
sf org login web --instance-url https://channel-b.my.salesforce.com

# MCP 재등록 (본인 이메일 정확히 — 대괄호 없이)
claude mcp remove salesforce -s user
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y @sunny980123/salesforce-mcp-server
```

### `claude mcp list`에서 salesforce가 안 보임

프로젝트별 설정(`-s project`)이 아닌 **유저 스코프(`-s user`)** 로 등록했는지 확인하세요. 홈 디렉토리(`~`)에서 `claude mcp list` 실행 시 보여야 정상입니다.

### "Failed to connect" / `sf: command not found`

MCP 프로세스가 `sf` 명령어를 못 찾는 문제입니다. 등록 시 `PATH=/opt/homebrew/bin:...`을 반드시 포함했는지 확인하세요.

### 빌드 오류 / Node 관련 오류

```bash
node --version    # v18 이상이어야 함
```

낮은 버전이면 `brew upgrade node`로 업그레이드 후 다시 시도하세요.

---

## 소스에서 직접 빌드 (개발자용)

서버 코드를 수정하거나 기여하려면:

```bash
git clone https://github.com/sunny980123/Salesforce-MCP-Server.git
cd Salesforce-MCP-Server
npm install && npm run build
```

로컬 빌드로 MCP 등록:

```bash
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- node ~/Salesforce-MCP-Server/dist/index.cjs
```
