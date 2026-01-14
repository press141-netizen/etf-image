# ETF 테마 이미지 라이브러리

ETF 테마 이미지를 관리하는 웹 애플리케이션입니다.

## 기능

- 이미지 업로드 및 관리
- 서비스별 이미지 크기 자동 조정 (리타민, ETFG, COMPG)
- 테마별 이미지 그룹화
- 태그, 담당자, 상태 관리
- 이미지 검색 및 필터링

## 서버 실행

```bash
# 의존성 설치
npm install

# 서버 실행
node server.js

# 또는 백그라운드 실행
nohup node server.js > server.log 2>&1 &

# PM2 사용 시 (권장)
pm2 start server.js --name etf-image-library
pm2 save
```

## 접속

```
http://서버IP:3000
```

## 포트 변경

환경변수로 포트 지정 가능:
```bash
PORT=8080 node server.js
```

## 서비스별 이미지 크기

| 서비스 | 크기 |
|--------|------|
| 리타민 | 1280×853 |
| ETFG | 1280×853 |
| COMPG | 1280×332 |

## 파일 구조

```
etf-image-library-server/
├── public/
│   └── index.html      # 프론트엔드
├── uploads/            # 업로드된 이미지
├── data/
│   └── images.json     # 이미지 데이터
├── server.js           # Express 서버
└── package.json
```

## PM2로 서버 관리 (권장)

```bash
# PM2 설치
npm install -g pm2

# 서버 시작
pm2 start server.js --name etf-image-library

# 상태 확인
pm2 status

# 로그 확인
pm2 logs etf-image-library

# 서버 재시작
pm2 restart etf-image-library

# 서버 중지
pm2 stop etf-image-library

# 시스템 재부팅 시 자동 시작
pm2 startup
pm2 save
```
