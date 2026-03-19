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
- [Claude Desktop](https://claude.ai/download) 설치 완료
- [Homebrew](https://brew.sh) 설치 완료
- Salesforce 계정 (로그인 가능한 상태)

---

## Step 1. Node.js 설치

터미널을 열고 아래 명령어를 실행합니다.

```bash
brew install node
```

설치 확인:

```bash
node --version
```

`v18` 이상이 출력되면 정상입니다.

---

## Step 2. 서버 코드 다운로드

```bash
cd ~/Downloads
git clone https://github.com/sunny980123/Salesforce-MCP-Server.git
cd Salesforce-MCP-Server
```

---

## Step 3. 의존성 설치 및 빌드

```bash
npm install
npm run build
```

오류 없이 완료되면 성공입니다.

---

## Step 4. Salesforce CLI 설치

```bash
brew install sf
```

설치 확인:

```bash
sf --version
```

---

## Step 5. Salesforce 인증

아래 명령어를 실행하면 브라우저가 열립니다.

```bash
sf org login web --instance-url https://[내 org 주소].my.salesforce.com
```

> **내 org 주소 확인 방법**: Salesforce에 로그인했을 때 브라우저 주소창에 표시되는 URL입니다.
> 예시: `https://channel-b.my.salesforce.com` → `--instance-url https://channel-b.my.salesforce.com`

브라우저에서 Salesforce 로그인을 완료하면 터미널에 **Authentication Successful** 메시지가 표시됩니다.

---

## Step 6. Access Token 확인

```bash
sf org display --target-org [내 Salesforce 이메일] --json
```

실행 결과에서 `accessToken`과 `instanceUrl` 값을 복사해둡니다.

```json
{
  "accessToken": "00D2w000...여기가 토큰...",
  "instanceUrl": "https://channel-b.my.salesforce.com"
}
```

---

## Step 7. Claude Desktop 설정

아래 경로의 파일을 텍스트 편집기로 엽니다.

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

> **파일 열기**: Finder → 이동 → 폴더로 이동 → 위 경로 붙여넣기

파일 내용을 아래와 같이 수정합니다. (기존 내용이 있다면 `mcpServers` 안에 추가합니다)

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "node",
      "args": [
        "/Users/[내 맥 유저명]/Downloads/Salesforce-MCP-Server/dist/index.js"
      ],
      "env": {
        "SALESFORCE_ACCESS_TOKEN": "여기에 Step 6의 accessToken 값 붙여넣기",
        "SALESFORCE_INSTANCE_URL": "여기에 Step 6의 instanceUrl 값 붙여넣기"
      }
    }
  }
}
```

> **내 맥 유저명 확인**: 터미널에서 `whoami` 실행

---

## Step 8. Claude Desktop 재시작

Claude Desktop을 완전히 종료(`Cmd + Q`)하고 다시 실행합니다.

---

## Step 9. 테스트

Claude에서 아래 메시지를 입력해봅니다.

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

## 토큰 만료 시 갱신 방법

Salesforce Access Token은 일정 시간이 지나면 만료됩니다. 오류가 발생하면 아래 순서로 갱신합니다.

**1. 새 토큰 발급**

```bash
sf org login web --instance-url https://[내 org 주소].my.salesforce.com
sf org display --target-org [내 Salesforce 이메일] --json
```

**2. 설정 파일 업데이트**

`claude_desktop_config.json`의 `SALESFORCE_ACCESS_TOKEN` 값을 새 토큰으로 교체합니다.

**3. Claude Desktop 재시작**

---

## 문제 해결

**"Server disconnected" 오류**
→ `claude_desktop_config.json`의 파일 경로와 토큰 값이 정확한지 확인합니다.

**"Authentication failed" 오류**
→ 토큰이 만료된 것입니다. 위 **토큰 만료 시 갱신 방법**을 따릅니다.

**빌드 오류 발생 시**
→ Node.js 버전을 확인합니다: `node --version` (v18 이상 필요)
