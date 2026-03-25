# Salesforce MCP 서버 설치 가이드

Claude에서 Salesforce 데이터를 직접 조회하고 생성/수정/삭제할 수 있게 해주는 MCP 서버 설치 가이드입니다.

---

## 완성 후 할 수 있는 것

- "이번 달에 생성된 리드 목록 보여줘"
- "홍길동 리드의 상태를 Contacted로 바꿔줘"
- "신규 리드 만들어줘 — 이름: 김철수, 회사: 테크스타트업"
- "Opportunity 중 금액 1억 이상인 것만 조회해줘"

---

## 사전 준비

- Mac 환경
- [Claude Code](https://claude.ai/download) 설치 완료
- [Homebrew](https://brew.sh) 설치 완료
- Salesforce 계정 (로그인 가능한 상태)

> **터미널 여는 방법**: `Cmd + Space` → "터미널" 검색 → 실행. 이후 모든 명령어는 터미널에 붙여넣기(`Cmd + V`) 후 Enter를 눌러 실행합니다.

---

## Step 1. Node.js & SF CLI 설치

```bash
brew install node sf
```

설치 확인:

```bash
node --version
sf --version
```

`node v18` 이상, `sf` 버전이 출력되면 정상입니다.

---

## Step 2. Salesforce 로그인

```bash
sf org login web --instance-url https://channel-b.my.salesforce.com
```

브라우저가 열리면 본인 Salesforce 계정으로 로그인합니다. 터미널에 **Successfully authorized** 메시지가 표시되면 완료입니다.

> 이 로그인은 처음 한 번만 하면 됩니다. 이후 토큰은 자동으로 갱신됩니다.

---

## Step 3. MCP 서버 등록

아래 명령어에서 `본인이메일@channel.io` 부분을 본인 Salesforce 계정 이메일로 바꿔서 실행합니다.

```bash
claude mcp add -s user salesforce \
  -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

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

Claude Code에서 아래 메시지를 입력해봅니다.

```
Salesforce에서 최근 생성된 리드 5개 보여줘
```

리드 데이터가 표시되면 설치 완료입니다.

---

## 사용 가능한 기능

| 기능 | 예시 명령어 |
|------|------------|
| 데이터 조회 | "이번 달 생성된 리드 전체 조회해줘" |
| 레코드 생성 | "새 리드 만들어줘: 이름 김철수, 회사 ABC Corp" |
| 레코드 수정 | "리드 ID 00Q1234의 Status를 Contacted로 변경해줘" |
| 레코드 삭제 | "리드 ID 00Q1234 삭제해줘" |
| 메타데이터 조회 | "Lead 오브젝트의 필드 목록 보여줘" |
| API 한도 확인 | "Salesforce API 잔여 호출 수 확인해줘" |

---

## 기존 방식(Access Token)에서 업그레이드하는 경우

이전에 `SALESFORCE_ACCESS_TOKEN` 방식으로 설정한 적 있다면 아래 단계로 정리해줘야 합니다.

**1. 기존 설정 제거**
```bash
python3 -c "
import json
with open('/Users/$(whoami)/.claude.json', 'r') as f:
    data = json.load(f)
for key in data.get('projects', {}):
    if 'salesforce' in data['projects'][key].get('mcpServers', {}):
        del data['projects'][key]['mcpServers']['salesforce']
with open('/Users/$(whoami)/.claude.json', 'w') as f:
    json.dump(data, f, indent=2)
"
claude mcp remove salesforce -s user 2>/dev/null; true
```

**2. 새 방식으로 등록** (Step 3과 동일)
```bash
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -- node /Users/$(whoami)/Downloads/Salesforce-MCP-Server/dist/index.cjs
```

---

## 문제 해결

**"Failed to connect" 오류**
→ 기존 설정이 남아있을 수 있습니다. 위 **업그레이드 단계**를 따라주세요.

**"No authorization information found" 오류**
→ Step 2의 로그인이 필요합니다: `sf org login web --instance-url https://channel-b.my.salesforce.com`

**빌드 오류 발생 시**
→ Node.js 버전을 확인합니다: `node --version` (v18 이상 필요)
