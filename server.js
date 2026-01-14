const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, 'data', 'images.json');

// 데이터 초기화
function initializeData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      images: [],
      lastId: 0
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

// 데이터 읽기
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { images: [], lastId: 0 };
  }
}

// 데이터 저장
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // 한글 파일명 처리
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const uniqueName = `${Date.now()}-${baseName}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  }
});

// ============ API 엔드포인트 ============

// 모든 이미지 조회
app.get('/api/images', (req, res) => {
  const data = readData();
  res.json(data.images);
});

// 파일명에서 서비스명과 테마명 추출
function parseFileName(fileName) {
  // 확장자 제거
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // 서비스명 목록 (긴 것부터 매칭하기 위해 정렬)
  const serviceNames = ['ETFG', 'COMPG', '리타민'];
  
  let service = '미분류';
  let theme = '미분류';
  
  for (const serviceName of serviceNames) {
    if (nameWithoutExt.startsWith(serviceName + '_')) {
      service = serviceName;
      // 서비스명 뒤의 부분을 테마명으로
      theme = nameWithoutExt.substring(serviceName.length + 1);
      // 테마명에서 추가 언더스코어가 있으면 첫 번째 부분만 (예: 2차전지_v2 -> 2차전지)
      // 필요시 아래 주석 해제
      // theme = theme.split('_')[0];
      break;
    }
  }
  
  // 서비스명을 못 찾은 경우, 언더스코어로 분리 시도
  if (service === '미분류' && nameWithoutExt.includes('_')) {
    const parts = nameWithoutExt.split('_');
    theme = parts[parts.length - 1]; // 마지막 부분을 테마명으로
  }
  
  return { service, theme };
}

// 이미지 업로드
app.post('/api/images', upload.array('files', 20), (req, res) => {
  try {
    const data = readData();
    const manualTheme = req.body.theme; // 수동 입력한 테마
    const mergeMode = req.body.merge === 'true'; // 병합 모드 여부
    
    const newImages = [];
    const mergedImages = [];
    
    for (const file of req.files) {
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      
      // 파일명에서 자동 분류
      const parsed = parseFileName(originalName);
      
      // 수동 입력 테마가 있으면 그걸 사용, 없으면 자동 분류
      const finalTheme = manualTheme && manualTheme.trim() !== '' 
        ? manualTheme 
        : parsed.theme;
      
      // 같은 테마의 기존 이미지 찾기 (병합 모드일 때)
      const existingImageIndex = mergeMode ? 
        data.images.findIndex(img => img.theme === finalTheme) : -1;
      
      if (existingImageIndex !== -1 && parsed.service !== '미분류') {
        // 기존 이미지에 서비스 추가
        const existingImage = data.images[existingImageIndex];
        
        // 서비스 배열로 변환
        let services = Array.isArray(existingImage.service) 
          ? [...existingImage.service] 
          : (existingImage.service && existingImage.service !== '미분류' ? [existingImage.service] : []);
        
        // 새 서비스 추가 (중복 아니면)
        if (!services.includes(parsed.service)) {
          services.push(parsed.service);
        }
        
        // 서비스별 이미지 추가
        const serviceImages = existingImage.serviceImages || {};
        serviceImages[parsed.service] = `/uploads/${file.filename}`;
        
        // 기존 이미지 업데이트
        data.images[existingImageIndex].service = services;
        data.images[existingImageIndex].serviceImages = serviceImages;
        data.images[existingImageIndex].url = `/uploads/${file.filename}`; // 썸네일도 업데이트
        data.images[existingImageIndex].updatedAt = new Date().toISOString();
        
        mergedImages.push({
          id: existingImage.id,
          theme: finalTheme,
          addedService: parsed.service,
          merged: true
        });
      } else {
        // 새 이미지로 추가
        data.lastId += 1;
        
        const newImage = {
          id: data.lastId,
          name: originalName,
          filename: file.filename,
          service: parsed.service !== '미분류' ? [parsed.service] : ['미분류'],
          theme: finalTheme,
          themeDescription: '',
          status: 'candidate',
          tags: finalTheme && finalTheme !== '미분류' ? [finalTheme] : [],
          mood: [],
          assignees: [],
          prompt: '',
          memo: '',
          serviceImages: parsed.service !== '미분류' ? { [parsed.service]: `/uploads/${file.filename}` } : {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: `/uploads/${file.filename}`
        };
        
        newImages.push(newImage);
      }
    }
    
    data.images = [...newImages, ...data.images];
    saveData(data);
    
    res.json({ 
      success: true, 
      images: newImages,
      merged: mergedImages,
      message: mergedImages.length > 0 
        ? `${newImages.length}개 새 이미지, ${mergedImages.length}개 기존 테마에 병합됨`
        : `${newImages.length}개 이미지 업로드됨`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 이미지 정보 수정
app.put('/api/images/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const data = readData();
    
    const index = data.images.findIndex(img => img.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 허용된 필드만 업데이트
    const allowedFields = ['theme', 'themeDescription', 'status', 'tags', 'mood', 'prompt', 'memo', 'name', 'service', 'serviceImages', 'assignees'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        data.images[index][field] = updates[field];
      }
    });
    
    // 수정 시간 자동 업데이트
    data.images[index].updatedAt = new Date().toISOString();
    
    saveData(data);
    res.json({ success: true, image: data.images[index] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 이미지 삭제
app.delete('/api/images/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = readData();
    
    const image = data.images.find(img => img.id === id);
    if (!image) {
      return res.status(404).json({ success: false, error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 파일 삭제
    const filePath = path.join(__dirname, 'uploads', image.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // 데이터에서 제거
    data.images = data.images.filter(img => img.id !== id);
    saveData(data);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 테마 목록 조회
app.get('/api/themes', (req, res) => {
  const data = readData();
  const themes = [...new Set(data.images.map(img => img.theme))].sort();
  res.json(themes);
});

// 통계 조회
app.get('/api/stats', (req, res) => {
  const data = readData();
  const stats = {
    total: data.images.length,
    byStatus: {
      final: data.images.filter(img => img.status === 'final').length,
      candidate: data.images.filter(img => img.status === 'candidate').length,
      reference: data.images.filter(img => img.status === 'reference').length
    },
    themes: [...new Set(data.images.map(img => img.theme))].length
  };
  res.json(stats);
});

// 일괄 상태 변경
app.put('/api/images/bulk/status', (req, res) => {
  try {
    const { ids, status } = req.body;
    const data = readData();
    
    ids.forEach(id => {
      const index = data.images.findIndex(img => img.id === id);
      if (index !== -1) {
        data.images[index].status = status;
      }
    });
    
    saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 이미지 리사이즈 다운로드
app.get('/api/images/:id/download', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const width = parseInt(req.query.width) || null;
    const height = parseInt(req.query.height) || null;
    const service = req.query.service || null;
    
    const data = readData();
    const image = data.images.find(img => img.id === id);
    
    if (!image) {
      return res.status(404).json({ success: false, error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 서비스별 이미지 다운로드
    if (service && image.serviceImages && image.serviceImages[service]) {
      const serviceFilename = image.serviceImages[service].replace('/uploads/', '');
      const filePath = path.join(__dirname, 'uploads', serviceFilename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(image.name);
        const baseName = path.basename(image.name, ext);
        const downloadName = `${baseName}_${service}${ext}`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
        return res.sendFile(filePath);
      }
    }
    
    const filePath = path.join(__dirname, 'uploads', image.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
    }
    
    // 리사이즈가 필요한 경우
    if (width && height) {
      const sharp = require('sharp');
      
      const resizedBuffer = await sharp(filePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .toBuffer();
      
      const ext = path.extname(image.name);
      const baseName = path.basename(image.name, ext);
      const downloadName = `${baseName}_${width}x${height}${ext}`;
      
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
      res.setHeader('Content-Type', 'image/png');
      res.send(resizedBuffer);
    } else {
      // 원본 다운로드
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(image.name)}`);
      res.sendFile(filePath);
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 서비스별 이미지 업로드
app.post('/api/images/:id/service-image', upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const service = req.body.service;
    
    if (!service) {
      return res.status(400).json({ success: false, error: '서비스명이 필요합니다.' });
    }
    
    const data = readData();
    const index = data.images.findIndex(img => img.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, error: '이미지를 찾을 수 없습니다.' });
    }
    
    // 서비스별 이미지 크기 설정
    const serviceSizes = {
      '리타민': { width: 1280, height: 853 },
      'ETFG': { width: 1280, height: 853 },
      'COMPG': { width: 1280, height: 332 }
    };
    
    const size = serviceSizes[service];
    if (!size) {
      return res.status(400).json({ success: false, error: '알 수 없는 서비스입니다.' });
    }
    
    // 이미지 리사이즈
    const sharp = require('sharp');
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const baseName = path.basename(data.images[index].name, path.extname(data.images[index].name));
    const newFilename = `${Date.now()}-${baseName}_${service}${ext}`;
    const outputPath = path.join(__dirname, 'uploads', newFilename);
    
    await sharp(req.file.path)
      .resize(size.width, size.height, {
        fit: 'cover',
        position: 'center'
      })
      .toFile(outputPath);
    
    // 원본 업로드 파일 삭제
    fs.unlinkSync(req.file.path);
    
    // 기존 서비스 이미지가 있으면 삭제
    if (data.images[index].serviceImages && data.images[index].serviceImages[service]) {
      const oldFile = data.images[index].serviceImages[service].replace('/uploads/', '');
      const oldPath = path.join(__dirname, 'uploads', oldFile);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }
    
    // serviceImages 업데이트
    if (!data.images[index].serviceImages) {
      data.images[index].serviceImages = {};
    }
    data.images[index].serviceImages[service] = `/uploads/${newFilename}`;
    
    // 썸네일(url)을 마지막 업로드 이미지로 변경
    data.images[index].url = `/uploads/${newFilename}`;
    data.images[index].updatedAt = new Date().toISOString();
    
    saveData(data);
    
    res.json({ 
      success: true, 
      serviceImages: data.images[index].serviceImages,
      url: data.images[index].url
    });
  } catch (error) {
    console.error('Service image upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 서버 시작
initializeData();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🖼️  ETF 테마 이미지 라이브러리 서버가 시작되었습니다!      ║
║                                                            ║
║   로컬 접속:  http://localhost:${PORT}                       ║
║   네트워크:  http://[서버IP]:${PORT}                         ║
║                                                            ║
║   종료하려면 Ctrl+C 를 누르세요                              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Vercel Serverless 지원
module.exports = app;
