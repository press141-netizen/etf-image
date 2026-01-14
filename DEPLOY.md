# 회사 서버 배포 가이드

## 1. Node.js 설치 (없는 경우)

```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 버전 확인
node -v  # v20.x.x
npm -v
```

## 2. 프로젝트 설치

```bash
# 원하는 위치에 압축 해제
cd /var/www
unzip etf-image-library-server.zip
cd etf-image-library-server

# 의존성 설치
npm install
```

## 3. PM2로 서버 실행

```bash
# PM2 설치
sudo npm install -g pm2

# 서버 시작
pm2 start server.js --name etf-image-library

# 시스템 재부팅 시 자동 시작
pm2 startup
pm2 save

# 상태 확인
pm2 status
```

## 4. Nginx 설정

```bash
# Nginx 설치 (없는 경우)
sudo apt install nginx -y

# 설정 파일 복사
sudo cp nginx.conf.example /etc/nginx/sites-available/etf-image-library

# 도메인 수정
sudo nano /etc/nginx/sites-available/etf-image-library
# server_name을 본인 도메인으로 변경

# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/etf-image-library /etc/nginx/sites-enabled/

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

## 5. 방화벽 설정

```bash
# UFW 사용 시
sudo ufw allow 80
sudo ufw allow 443
```

## 6. SSL 인증서 (HTTPS) - 선택

```bash
# Let's Encrypt 무료 인증서
sudo apt install certbot python3-certbot-nginx -y

# 인증서 발급 (도메인 변경)
sudo certbot --nginx -d etf-library.example.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

## 7. 접속 확인

```
http://etf-library.example.com
또는
https://etf-library.example.com (SSL 설정 시)
```

---

## 문제 해결

### 502 Bad Gateway
```bash
# Node.js 서버 실행 확인
pm2 status
pm2 logs etf-image-library
```

### 권한 오류
```bash
# uploads 폴더 권한
sudo chown -R $USER:$USER /var/www/etf-image-library-server
chmod -R 755 /var/www/etf-image-library-server/uploads
```

### 포트 변경
```bash
# 3000 외 다른 포트 사용 시
PORT=8080 pm2 start server.js --name etf-image-library

# nginx.conf.example에서도 포트 변경
# proxy_pass http://127.0.0.1:8080;
```
