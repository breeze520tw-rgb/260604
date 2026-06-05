/*
----- Coding Tutorial by Patt Vira ----- 
Name: Valentine's Day Specials 2025 with ml5.js
Video Tutorial: https://youtu.be/7eogDirFdGI

Connect with Patt: @pattvira
https://www.pattvira.com/
----------------------------------------
*/

let handPose;
let video;
let hands = [];
// 不要在 video/source 層面鏡像，改由畫面決定是否翻轉
let options = {flipHorizontal: false};
let leftHand, rightHand;

let pts = []; let heartColor = 255;
let hearts = []; let heartCreated = false;
let colorPalette = ["#70d6ff","#ff70a6","#ff9770","#ffd670","#e9ff70"];

let videoSrcW = 640;
let videoSrcH = 480;
let dispW = 0;
let dispH = 0;
let dispX = 0;
let dispY = 0;
let sx = 1;
let sy = 1;
let palmOpen = false;
let cameraError = '';
let modelLoaded = false;

// 知識題庫
let facts = [
  "海獺會手牽手睡覺以防止被洋流沖散",
  "章魚有三顆心臟和九顆腦袋，能夠獨立思考",
  "大象擁有四個朝前彎曲的膝蓋，但無法跳躍",
  "受限於頸椎的構造，豬無法直接看到正上方的天空",
  "海豚睡覺每次只讓一半的大腦進入睡眠狀態",
  "蝴蝶的味覺感應器位於牠們的腳上",
  "蜜蜂擁有圖像識別能力，能辨認人臉",
  "鱷魚的舌頭被一層薄膜固定在口腔底部，無法吐舌頭",
  "袋熊是世界上唯一會排出立方體形狀糞便的動物",
  "鴕鳥的眼球比腦袋大",
  "狗的鼻紋和人類指紋一樣不會重複",
  "火鶴其實剛出生時是灰白色的，長大後才變成粉紅色"
];

let currentFact = null;
let currentFactIndex = -1;
let factDisplayTime = 0;
let factDuration = 300; // 5秒顯示知識（基於60fps）
let palmWasOpen = false;
let palmOpenFrames = 0;
let palmClosedFrames = 0;
let palmOpenThreshold = 10; // 更快觸發開手
let palmClosedThreshold = 10; // 更快重置關手
let activeEffects = [];
let startParticles = [];
let started = false;
let startButton = {x: 0, y: 0, w: 0, h: 0};

function preload() {
  // keep preload empty; model will be initialized after video is ready
}

function setup() {
  window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled rejection:', event.reason);
    cameraError = event.reason ? event.reason.toString() : 'Unhandled rejection';
  });

  window.addEventListener('error', event => {
    console.error('Window error:', event.message);
    cameraError = event.message || 'Window error';
  });

  async function startApp() {
    await mainSetup();
  }

  startApp();
}

async function mainSetup() {
  // 建立全螢幕畫布
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  // 先給預設解析度，待 metadata 載入後更新真實解析度
  video.size(640, 480);
  video.hide();
  // 取得實際相機解析度以計算正確的縮放比
  video.elt.onloadedmetadata = () => {
    if (video.elt.videoWidth && video.elt.videoHeight) {
      videoSrcW = video.elt.videoWidth;
      videoSrcH = video.elt.videoHeight;
    }
  };
  // 初始化 ml5 handpose 模型並監聽預測結果
  try {
    handPose = await ml5.handpose(video.elt);
    console.log('handpose model loaded');
    modelLoaded = true;
    handPose.on('predict', gotHands);
  } catch (error) {
    console.error('handpose init failed', error);
    cameraError = error.message || 'Handpose init failed';
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // 調整影片解析度以配合畫布
  if (video && video.size) {
    video.size(windowWidth, windowHeight);
  }
}

function draw() {
  // 背景黑色（空白區塊顯示為黑）
  background(0);

  if (!started) {
    drawStartScreen();
    return;
  }

  // 如果影片尚未有可用影格，顯示提示訊息
  if (!(video && video.elt && video.elt.readyState >= 2)) {
    push();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    if (cameraError) {
      text('相機初始化失敗：' + cameraError, width / 2, height / 2);
    } else {
      text('請在本機伺服器上開啟此頁並允許攝影機存取', width / 2, height / 2);
    }
    pop();
    return;
  }

  // 計算保持長寬比的顯示尺寸（信箱式 letterbox）
  let videoAspect = videoSrcW / videoSrcH;
  let canvasAspect = width / height;
  if (canvasAspect > videoAspect) {
    // 畫布較寬：以高度為基準
    dispH = height;
    dispW = videoAspect * dispH;
  } else {
    // 畫布較窄：以寬度為基準
    dispW = width;
    dispH = dispW / videoAspect;
  }
  dispX = (width - dispW) / 2;
  dispY = (height - dispH) / 2;

  // 縮放比（將模型輸出座標映射到顯示尺寸）
  sx = dispW / videoSrcW;
  sy = dispH / videoSrcH;

  // 將後續繪製放入水平鏡像且已對齊顯示區域的坐標系中
  push();
  translate(dispX + dispW, dispY);
  scale(-1, 1);

  // 畫出視訊影像（依照計算好的顯示尺寸，不會拉寬）
  image(video, 0, 0, dispW, dispH);

  // 更新手部位置資料（原始 model 座標保留，不在此改變）
  try {
    trackHandPosition();
  } catch (e) {
    console.error('trackHandPosition error', e);
  }

  // 使用縮放後的座標繪製形狀與愛心
  fill(heartColor);
  noStroke();
  beginShape();
  for (let i = 0; i < pts.length; i++) {
    if (pts[i]) {
      vertex(pts[i].x * sx, pts[i].y * sy);
    }
  }
  endShape(CLOSE);

  checkForHeart();

  for (let i = 0; i < hearts.length; i++) {
    try {
      hearts[i].update();
      if (hearts[i].done == true) {
        hearts.splice(i, 1);
      }
    } catch (e) {
      console.error('heart update error', e);
    }
  }

  for (let i = 0; i < hearts.length; i++) {
    hearts[i].display();
  }

  pop();

  palmOpen = isAnyPalmOpen();
  if (palmOpen) {
    palmOpenFrames++;
    palmClosedFrames = 0;
  } else {
    palmClosedFrames++;
  }

  let steadyOpen = palmOpenFrames >= palmOpenThreshold;

  if (steadyOpen && !palmWasOpen) {
    currentFactIndex = floor(random(facts.length));
    currentFact = facts[currentFactIndex];
    factDisplayTime = 0;
    activeEffects = [];
    palmWasOpen = true;
  }

  if (!palmOpen && palmWasOpen && palmClosedFrames >= palmClosedThreshold) {
    currentFact = null;
    currentFactIndex = -1;
    activeEffects = [];
    palmWasOpen = false;
    palmOpenFrames = 0;
  }

  if (palmWasOpen && currentFact !== null) {
    spawnFactEffects(currentFactIndex);
    updateAndDisplayEffects();
    displayFactBox();
  }
}


function getHandKeypoints(hand) {
  if (!hand) return null;
  const points = hand.keypoints && hand.keypoints.length ? hand.keypoints : hand.landmarks && hand.landmarks.length ? hand.landmarks : null;
  if (!points) return null;
  return points.map(point => {
    if (Array.isArray(point)) {
      return {x: point[0], y: point[1]};
    }
    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
      return {x: point.x, y: point.y};
    }
    if (point && point.position && typeof point.position.x === 'number' && typeof point.position.y === 'number') {
      return {x: point.position.x, y: point.position.y};
    }
    return null;
  }).filter(p => p);
}

function trackHandPosition() {
  let updatedPts = [];
  for (let i = 0; i < hands.length; i++) {
    let hand = hands[i]; 
    let handedness = hand.handedness;
    let keypoints = getHandKeypoints(hand);
    if (!keypoints) continue;
    
    if (handedness == "Left") {
      updatedPts[0] = keypoints[4];
      updatedPts[1] = keypoints[3];
      updatedPts[2] = keypoints[2];
      updatedPts[3] = keypoints[5];
      updatedPts[4] = keypoints[6];
      updatedPts[5] = keypoints[7];
      updatedPts[6] = keypoints[8];
    }
    
    if (handedness == "Right") {
      updatedPts[7] = keypoints[8];
      updatedPts[8] = keypoints[7];
      updatedPts[9] = keypoints[6];
      updatedPts[10] = keypoints[5];
      updatedPts[11] = keypoints[2];
      updatedPts[12] = keypoints[3];
      updatedPts[13] = keypoints[4];
    }  
  }
  pts = updatedPts;
}

function checkForHeart() {
  let leftThumb = pts[0];
  let rightThumb = pts[13];
  let leftIndex = pts[6];
  let rightIndex = pts[7];
  
  if (leftThumb && rightThumb && leftIndex && rightIndex) {
    let thumbDist = dist(rightThumb.x, rightThumb.y, leftThumb.x, leftThumb.y);
    let indexDist = dist(rightIndex.x, rightIndex.y, leftIndex.x, leftIndex.y);
    
    if(thumbDist < 20 && indexDist < 20 && !heartCreated) {
      hearts.push(new Heart(pts));
      heartCreated = true;
    } else if (thumbDist > 30 || indexDist > 30) {
      heartCreated = false;
    }
  }
}

function gotHands(results) {
  hands = results;
}

function isHandOpen(hand) {
  const k = getHandKeypoints(hand);
  if (!k || k.length < 21) {
    return false;
  }

  const wrist = k[0];
  const tipIndices = [4, 8, 12, 16, 20];
  // 取中指第二關節到手腕的距離作為比例基準，降低門檻讓檢測更敏感
  const baseDistance = dist(wrist.x, wrist.y, k[10].x, k[10].y);
  const minOpenDistance = baseDistance * 0.52;
  let openCount = 0;

  for (let i = 0; i < tipIndices.length; i++) {
    const tip = k[tipIndices[i]];
    if (!tip) continue;
    const d = dist(wrist.x, wrist.y, tip.x, tip.y);
    if (d > minOpenDistance) {
      openCount++;
    }
  }

  // 只要 3 根手指伸展就判定為開手，對抬手與手勢更友善
  return openCount >= 3;
}

function isAnyPalmOpen() {
  for (let i = 0; i < hands.length; i++) {
    if (isHandOpen(hands[i])) {
      return true;
    }
  }
  return false;
}

function drawPalmBox() {
  const boxW = 120;
  const boxH = 70;
  const boxX = (width - boxW) / 2;
  const boxY = height * 0.65;

  push();
  noStroke();
  fill(255, 230);
  rect(boxX, boxY, boxW, boxH, 12);
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(32);
  text('五', boxX + boxW / 2, boxY + boxH / 2);
  pop();
}

function displayFactBox() {
  const boxW = width * 0.7;  // 方框寬度為螢幕寬度的70%
  const boxH = height * 0.25; // 方框高度為螢幕高度的25%
  const boxX = (width - boxW) / 2;
  const boxY = (height - boxH) / 2 + height * 0.2; // 下移20%
  const padding = 20;

  push();
  // 繪製白色方框
  stroke(255);
  strokeWeight(3);
  fill(255);
  rect(boxX, boxY, boxW, boxH, 15);

  // 繪製文字
  fill(0); // 黑色文字
  textAlign(CENTER, CENTER);
  textSize(24);
  
  // 使用 textWrap 確保文字不會超出方框
  let wrappedText = currentFact;
  let maxWidth = boxW - (padding * 2);
  
  // 手動換行以確保文字在方框內
  let words = wrappedText.split('');
  let lines = [];
  let currentLine = '';
  
  for (let i = 0; i < words.length; i++) {
    let testLine = currentLine + words[i];
    let testWidth = textWidth(testLine);
    
    if (testWidth > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // 計算總高度，確保不超出方框
  let lineHeight = 35;
  let totalHeight = lines.length * lineHeight;
  let maxLines = Math.floor((boxH - padding * 2) / lineHeight);
  
  // 如果行數超過可顯示的最大行數，只顯示可以放入的行數
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
  }
  
  let startY = boxY + (boxH - (lines.length * lineHeight)) / 2 + lineHeight / 2;
  
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], boxX + boxW / 2, startY + i * lineHeight);
  }
  
  pop();
}

function drawStartScreen() {
  background(18, 28, 65);
  textAlign(CENTER, CENTER);
  let yOffset = height * 0.2;

  // 活潑派對背景色塊
  noStroke();
  fill(255, 120, 160, 35);
  ellipse(width * 0.2, height * 0.18 + yOffset, width * 0.45, height * 0.4);
  fill(120, 220, 255, 35);
  ellipse(width * 0.8, height * 0.18 + yOffset, width * 0.4, height * 0.35);
  fill(255, 220, 120, 30);
  ellipse(width * 0.5, height * 0.57 + yOffset, width * 0.75, height * 0.5);

  fill(255, 235, 120);
  textSize(82);
  text('動物達人研究所', width / 2, height * 0.08 + yOffset);

  textSize(28);
  fill(255, 245, 210);
  text('一起探索最有趣的動物祕密吧！', width / 2, height * 0.17 + yOffset);

  let description1 = '歡迎來到動物達人測驗所！你知道嗎？動物世界裡藏著許多意想不到的祕密，';
  let description2 = '牠們可比你想像中還要特別呢！想知道更多有趣的動物小知識，就快點進入我們的動物研究所吧！';
  let instructions1 = '操作說明：進入頁面後，請伸出手掌，比出數字 5 的手勢，';
  let instructions2 = '就能和我們一起探索有趣的動物世界！';

  textSize(20);
  textLeading(32);
  fill(240);
  textAlign(CENTER, TOP);
  let textBoxX = width * 0.12;
  let textBoxWidth = width * 0.76;
  text(description1, textBoxX, height * 0.24 + yOffset, textBoxWidth, height * 0.12);
  text(description2, textBoxX, height * 0.34 + yOffset, textBoxWidth, height * 0.12);
  fill(220);
  text(instructions1, textBoxX, height * 0.42 + yOffset, textBoxWidth, height * 0.1);
  text(instructions2, textBoxX, height * 0.48 + yOffset, textBoxWidth, height * 0.1);

  startButton.w = width * 0.48;
  startButton.h = height * 0.14;
  startButton.x = width / 2;
  startButton.y = height * 0.8 + yOffset * 0.15;

  if (
    mouseX >= startButton.x - startButton.w / 2 &&
    mouseX <= startButton.x + startButton.w / 2 &&
    mouseY >= startButton.y - startButton.h / 2 &&
    mouseY <= startButton.y + startButton.h / 2
  ) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }

  push();
  rectMode(CENTER);
  fill(255, 235, 180);
  stroke(255);
  strokeWeight(3);
  rect(startButton.x, startButton.y, startButton.w, startButton.h, 28);
  fill(20);
  noStroke();
  textSize(32);
  textAlign(CENTER, CENTER);
  text('開始', startButton.x, startButton.y);
  pop();

  textSize(18);
  fill(255, 240, 200);
  text('點擊按鈕或畫面任意位置開始', width / 2, startButton.y + startButton.h * 0.92);

  spawnStartParticles();
  updateAndDisplayStartParticles();
}

function mousePressed() {
  if (!started) {
    started = true;
    return false;
  }
}

function touchStarted() {
  if (!started) {
    started = true;
    return false;
  }
}

function spawnStartParticles() {
  if (startParticles.length < 180 && random() < 0.65) {
    startParticles.push(new ConfettiParticle());
  }
}

function updateAndDisplayStartParticles() {
  for (let i = startParticles.length - 1; i >= 0; i--) {
    const p = startParticles[i];
    p.update();
    p.display();
    if (p.done) {
      startParticles.splice(i, 1);
    }
  }
}

class ConfettiParticle {
  constructor() {
    this.x = random(width);
    this.y = random(-80, -10);
    this.size = random(12, 26);
    this.alpha = random(180, 255);
    this.speedY = random(2.5, 5.2);
    this.speedX = random(-1.8, 1.8);
    this.angle = random(TWO_PI);
    this.rotationSpeed = random(-0.12, 0.12);
    this.color = color(random(200, 255), random(120, 255), random(120, 255), this.alpha);
    this.done = false;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.angle += this.rotationSpeed;
    this.alpha -= 1.5;
    if (this.y > height + this.size || this.alpha <= 0) {
      this.done = true;
    }
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), this.alpha);
    if (random() < 0.5) {
      rect(0, 0, this.size * 1.8, this.size * 0.55, 4);
    } else {
      ellipse(0, 0, this.size * 1.4, this.size * 0.55);
    }
    pop();
  }
}

function spawnFactEffects(index) {
  if (index === -1) {
    return;
  }

  if ([0, 1, 4, 7].includes(index)) {
    if (random() < 0.25) {
      activeEffects.push(new BubbleEffect());
    }
  } else if ([5, 6].includes(index)) {
    if (random() < 0.18) {
      activeEffects.push(new HollowCircleEffect());
    }
  } else {
    if (random() < 0.2) {
      activeEffects.push(new LeafRainEffect());
    }
  }
}

function updateAndDisplayEffects() {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const effect = activeEffects[i];
    effect.update();
    effect.display();
    if (effect.done) {
      activeEffects.splice(i, 1);
    }
  }
}

class BubbleEffect {
  constructor() {
    this.x = random(width * 0.1, width * 0.9);
    this.y = random(height * 0.7, height * 1.1);
    this.size = random(20, 60);
    this.alpha = random(80, 180);
    this.speedY = random(1.2, 3.2);
    this.speedX = random(-0.5, 0.5);
    this.strokeWeight = random(1, 3);
    this.done = false;
  }

  update() {
    this.y -= this.speedY;
    this.x += this.speedX;
    this.alpha -= 1.2;
    if (this.alpha <= 0 || this.y < -this.size) {
      this.done = true;
    }
  }

  display() {
    push();
    noFill();
    stroke(255, this.alpha);
    strokeWeight(this.strokeWeight);
    ellipse(this.x, this.y, this.size, this.size);
    pop();
  }
}

class HollowCircleEffect {
  constructor() {
    this.x = random(width * 0.1, width * 0.9);
    this.y = random(height * 0.2, height * 0.8);
    this.size = random(30, 90);
    this.alpha = random(90, 170);
    this.strokeWeight = random(1, 4);
    this.speedY = random(0.3, 1.2);
    this.growth = random(0.15, 0.5);
    this.done = false;
  }

  update() {
    this.y += this.speedY;
    this.size += this.growth;
    this.alpha -= 0.8;
    if (this.alpha <= 0 || this.y > height + this.size) {
      this.done = true;
    }
  }

  display() {
    push();
    noFill();
    stroke(255, this.alpha);
    strokeWeight(this.strokeWeight);
    ellipse(this.x, this.y, this.size, this.size);
    pop();
  }
}

class LeafRainEffect {
  constructor() {
    this.x = random(width * 0.05, width * 0.95);
    this.y = random(-80, -20);
    this.size = random(20, 50);
    this.alpha = random(140, 220);
    this.speedY = random(2.5, 5.5);
    this.speedX = random(-1.8, 1.8);
    this.angle = random(-PI / 3, PI / 3);
    this.rotationSpeed = random(-0.02, 0.02);
    this.color = random([color(155, 90, 40), color(205, 130, 60), color(170, 120, 40), color(150, 180, 90), color(200, 170, 90)]);
    this.done = false;
  }

  update() {
    this.y += this.speedY;
    this.x += this.speedX;
    this.angle += this.rotationSpeed;
    this.alpha -= 0.7;
    if (this.alpha <= 0 || this.y > height + this.size) {
      this.done = true;
    }
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    noStroke();
    let c = color(red(this.color), green(this.color), blue(this.color), this.alpha * 0.85);
    fill(c);
    let w = this.size * 0.55;
    let h = this.size * 2.4;

    beginShape();
    vertex(0, -h * 0.5);
    bezierVertex(w * 0.25, -h * 0.35, w * 0.55, -h * 0.05, w * 0.25, h * 0.25);
    bezierVertex(w * 0.15, h * 0.45, 0, h * 0.5, 0, h * 0.5);
    bezierVertex(-w * 0.15, h * 0.45, -w * 0.25, h * 0.25, -w * 0.25, h * 0.25);
    bezierVertex(-w * 0.55, -h * 0.05, -w * 0.25, -h * 0.35, 0, -h * 0.5);
    endShape(CLOSE);

    stroke(0, this.alpha * 0.4);
    strokeWeight(1);
    line(0, -h * 0.5, 0, h * 0.5);
    pop();
  }
}


// 補上缺少的 Heart 類別定義
class Heart {
  constructor(pts) {
    this.pts = pts.map(p => ({x: p.x, y: p.y}));
    this.color = color(random(colorPalette));
    this.alpha = 255;
    this.done = false;
    this.yOffset = 0;
  }

  update() {
    this.yOffset -= 2; // 愛心向上飄
    this.alpha -= 5;   // 逐漸透明
    if (this.alpha <= 0) {
      this.done = true;
    }
  }

  display() {
    push();
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.alpha);
    noStroke();
    beginShape();
    for (let p of this.pts) {
      vertex(p.x * sx, p.y * sy + this.yOffset);
    }
    endShape(CLOSE);
    pop();
  }
}
